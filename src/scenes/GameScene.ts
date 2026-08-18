import Phaser from 'phaser';
import { Capacitor } from '@capacitor/core';
import { AudioBus } from '../game/AudioBus';
import {
  beginHighscoreRun, getPlayerName, sanitizePlayerName, submitHighscore, type RunToken
} from '../game/HighscoreService';
import { GameLevel, getLevelConfig, LevelConfig, MAX_LEVEL, toGameLevel } from '../game/levels';

type Phase = 'intro' | 'playing' | 'outro' | 'gameover';
type CrewId = 'johannes' | 'leo' | 'oliver';
type Power = 'shield' | 'paint' | 'boost' | 'slow';

interface GameSceneData {
  level?: number;
  campaignScore?: number;
  campaignDurationMs?: number;
  campaignCoins?: number;
  campaignLives?: number;
  campaignRunId?: string | null;
  campaignApiStarted?: boolean;
}

const W = 720;
const BASE_H = 1280;
const LAUNCH_PAD_CENTER_X = 480;
const ZONE_PROGRESS_LIMITS = [18, 42, 62, 82, 100] as const;
const ALTITUDE_PROGRESS_POINTS = [0, 18, 42, 62, 82, 90, 100] as const;
const ALTITUDE_KM_POINTS = [0, 11, 50, 85, 600, 1_000, 384_400] as const;
const ZONE_LABELS = [
  'TROPOSFÄREN (0–11 KM)',
  'STRATOSFÄREN (11–50 KM)',
  'MESOSFÄREN (50–85 KM)',
  'TERMOSFÄREN (85–600 KM)',
  'EXOSFÄREN (600–1 000+ KM)',
] as const;

export class GameScene extends Phaser.Scene {
  private phase: Phase = 'intro';
  private backdrop!: Phaser.GameObjects.Rectangle;
  private moon!: Phaser.GameObjects.Image;
  private landingScene?: Phaser.GameObjects.Image;
  private stars: Phaser.GameObjects.Image[] = [];
  private clouds: Phaser.GameObjects.Image[] = [];
  private player!: Phaser.GameObjects.Container;
  private portraits: Phaser.GameObjects.Image[] = [];
  private shieldBubble!: Phaser.GameObjects.Arc;
  private shieldOrbit!: Phaser.GameObjects.Graphics;
  private rocketSprite!: Phaser.GameObjects.Sprite;
  private engineGlow!: Phaser.GameObjects.Ellipse;
  private exhaust?: Phaser.GameObjects.Particles.ParticleEmitter;
  private rocketSwayTween?: Phaser.Tweens.Tween;
  private targetX = W / 2;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: { A: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private leftHeld = false;
  private rightHeld = false;
  private paintAmmo = 0;
  private controlsLayer!: Phaser.GameObjects.Container;
  private gunIcon!: Phaser.GameObjects.Image;
  private gunFace!: Phaser.GameObjects.Graphics;
  private ammoDots: Phaser.GameObjects.Arc[] = [];
  private obstacles!: Phaser.Physics.Arcade.Group;
  private coins!: Phaser.Physics.Arcade.Group;
  private powers!: Phaser.Physics.Arcade.Group;
  private projectiles!: Phaser.Physics.Arcade.Group;
  private altitude = 0;
  private score = 0;
  private coinCount = 0;
  private lives = 3;
  private spawnClock = 0;
  private coinClock = 0;
  private powerClock = 0;
  private beltClock = 0;
  private nextBeltDelay = 12000;
  private beltActiveUntil = 0;
  private invulnerableUntil = 0;
  private activeUntil: Record<Exclude<Power, 'paint'>, number> = { shield: 0, boost: 0, slow: 0 };
  private hudScore!: Phaser.GameObjects.Text;
  private hudCoins!: Phaser.GameObjects.Text;
  private hudHearts!: Phaser.GameObjects.Text;
  private hudAltitude!: Phaser.GameObjects.Text;
  private progressFill!: Phaser.GameObjects.Rectangle;
  private progressTrack!: Phaser.GameObjects.Rectangle;
  private zoneText!: Phaser.GameObjects.Text;
  private powerText!: Phaser.GameObjects.Text;
  private currentZone = -1;
  private paused = false;
  private obstacleCount = 0;
  private pauseLayer?: Phaser.GameObjects.Container;
  private worldMoving = false;
  private currentLevel: GameLevel = 1;
  private levelConfig: LevelConfig = getLevelConfig(1);
  private highscoreRunPromise?: Promise<RunToken | null>;
  private highscoreRunId: string | null = null;
  private flightDurationMs = 0;
  private campaignScore = 0;
  private campaignDurationMs = 0;
  private campaignCoins = 0;
  private campaignLives = 3;
  private campaignRunId: string | null = null;
  private campaignApiStarted = false;
  private oliverMode = false;
  private webHistoryEntryActive = false;

  constructor() { super('Game'); }

  private get viewHeight(): number { return Math.max(BASE_H, this.scale.height); }
  private get extraHeight(): number { return this.viewHeight - BASE_H; }

  init(data: GameSceneData = {}): void {
    this.currentLevel = toGameLevel(data.level ?? 1);
    this.levelConfig = getLevelConfig(this.currentLevel);
    this.campaignScore = Math.max(0, Math.floor(Number(data.campaignScore) || 0));
    this.campaignDurationMs = Math.max(0, Math.floor(Number(data.campaignDurationMs) || 0));
    this.campaignCoins = Math.max(0, Math.floor(Number(data.campaignCoins) || 0));
    const campaignLives = Number(data.campaignLives);
    this.campaignLives = Number.isFinite(campaignLives)
      ? Phaser.Math.Clamp(Math.floor(campaignLives), 0, 3)
      : 3;
    this.campaignRunId = typeof data.campaignRunId === 'string' ? data.campaignRunId : null;
    this.campaignApiStarted = data.campaignApiStarted === true;
    this.oliverMode = localStorage.getItem('rymdjojjo-oliver-mode') === '1';
  }

  create(): void {
    this.phase = 'intro'; this.altitude = 0; this.score = 0; this.coinCount = 0; this.lives = this.campaignLives;
    this.spawnClock = 0; this.coinClock = 0; this.powerClock = 0; this.obstacleCount = 0;
    this.beltClock = 0; this.nextBeltDelay = Phaser.Math.Between(9000, 14000) * this.levelConfig.obstacleInterval; this.beltActiveUntil = 0;
    this.currentZone = -1; this.paused = false; this.worldMoving = false;
    this.highscoreRunPromise = undefined; this.highscoreRunId = this.campaignRunId; this.flightDurationMs = 0;
    this.leftHeld = false; this.rightHeld = false; this.paintAmmo = 0; this.ammoDots = [];
    this.stars = []; this.clouds = []; this.exhaust = undefined;
    this.activeUntil = { shield: 0, boost: 0, slow: 0 };
    window.addEventListener('rymdjojjo-back', this.handleAndroidBack);
    if (!Capacitor.isNativePlatform()) {
      const currentState = window.history.state;
      if (!currentState?.rymdjojjoGame) {
        const preservedState = currentState && typeof currentState === 'object' ? currentState : {};
        window.history.pushState({ ...preservedState, rymdjojjoGame: true }, '', window.location.href);
      }
      this.webHistoryEntryActive = true;
      window.addEventListener('popstate', this.handleWebBack);
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('rymdjojjo-back', this.handleAndroidBack);
      window.removeEventListener('popstate', this.handleWebBack);
    });
    this.createWorld();
    this.obstacles = this.physics.add.group({ classType: Phaser.Physics.Arcade.Sprite });
    this.coins = this.physics.add.group();
    this.powers = this.physics.add.group();
    this.projectiles = this.physics.add.group();
    this.createPlayer(LAUNCH_PAD_CENTER_X, 964 + this.extraHeight);
    this.createHud();
    this.setupControls();
    this.physics.add.overlap(this.player, this.obstacles, (_p, o) => this.hitObstacle(o as Phaser.Physics.Arcade.Image));
    this.physics.add.overlap(this.player, this.coins, (_p, c) => this.collectCoin(c as Phaser.Physics.Arcade.Image));
    this.physics.add.overlap(this.player, this.powers, (_p, p) => this.collectPower(p as Phaser.Physics.Arcade.Image));
    this.physics.add.overlap(this.projectiles, this.obstacles, (p, o) => this.paintHit(p as Phaser.Physics.Arcade.Image, o as Phaser.Physics.Arcade.Image));
    const testParams = new URLSearchParams(window.location.search);
    const testAltitude = testParams.has('testAltitude') ? Number(testParams.get('testAltitude')) : Number.NaN;
    if (import.meta.env.DEV && Number.isFinite(testAltitude)) {
      this.altitude = Phaser.Math.Clamp(testAltitude, 0, 99);
      this.player.setPosition(W / 2, 890);
      this.portraits.forEach(p => p.setAlpha(1));
      this.beginFlight();
      if (testParams.has('testPaint')) {
        this.paintAmmo = 20;
        this.updatePaintUi();
      }
      const testPower = testParams.get('testPower') as Power | null;
      if (testPower && ['shield', 'paint', 'boost', 'slow'].includes(testPower)) {
        this.invulnerableUntil = Number.MAX_SAFE_INTEGER;
        this.spawnPower(testPower, 360, true);
      }
      if (testParams.has('testBelt')) this.time.delayedCall(800, () => this.spawnAsteroidBelt());
      if (testParams.has('testOutro')) this.time.delayedCall(500, () => { this.altitude = 100; this.startOutro(); });
    } else {
      this.startIntro();
    }
    this.cameras.main.fadeIn(350, 8, 24, 48);
  }

  update(_time: number, delta: number): void {
    if (this.paused) return;
    const dt = Math.min(delta, 34) / 1000;
    this.updateWorld(this.worldMoving ? dt : 0);
    if (this.phase !== 'playing') return;
    this.updateFlight(dt, delta);
  }

  private createWorld(): void {
    this.backdrop = this.add.rectangle(W / 2, this.viewHeight / 2, W, this.viewHeight, 0x79cfe1).setDepth(-30);
    for (let i = 0; i < 80; i++) {
      const s = this.add.image(Phaser.Math.Between(8, W - 8), Phaser.Math.Between(0, this.viewHeight), 'spark')
        .setScale(Phaser.Math.FloatBetween(0.08, 0.28)).setAlpha(0).setDepth(-25);
      s.setData({ rate: Phaser.Math.FloatBetween(15, 58), baseAlpha: Phaser.Math.FloatBetween(0.5, 1) }); this.stars.push(s);
    }
    for (let i = 0; i < 11; i++) {
      const layer = i % 3;
      const isWispy = i % 3 === 1;
      const width = Phaser.Math.Between(isWispy ? 300 : 260, isWispy ? 570 : 500) * (0.76 + layer * 0.17);
      const c = this.add.image(Phaser.Math.Between(-150, W + 150), Phaser.Math.Between(-180, this.viewHeight + 180), isWispy ? 'cloud-wispy' : 'cloud-cumulus')
        .setDisplaySize(width, width * (isWispy ? 0.33 : 0.563))
        .setAlpha(Phaser.Math.FloatBetween(0.38, 0.76)).setDepth(-14 + layer)
        .setFlipX(Math.random() < 0.5);
      c.setData({
        rate: Phaser.Math.FloatBetween(34, 72) * (0.72 + layer * 0.25),
        baseAlpha: c.alpha,
        drift: Phaser.Math.FloatBetween(-8, 8),
        phase: Phaser.Math.FloatBetween(0, Math.PI * 2)
      });
      this.clouds.push(c);
    }
    this.moon = this.add.image(W / 2, -370, 'moon-disk').setDisplaySize(620, 620).setDepth(-17).setVisible(false);
  }

  private createPlayer(x: number, y: number): void {
    this.rocketSprite = this.add.sprite(0, 66, 'rocket-game-idle');
    const j = this.add.image(2, -48, 'portrait-johannes').setDisplaySize(66, 66).setAlpha(0);
    const l = this.add.image(-25, 13, 'portrait-leo').setDisplaySize(43, 43).setAlpha(0);
    const o = this.add.image(27, 13, 'portrait-oliver').setDisplaySize(43, 43).setAlpha(0);
    const rims = this.add.graphics();
    rims.lineStyle(3, 0x8ff5f3, 0.7).strokeCircle(2, -48, 34).lineStyle(2, 0xffde78, 0.75).strokeCircle(-25, 13, 23).strokeCircle(27, 13, 23);
    rims.fillStyle(0xffffff, 0.26).fillEllipse(-9, -61, 18, 8);
    this.engineGlow = this.add.ellipse(0, 242, 118, 46, 0x65efff, 0.2).setVisible(false);
    this.shieldBubble = this.add.circle(0, -2, 124, 0x4edff6, 0.12).setStrokeStyle(7, 0x82f1ff, 0.85).setVisible(false);
    this.shieldOrbit = this.add.graphics().setVisible(false);
    this.shieldOrbit.lineStyle(4, 0xffffff, 0.72).beginPath().arc(0, -2, 132, -0.15, 0.7).strokePath();
    this.shieldOrbit.beginPath().arc(0, -2, 132, 1.45, 2.3).strokePath();
    this.shieldOrbit.beginPath().arc(0, -2, 132, 3.05, 3.9).strokePath();
    this.shieldOrbit.beginPath().arc(0, -2, 132, 4.65, 5.5).strokePath();
    this.player = this.add.container(x, y, [this.engineGlow, this.rocketSprite, j, l, o, rims, this.shieldBubble, this.shieldOrbit]).setDepth(5);
    this.portraits = [j, l, o];
    this.physics.add.existing(this.player);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(92, 198).setOffset(-46, -99).setImmovable(true);
    body.enable = false;
    this.rocketSwayTween = this.tweens.add({ targets: this.player, angle: { from: -1.2, to: 1.2 }, duration: 1150, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.exhaust = this.add.particles(0, 0, 'spark', {
      speedX: { min: -55, max: 55 }, speedY: { min: 115, max: 235 },
      lifespan: { min: 320, max: 620 }, frequency: 42, quantity: 1,
      scale: { start: 0.32, end: 0 }, alpha: { start: 0.62, end: 0 },
      tint: [0xffffff, 0x9ff7ff, 0xffdc69], blendMode: 'ADD', emitting: false
    }).setDepth(4);
    this.exhaust.startFollow(this.player, 0, 284, true);
  }

  private setupControls(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys('A,D') as { A: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
    this.input.addPointer(2);
  }

  private startIntro(): void {
    this.hudSetVisible(false);
    const shift = this.extraHeight;
    const launchSiteY = this.viewHeight + 24;
    const launchSite = this.add.image(W / 2, launchSiteY, 'launch-site').setOrigin(0.5, 1).setDisplaySize(900, 600).setDepth(0);
    const introTitle = this.add.text(360, 110, `NIVÅ ${this.currentLevel} • BESÄTTNINGEN ÄR REDO!`, { fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: '32px', color: '#ffffff', stroke: '#173653', strokeThickness: 7 }).setOrigin(0.5).setDepth(12);
    const crew = [
      this.createCrewFull('johannes', -90, 1262 + shift, 0.4),
      this.createCrewFull('leo', -170, 1274 + shift, 0.37),
      this.createCrewFull('oliver', -250, 1286 + shift, 0.35)
    ];
    let boardingSpeed = 1;
    const boardingTimers: Phaser.Time.TimerEvent[] = [];
    const boardingTweens: Phaser.Tweens.Tween[] = [];
    const speedUpBoarding = (): void => {
      boardingSpeed = Math.min(3, boardingSpeed + 0.5);
      boardingTimers.forEach(timer => { timer.timeScale = boardingSpeed; });
      boardingTweens.forEach(tween => { tween.timeScale = boardingSpeed; });
    };
    this.input.on('pointerdown', speedUpBoarding);
    const entryX = [522, 495, 547];
    const entryY = [916 + shift, 977 + shift, 977 + shift];
    const walkDurations = [2650, 2850, 3050];
    crew.forEach((person, i) => {
      const startTimer = this.time.delayedCall(i * 430, () => {
        const walkTween = this.tweens.add({ targets: person, x: 430 - i * 24, y: 1146 + shift + i * 9, duration: walkDurations[i], ease: 'Linear', onComplete: () => {
          const walkScale = Number(person.getData('walkScale'));
          const entryTween = this.tweens.add({
            targets: person,
            x: entryX[i], y: entryY[i], alpha: 0,
            scaleX: walkScale * 0.18, scaleY: walkScale * 0.18,
            duration: 440, ease: 'Sine.in', onComplete: () => person.destroy()
          });
          entryTween.timeScale = boardingSpeed;
          boardingTweens.push(entryTween);
        }});
        walkTween.timeScale = boardingSpeed;
        boardingTweens.push(walkTween);
      });
      startTimer.timeScale = boardingSpeed;
      boardingTimers.push(startTimer);
    });
    const boardingComplete = this.time.delayedCall(4550, () => {
      this.input.off('pointerdown', speedUpBoarding);
      this.portraits.forEach((p, i) => this.tweens.add({ targets: p, alpha: 1, duration: 250, delay: i * 120 }));
      const count = this.add.text(360, 375, '3', { fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: '105px', color: '#fff2a8', stroke: '#173653', strokeThickness: 12 }).setOrigin(0.5).setDepth(15);
      [3, 2, 1].forEach((n, i) => this.time.delayedCall(i * 650, () => { count.setText(String(n)).setScale(1.4); this.tweens.add({ targets: count, scale: 1, duration: 380, ease: 'Back.out' }); AudioBus.tone(300 + i * 80, 0.12, 'square', 0.03); }));
      this.time.delayedCall(2000, () => {
        count.setText('LYFT!').setFontSize(62); AudioBus.launch();
        this.igniteRocket();
        this.tweens.add({ targets: introTitle, alpha: 0, y: 80, duration: 350, onComplete: () => introTitle.destroy() });
        this.tweens.add({ targets: this.player, x: W / 2, y: 760, duration: 1200, ease: 'Sine.inOut' });
        this.tweens.add({ targets: launchSite, y: '+=900', duration: 1600, ease: 'Quad.in', onComplete: () => [launchSite, count].forEach(o => o.destroy()) });
        this.time.delayedCall(1350, () => this.beginFlight());
      });
    });
    boardingComplete.timeScale = boardingSpeed;
    boardingTimers.push(boardingComplete);
  }

  private igniteRocket(): void {
    this.worldMoving = true;
    if (!this.rocketSprite.anims.isPlaying) this.rocketSprite.play('rocket-flight');
    this.engineGlow.setVisible(true);
    this.exhaust?.start();
  }

  private beginFlight(): void {
    this.phase = 'playing';
    if (!this.oliverMode && !this.campaignApiStarted) {
      this.campaignApiStarted = true;
      this.highscoreRunPromise = beginHighscoreRun().then(run => {
        this.highscoreRunId = run?.run_id ?? null;
        this.campaignRunId = this.highscoreRunId;
        return run;
      });
    }
    (this.player.body as Phaser.Physics.Arcade.Body).enable = true;
    this.igniteRocket();
    this.hudSetVisible(true);
    this.targetX = W / 2;
    this.showZone(this.getZone());
  }

  private createCrewFull(id: CrewId, x: number, y: number, scale: number): Phaser.GameObjects.Sprite {
    const scaleMultiplier: Record<CrewId, number> = { johannes: 1.12, leo: 1.1, oliver: 1.08 };
    const sprite = this.add.sprite(x, y, `crew-walk-${id}-0`).setOrigin(0.5, 1).setDepth(8);
    sprite.setScale(scale * scaleMultiplier[id]);
    sprite.play(`crew-walk-${id}`);
    sprite.anims.setProgress(id === 'johannes' ? 0 : id === 'leo' ? 0.375 : 0.625);
    sprite.setData('walkScale', sprite.scaleX);
    return sprite;
  }

  private createHud(): void {
    const top = this.add.rectangle(W / 2, 48, W, 96, 0x06152c, 0.75).setDepth(30).setStrokeStyle(2, 0xffffff, 0.12);
    this.hudHearts = this.add.text(24, 24, '♥ ♥ ♥', { fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: '34px', color: '#ff695f', stroke: '#491b2b', strokeThickness: 4 }).setDepth(31);
    this.hudCoins = this.add.text(205, 24, '●  0', { fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: '32px', color: '#ffd95b', stroke: '#614017', strokeThickness: 4 }).setDepth(31);
    this.hudScore = this.add.text(610, 20, '0', { fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: '30px', color: '#ffffff' }).setOrigin(1, 0).setDepth(31);
    this.hudAltitude = this.add.text(610, 56, '0 km', { fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: '25px', color: '#a9f5ff' }).setOrigin(1, 0).setDepth(31);
    const pause = this.add.text(681, 18, 'Ⅱ', { fontFamily: 'Arial', fontStyle: 'bold', fontSize: '35px', color: '#ffffff', backgroundColor: '#173a59', padding: { x: 11, y: 8 } }).setOrigin(1, 0).setDepth(32).setInteractive({ useHandCursor: true });
    pause.on('pointerup', () => this.togglePause());
    this.progressTrack = this.add.rectangle(360, 116, 590, 13, 0x07162d, 0.65).setStrokeStyle(2, 0xffffff, 0.3).setDepth(30);
    this.progressFill = this.add.rectangle(66, 116, 0, 9, 0x6de7e5).setOrigin(0, 0.5).setDepth(31);
    this.zoneText = this.add.text(360, 180, '', { fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: '27px', color: '#ffffff', backgroundColor: '#0b2443cc', padding: { x: 22, y: 12 } }).setOrigin(0.5).setDepth(31).setAlpha(0);
    this.powerText = this.add.text(360, 1000, '', { fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: '29px', color: '#ffffff', backgroundColor: '#102a4ddd', padding: { x: 20, y: 10 } }).setOrigin(0.5).setDepth(31).setAlpha(0);
    if (this.oliverMode) {
      const training = this.add.text(360, 145, 'OLIVERLÄGE  •  TRÄNING', {
        fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: '18px', color: '#d9fff5',
        backgroundColor: '#247b69cc', padding: { x: 15, y: 6 }
      }).setOrigin(0.5).setDepth(31).setData('hud', true);
      training.setData('hud', true);
    }
    this.createTouchControls();
    top.setData('hud', true); pause.setData('hud', true);
  }

  private createTouchControls(): void {
    const createArrow = (x: number, direction: -1 | 1): Phaser.GameObjects.Container => {
      const shadow = this.add.circle(0, 7, 59, 0x020b1b, 0.5);
      const face = this.add.circle(0, 0, 57, 0x102d4c, 0.78).setStrokeStyle(4, 0x8cecf0, 0.78);
      const gloss = this.add.ellipse(-11, -19, 58, 20, 0xffffff, 0.1).setAngle(-13);
      const arrow = this.add.graphics();
      arrow.fillStyle(0xf4fbff, 1);
      if (direction < 0) arrow.fillTriangle(-26, 0, 15, -28, 15, 28);
      else arrow.fillTriangle(26, 0, -15, -28, -15, 28);
      const hit = this.add.zone(0, 0, 200, 200).setInteractive({ useHandCursor: true });
      const button = this.add.container(x, 1170 + this.extraHeight, [shadow, face, gloss, arrow, hit]);
      const setPressed = (pressed: boolean): void => {
        if (direction < 0) this.leftHeld = pressed; else this.rightHeld = pressed;
        button.setScale(pressed ? 0.92 : 1);
        face.setFillStyle(pressed ? 0x1f7690 : 0x102d4c, pressed ? 0.96 : 0.78);
      };
      hit.on('pointerdown', () => {
        AudioBus.unlock();
        if (this.phase !== 'playing' || this.paused) return;
        this.targetX = Phaser.Math.Clamp(this.targetX + direction * 34, 105, W - 105);
        setPressed(true);
      });
      hit.on('pointerup', () => setPressed(false));
      hit.on('pointerupoutside', () => setPressed(false));
      hit.on('pointerout', () => setPressed(false));
      return button;
    };

    const left = createArrow(105, -1);
    const right = createArrow(615, 1);
    const gunShadow = this.add.circle(0, 7, 57, 0x020b1b, 0.5);
    this.gunFace = this.add.graphics();
    this.gunIcon = this.add.image(0, -4, 'paintball-blaster').setDisplaySize(86, 86);
    const gunHit = this.add.zone(0, 0, 166, 166).setInteractive({ useHandCursor: true });
    const gun = this.add.container(360, 1170 + this.extraHeight, [gunShadow, this.gunFace, this.gunIcon, gunHit]);
    for (let i = 0; i < 20; i++) {
      const angle = Phaser.Math.DegToRad(-90 + i * (360 / 20));
      const dot = this.add.circle(Math.cos(angle) * 75, Math.sin(angle) * 75, 4.5, 0xffffff, 1)
        .setStrokeStyle(2, 0xffffff, 0.84);
      this.ammoDots.push(dot);
      gun.add(dot);
    }
    gunHit.on('pointerdown', () => {
      AudioBus.unlock();
      if (this.firePaint()) {
        gun.setScale(0.9);
        this.time.delayedCall(80, () => { if (gun.active) gun.setScale(1); });
      }
    });
    gunHit.on('pointerup', () => gun.setScale(1));
    gunHit.on('pointerout', () => gun.setScale(1));
    this.controlsLayer = this.add.container(0, 0, [left, gun, right]).setDepth(36);
    this.controlsLayer.setData('hud', true);
    this.updatePaintUi();
  }

  private updatePaintUi(): void {
    const active = this.paintAmmo > 0;
    this.gunFace.clear();
    this.gunFace.fillStyle(active ? 0x17475a : 0x13243a, active ? 0.94 : 0.72).fillCircle(0, 0, 55);
    this.gunFace.lineStyle(4, active ? 0xffd45d : 0x668093, active ? 0.96 : 0.62).strokeCircle(0, 0, 55);
    if (active) {
      this.gunFace.lineStyle(3, 0x65f3ed, 0.58).strokeCircle(0, 0, 49);
      this.gunIcon.clearTint().setAlpha(1);
    } else {
      this.gunIcon.setTint(0x71808c).setAlpha(0.34);
    }
    this.ammoDots.forEach((dot, i) => {
      const loaded = i < this.paintAmmo;
      dot.setVisible(loaded);
      if (loaded) {
        dot.setFillStyle(i % 3 === 0 ? 0xff579f : i % 3 === 1 ? 0x56e4df : 0xffd45d, 1);
        dot.setStrokeStyle(2, 0xffffff, 0.84);
      }
    });
  }

  private hudSetVisible(visible: boolean): void {
    [this.hudHearts, this.hudCoins, this.hudScore, this.hudAltitude, this.progressFill, this.progressTrack].forEach(o => o.setVisible(visible));
    this.children.list.filter(o => o.getData?.('hud')).forEach(o => (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(visible));
  }

  private updateFlight(dt: number, rawDelta: number): void {
    this.flightDurationMs += Math.min(rawDelta, 250);
    const now = this.time.now;
    const slow = this.activeUntil.slow > now;
    const boost = this.activeUntil.boost > now;
    const worldFactor = slow ? 0.55 : 1;
    const scroll = (305 + this.altitude * 2.05) * worldFactor * this.levelConfig.worldSpeed;
    let input = 0;
    if (this.cursors.left.isDown || this.keys.A.isDown || this.leftHeld) input -= 1;
    if (this.cursors.right.isDown || this.keys.D.isDown || this.rightHeld) input += 1;
    if (Phaser.Input.Keyboard.JustDown(this.cursors.space)) this.firePaint();
    if (input) this.targetX += input * 540 * this.levelConfig.controlSpeed * dt;
    this.targetX = Phaser.Math.Clamp(this.targetX, 105, W - 105);
    this.player.x = Phaser.Math.Linear(this.player.x, this.targetX, 1 - Math.pow(0.0008, dt * this.levelConfig.controlSpeed));
    this.player.y = 890 + Math.sin(now / 260) * 7;
    this.player.angle += Phaser.Math.Clamp((this.targetX - this.player.x) * 0.018 - this.player.angle, -2.2, 2.2) * dt * 5;
    this.rocketSprite.anims.timeScale = boost ? 1.65 : 1;
    this.engineGlow.setScale(1 + Math.sin(now / 72) * 0.12, boost ? 1.45 : 1 + Math.cos(now / 85) * 0.12);
    this.engineGlow.setAlpha(boost ? 0.48 : 0.2 + Math.sin(now / 90) * 0.06);

    this.altitude = Math.min(100, this.altitude + rawDelta * 0.00062 * this.levelConfig.climbSpeed * (boost ? 1.08 : 1));
    this.score += Math.round(rawDelta * (0.015 + this.altitude * 0.00012) * (boost ? 2 : 1));
    this.updateObjects(this.obstacles, scroll, dt);
    this.updateObjects(this.coins, scroll, dt);
    this.updateObjects(this.powers, scroll, dt);
    this.updateProjectiles(dt);
    this.spawnClock += rawDelta; this.coinClock += rawDelta; this.powerClock += rawDelta;
    if (this.getZone() >= 3) {
      this.beltClock += rawDelta;
      if (this.beltClock > this.nextBeltDelay && now > this.beltActiveUntil) {
        this.beltClock = 0;
        this.nextBeltDelay = Phaser.Math.Between(16000, 22000) * this.levelConfig.obstacleInterval;
        this.spawnAsteroidBelt();
      }
    }
    const obstacleDelay = Phaser.Math.Linear(1750, 760, this.altitude / 100) * this.levelConfig.obstacleInterval;
    if (this.spawnClock > obstacleDelay && now > this.beltActiveUntil) { this.spawnClock = 0; this.spawnObstacle(); }
    if (this.coinClock > 2400 * this.levelConfig.coinInterval) { this.coinClock = 0; this.spawnCoinPattern(); }
    if (this.powerClock > 12500 * this.levelConfig.powerInterval) { this.powerClock = 0; this.spawnPower(); }
    if (boost) this.magnetCoins(dt);
    const shieldActive = this.activeUntil.shield > now;
    this.shieldBubble.setVisible(shieldActive);
    this.shieldOrbit.setVisible(shieldActive);
    if (shieldActive) {
      const shieldPulse = 1 + Math.sin(now / 150) * 0.035;
      this.shieldBubble.setScale(shieldPulse).setAlpha(0.7 + Math.sin(now / 115) * 0.2);
      this.shieldOrbit.setScale(shieldPulse).setRotation(this.shieldOrbit.rotation + dt * 1.7);
    }
    this.updateHud();
    const z = this.getZone(); if (z !== this.currentZone) this.showZone(z);
    if (this.altitude >= 100) this.startOutro();
  }

  private updateObjects(group: Phaser.Physics.Arcade.Group, scroll: number, dt: number): void {
    group.children.each(child => {
      const o = child as Phaser.Physics.Arcade.Image;
      o.y += scroll * dt * (o.getData('rate') ?? 1);
      o.x += (o.getData('vx') ?? 0) * dt * this.levelConfig.horizontalSpeed;
      o.angle += (o.getData('spin') ?? 0) * dt;
      this.updateObjectAnimation(o, dt);
      if (o.y > this.viewHeight + 180 || o.x < -220 || o.x > W + 220) o.destroy();
      return true;
    });
  }

  private updateObjectAnimation(o: Phaser.Physics.Arcade.Image, dt: number): void {
    const now = this.time.now;
    const phase = Number(o.getData('animPhase') ?? 0);
    const kind = String(o.getData('kind') ?? '');
    const animType = String(o.getData('animType') ?? '');

    if (kind === 'bird') o.y += Math.sin(now / 105 + phase) * 18 * dt;
    if (kind === 'balloon') {
      o.angle = Math.sin(now / 620 + phase) * 2.8;
      o.x += Math.cos(now / 850 + phase) * 12 * dt;
    }
    if (kind === 'ufo') {
      o.y += Math.sin(now / 420 + phase) * 2.2 * dt;
      o.angle = Math.sin(now / 1100 + phase) * 0.65;
    }
    if (kind === 'jumbo') o.y += Math.sin(now / 320 + phase) * 5 * dt;

    if (animType === 'coin') {
      const baseScale = Number(o.getData('baseScale') ?? 0.66);
      o.scaleX = baseScale * (0.18 + Math.abs(Math.cos(now / 145 + phase)) * 0.82);
      o.scaleY = baseScale;
    } else if (animType === 'power') {
      const baseScale = Number(o.getData('baseScale') ?? 0.82);
      const pulse = baseScale * (1 + Math.sin(now / 180 + phase) * 0.09);
      o.setScale(pulse);
      o.setAlpha(0.9 + Math.sin(now / 125 + phase) * 0.1);
      const halo = o.getData('powerHalo') as Phaser.GameObjects.Arc | undefined;
      if (halo?.active) {
        halo.setPosition(o.x, o.y);
        halo.setScale(1 + Math.sin(now / 180 + phase) * 0.1);
        halo.setAlpha(0.2 + Math.sin(now / 150 + phase) * 0.07);
      }
    }

    const detail = o.getData('animatedDetail') as Phaser.GameObjects.Container | undefined;
    if (!detail?.active) return;

    if (kind === 'balloon') {
      this.positionDetail(o, detail, 0, o.displayHeight * 0.185);
      const fire = detail.getData('fire') as Phaser.GameObjects.Graphics;
      fire.scaleY = 0.7 + Math.abs(Math.sin(now / 62 + phase)) * 0.55;
      fire.alpha = 0.76 + Math.sin(now / 48 + phase) * 0.24;
    } else if (kind === 'satellite') {
      this.positionDetail(o, detail, -o.displayWidth * 0.06, -o.displayHeight * 0.42);
      const dot = detail.getData('dot') as Phaser.GameObjects.Arc;
      const rings = detail.getData('rings') as Phaser.GameObjects.Arc[];
      dot.setAlpha(0.55 + Math.abs(Math.sin(now / 120 + phase)) * 0.45);
      rings.forEach((ring, i) => {
        const progress = ((now / 920 + i / rings.length + phase) % 1 + 1) % 1;
        ring.setScale(0.35 + progress * 1.75).setAlpha((1 - progress) * 0.72);
      });
    }
  }

  private positionDetail(o: Phaser.Physics.Arcade.Image, detail: Phaser.GameObjects.Container, localX: number, localY: number): void {
    const x = (o.flipX ? -localX : localX);
    const cos = Math.cos(o.rotation); const sin = Math.sin(o.rotation);
    detail.setPosition(o.x + x * cos - localY * sin, o.y + x * sin + localY * cos);
  }

  private updateProjectiles(dt: number): void {
    this.projectiles.children.each(child => {
      const p = child as Phaser.Physics.Arcade.Image;
      p.x += (p.getData('vx') ?? 0) * dt; p.y += (p.getData('vy') ?? -600) * dt;
      if (p.y < -50 || p.x < -50 || p.x > W + 50) p.destroy();
      return true;
    });
  }

  private spawnObstacle(): void {
    this.obstacleCount++;
    const z = this.getZone();
    const choices = z === 0
      ? ['bird', 'bird', 'plane', 'plane', 'jumbo']
      : z === 1
        ? ['balloon', 'balloon', 'bird', 'plane', 'plane', 'jumbo']
        : z === 2
          ? ['satellite', 'satellite', 'ufo', 'ufo']
          : z === 3
            ? ['satellite', 'satellite', 'ufo', 'asteroid']
            : ['satellite', 'ufo', 'ufo', 'asteroid', 'asteroid'];
    const key = Phaser.Utils.Array.GetRandom(choices);
    let x = this.altitude < 12 && this.obstacleCount < 5
      ? Phaser.Utils.Array.GetRandom([105, 205, 515, 615])
      : Phaser.Math.Between(90, W - 90);
    let scale = 1; let vx = 0; let spin = 0;
    if (key === 'bird') {
      scale = Phaser.Math.FloatBetween(0.72, 1.05);
      const direction = Math.random() < 0.5 ? -1 : 1;
      vx = direction * Phaser.Math.Between(32, 82);
    }
    if (key === 'plane') { const left = Math.random() < 0.5; x = left ? -90 : W + 90; vx = left ? Phaser.Math.Between(95, 160) : -Phaser.Math.Between(95, 160); scale = Phaser.Math.FloatBetween(0.8, 1.08); }
    if (key === 'jumbo') { const left = Math.random() < 0.5; x = left ? -220 : W + 220; vx = left ? Phaser.Math.Between(75, 110) : -Phaser.Math.Between(75, 110); scale = Phaser.Math.FloatBetween(0.9, 1.08); }
    if (key === 'balloon') scale = Phaser.Math.FloatBetween(0.92, 1.16);
    if (key === 'satellite') { scale = Phaser.Math.FloatBetween(0.78, 1.08); spin = Phaser.Math.Between(-24, 24); }
    if (key === 'ufo') { const left = Math.random() < 0.5; x = left ? -120 : W + 120; vx = left ? Phaser.Math.Between(68, 118) : -Phaser.Math.Between(68, 118); scale = Phaser.Math.FloatBetween(0.78, 1.02); }
    if (key === 'asteroid') {
      scale = Phaser.Math.FloatBetween(0.58, 1.38);
      vx = Math.random() < 0.62 ? Phaser.Math.Between(-82, 82) : 0;
      spin = Phaser.Math.Between(-110, 110);
      if (Math.abs(spin) < 28) spin = spin < 0 ? -28 : 28;
      this.createAsteroid(x, -150, scale, vx, spin, Phaser.Math.FloatBetween(0.88, 1.12));
      return;
    }
    const textureKey = key === 'asteroid'
      ? 'obstacle-asteroid-0'
      : key === 'bird'
        ? 'obstacle-bird-flap-0'
        : key === 'plane'
          ? 'obstacle-plane-propeller-0'
          : key === 'ufo'
            ? 'obstacle-ufo-0'
            : key === 'jumbo'
              ? 'obstacle-jumbojet'
          : `obstacle-${key}`;
    const o = this.obstacles.create(x, -150, textureKey) as Phaser.Physics.Arcade.Sprite;
    const displaySizes: Record<string, { w: number; h: number }> = {
      bird: { w: 148, h: 99 },
      plane: { w: 238, h: 159 },
      jumbo: { w: 430, h: 287 },
      balloon: { w: 184, h: 276 },
      satellite: { w: 230, h: 153 },
      ufo: { w: 238, h: 159 }
    };
    const targetSize = displaySizes[key];
    if (targetSize) o.setDisplaySize(targetSize.w * scale, targetSize.h * scale);
    else o.setScale(scale);
    if ((key === 'plane' || key === 'jumbo' || key === 'ufo' || key === 'bird') && vx < 0) o.setFlipX(true);
    o.setDepth(4).setData({ rate: Phaser.Math.FloatBetween(0.88, 1.12), vx, spin, kind: key, animPhase: Phaser.Math.FloatBetween(0, Math.PI * 2) });
    if (key === 'bird') {
      o.play({ key: 'bird-flap', startFrame: Phaser.Math.Between(0, 3) });
      o.anims.timeScale = Phaser.Math.FloatBetween(0.88, 1.18);
    }
    if (key === 'plane') {
      o.play({ key: 'plane-propeller', startFrame: Phaser.Math.Between(0, 3) });
      o.anims.timeScale = Phaser.Math.FloatBetween(0.92, 1.12);
    }
    if (key === 'ufo') {
      o.play({ key: 'ufo-lights', startFrame: Phaser.Math.Between(0, 3) });
      o.anims.timeScale = Phaser.Math.FloatBetween(0.86, 1.14);
    }
    if (key === 'balloon') this.attachBalloonFlame(o, scale);
    if (key === 'satellite') this.attachSatelliteSignal(o, scale);
    o.body!.setSize(o.width * 0.58, o.height * 0.58);
  }

  private createAsteroid(x: number, y: number, size: number, vx: number, spin: number, rate: number): Phaser.Physics.Arcade.Sprite {
    const frame = Phaser.Math.Between(0, 3);
    const o = this.obstacles.create(x, y, `obstacle-asteroid-${frame}`) as Phaser.Physics.Arcade.Sprite;
    const shapes = [
      { w: 118, h: 112 },
      { w: 146, h: 108 },
      { w: 130, h: 118 },
      { w: 122, h: 116 }
    ];
    const shape = shapes[frame]!;
    o.setDisplaySize(shape.w * size, shape.h * size);
    o.setDepth(4).setData({ rate, vx, spin, kind: 'asteroid', animPhase: Phaser.Math.FloatBetween(0, Math.PI * 2) });
    o.body!.setSize(o.width * 0.58, o.height * 0.58);
    return o;
  }

  private spawnAsteroidBelt(): void {
    this.beltActiveUntil = this.time.now + 6200;
    this.spawnClock = 0;
    const firstGap = Phaser.Math.Between(210, W - 210);
    const direction = Math.random() < 0.5 ? -1 : 1;
    const rows = 6;

    for (let row = 0; row < rows; row++) {
      const gapCenter = Phaser.Math.Clamp(firstGap + direction * Math.sin(row * 0.86) * 82, 155, W - 155);
      const gapWidth = 245;
      const rowY = -130 - row * 175;
      for (let slot = 0; slot < 7; slot++) {
        const laneX = 54 + slot * 102 + Phaser.Math.Between(-10, 10);
        if (Math.abs(laneX - gapCenter) < gapWidth / 2) continue;
        const edgeBoost = Math.abs(laneX - gapCenter) > 260 ? 1.12 : 1;
        this.createAsteroid(
          laneX,
          rowY + Phaser.Math.Between(-14, 14),
          Phaser.Math.FloatBetween(0.48, 0.88) * edgeBoost,
          Phaser.Math.Between(-18, 18),
          Phaser.Math.Between(-125, 125),
          Phaser.Math.FloatBetween(0.96, 1.06)
        );
      }

      const guideCoin = this.coins.create(gapCenter, rowY, 'coin') as Phaser.Physics.Arcade.Image;
      guideCoin.setScale(0.58).setDepth(3).setData({ rate: 1, spin: 0, animType: 'coin', baseScale: 0.58, animPhase: row * 0.7 });
      guideCoin.body!.setCircle(22);
    }

    const alert = this.add.text(W / 2, 265, '⚠  ASTEROIDBÄLTE  ⚠', {
      fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: '34px', color: '#fff2a8',
      backgroundColor: '#5b2039dd', padding: { x: 24, y: 12 }, stroke: '#2a1024', strokeThickness: 5
    }).setOrigin(0.5).setDepth(35).setScale(0.65).setAlpha(0);
    this.tweens.add({ targets: alert, alpha: 1, scale: 1, duration: 330, ease: 'Back.out', hold: 1050, yoyo: true, onComplete: () => alert.destroy() });
  }

  private attachBalloonFlame(o: Phaser.Physics.Arcade.Image, scale: number): void {
    const halo = this.add.ellipse(0, 3, 28, 34, 0xffa532, 0.22);
    const fire = this.add.graphics();
    fire.fillStyle(0xff6b2c, 0.95).fillTriangle(-9, 12, 9, 12, 0, -17);
    fire.fillStyle(0xffed73, 0.98).fillTriangle(-5, 10, 5, 10, 0, -10);
    fire.fillStyle(0xd9fbff, 0.9).fillTriangle(-2, 8, 2, 8, 0, -4);
    const detail = this.add.container(o.x, o.y, [halo, fire]).setDepth(5).setScale(scale * 0.7);
    detail.setData('fire', fire);
    o.setData('animatedDetail', detail);
    o.once('destroy', () => detail.destroy(true));
  }

  private attachSatelliteSignal(o: Phaser.Physics.Arcade.Image, scale: number): void {
    const dot = this.add.circle(0, 0, 6, 0xff684f).setStrokeStyle(2, 0xffe0a3);
    const rings = [0, 1, 2].map(() => this.add.circle(0, 0, 11).setStrokeStyle(3, 0x72efff, 0.8));
    const detail = this.add.container(o.x, o.y, [...rings, dot]).setDepth(5).setScale(scale);
    detail.setData({ dot, rings });
    o.setData('animatedDetail', detail);
    o.once('destroy', () => detail.destroy(true));
  }

  private spawnCoinPattern(): void {
    const count = Phaser.Math.Between(6, 10);
    const center = Phaser.Math.Between(150, W - 150);
    const wave = Math.random() < 0.55;
    for (let i = 0; i < count; i++) {
      const x = Phaser.Math.Clamp(center + (wave ? Math.sin(i * 0.8) * 115 : (i - count / 2) * 44), 55, W - 55);
      const c = this.coins.create(x, -70 - i * 70, 'coin') as Phaser.Physics.Arcade.Image;
      c.setScale(0.66).setDepth(3).setData({ rate: 1, spin: 0, animType: 'coin', baseScale: 0.66, animPhase: i * 0.62 });
      c.body!.setCircle(22);
    }
  }

  private spawnPower(forcedType?: Power, startY = -120, frozen = false): void {
    const type = forcedType ?? Phaser.Utils.Array.GetRandom<Power>(['shield', 'paint', 'boost', 'slow']);
    const p = this.powers.create(Phaser.Math.Between(100, W - 100), startY, `power-${type}`) as Phaser.Physics.Arcade.Image;
    const sizes: Record<Power, number> = { shield: 132, paint: 126, boost: 140, slow: 134 };
    const spins: Record<Power, number> = { shield: 5, paint: -7, boost: 6, slow: -5 };
    p.setDisplaySize(sizes[type], sizes[type]).setDepth(4);
    p.setData({
      rate: frozen ? 0 : 0.92, spin: spins[type], power: type, animType: 'power',
      baseScale: p.scaleX, animPhase: Phaser.Math.FloatBetween(0, Math.PI * 2)
    });
    const radius = p.width * 0.34;
    p.body!.setCircle(radius, p.width * 0.16, p.height * 0.16);
    this.attachPowerHalo(p, type, sizes[type]);
  }

  private attachPowerHalo(p: Phaser.Physics.Arcade.Image, type: Power, size: number): void {
    const colors: Record<Power, number> = { shield: 0x59eaff, paint: 0xff5ba8, boost: 0xffcf52, slow: 0xa990ff };
    const halo = this.add.circle(p.x, p.y, size * 0.47, colors[type], 0.2)
      .setStrokeStyle(3, colors[type], 0.52).setDepth(3);
    p.setData('powerHalo', halo);
    p.once('destroy', () => { if (halo.active) halo.destroy(); });
  }

  private collectCoin(c: Phaser.Physics.Arcade.Image): void {
    if (!c.active) return;
    c.disableBody(true, true); this.coinCount++; this.score += this.activeUntil.boost > this.time.now ? 50 : 25; AudioBus.coin();
    const burst = this.add.particles(c.x, c.y, 'spark', { speed: { min: 60, max: 210 }, lifespan: 420, quantity: 8, scale: { start: 0.45, end: 0 }, tint: [0xffd95b, 0xffffff] }).setDepth(20);
    this.time.delayedCall(450, () => burst.destroy());
  }

  private collectPower(p: Phaser.Physics.Arcade.Image): void {
    if (!p.active) return;
    const type = p.getData('power') as Power;
    const halo = p.getData('powerHalo') as Phaser.GameObjects.Arc | undefined;
    if (halo?.active) halo.destroy();
    p.disableBody(true, true); AudioBus.power(); this.score += 150;
    if (type === 'paint') {
      this.paintAmmo = 20;
      this.updatePaintUi();
    } else {
      const durations: Record<Exclude<Power, 'paint'>, number> = { shield: 18000, boost: 8500, slow: 7500 };
      this.activeUntil[type] = this.time.now + durations[type];
    }
    const labels: Record<Power, string> = { shield: 'SKÖLD AKTIVERAD!', paint: 'PAINTBALL: 20 SKOTT!', boost: 'MYNTMAGNET!', slow: 'TIDSBUBBLA!' };
    this.powerText.setText(labels[type]).setAlpha(1).setScale(0.7);
    this.tweens.add({ targets: this.powerText, scale: 1, duration: 350, ease: 'Back.out', hold: 900, alpha: 0, onComplete: () => this.powerText.setAlpha(0) });
  }

  private hitObstacle(o: Phaser.Physics.Arcade.Image): void {
    if (!o.active || this.time.now < this.invulnerableUntil) return;
    const kind = String(o.getData('kind') ?? 'asteroid');
    const hitWidth: Record<string, number> = { bird: 70, plane: 112, jumbo: 190, balloon: 94, satellite: 105, ufo: 112 };
    const hitHeight: Record<string, number> = { bird: 82, plane: 80, jumbo: 112, balloon: 142, satellite: 88, ufo: 80 };
    const halfWidth = kind === 'asteroid' ? o.displayWidth * 0.42 : (hitWidth[kind] ?? 82);
    const halfHeight = kind === 'asteroid' ? o.displayHeight * 0.42 : (hitHeight[kind] ?? 92);
    if (Math.abs(o.x - this.player.x) > halfWidth || Math.abs(o.y - this.player.y) > halfHeight) return;
    if (this.oliverMode) {
      const burst = this.add.particles(o.x, o.y, 'spark', {
        speed: { min: 80, max: 260 }, lifespan: 480, quantity: 14,
        scale: { start: 0.42, end: 0 }, tint: [0x76f1cc, 0xa9f7ff, 0xffffff]
      }).setDepth(20);
      this.time.delayedCall(520, () => burst.destroy());
      this.invulnerableUntil = this.time.now + 260;
      o.destroy();
      AudioBus.power();
      this.cameras.main.flash(120, 80, 230, 190, false);
      return;
    }
    if (this.activeUntil.shield > this.time.now) {
      const burst = this.add.particles(o.x, o.y, 'spark', { speed: { min: 90, max: 300 }, lifespan: 520, quantity: 18, scale: { start: 0.48, end: 0 }, tint: [0x79efff, 0xffffff] }).setDepth(20);
      this.time.delayedCall(560, () => burst.destroy());
      this.activeUntil.shield = 0; o.destroy(); AudioBus.power();
      this.cameras.main.flash(180, 90, 230, 255, false); return;
    }
    const impactX = o.x, impactY = o.y; o.destroy(); this.lives--; this.invulnerableUntil = this.time.now + 2600; AudioBus.hit();
    const impact = this.add.particles(impactX, impactY, 'spark', { speed: { min: 80, max: 260 }, lifespan: 480, quantity: 14, scale: { start: 0.4, end: 0 }, tint: [0xff704f, 0xffd96a, 0xffffff] }).setDepth(20);
    this.time.delayedCall(520, () => impact.destroy());
    this.cameras.main.shake(270, 0.012); this.cameras.main.flash(150, 255, 70, 70, false);
    this.tweens.add({ targets: this.player, alpha: 0.2, duration: 100, yoyo: true, repeat: 7, onComplete: () => this.player.setAlpha(1) });
    if (this.lives <= 0) this.gameOver();
  }

  private firePaint(): boolean {
    if (this.phase !== 'playing' || this.paused || this.paintAmmo <= 0) return false;
    this.paintAmmo--;
    this.updatePaintUi();
    const p = this.projectiles.create(this.player.x, this.player.y - 130, 'paintball') as Phaser.Physics.Arcade.Image;
    p.setScale(0.86).setData({ vx: 0, vy: -780 }).setDepth(9);
    const flash = this.add.circle(this.player.x, this.player.y - 142, 16, this.paintAmmo % 2 === 0 ? 0xff5aa6 : 0x59eee6, 0.82).setDepth(10);
    this.tweens.add({ targets: flash, scale: 2.2, alpha: 0, duration: 130, onComplete: () => flash.destroy() });
    AudioBus.paint();
    return true;
  }

  private paintHit(p: Phaser.Physics.Arcade.Image, o: Phaser.Physics.Arcade.Image): void {
    if (!p.active || !o.active) return;
    const x = o.x, y = o.y; p.destroy(); o.destroy(); this.score += 75;
    const burst = this.add.particles(x, y, 'paintball', { speed: { min: 80, max: 270 }, lifespan: 650, quantity: 16, scale: { start: 0.55, end: 0 }, tint: [0xff4fa0, 0x42e8e0, 0xffd34c] }).setDepth(18);
    this.time.delayedCall(700, () => burst.destroy());
  }

  private magnetCoins(dt: number): void {
    this.coins.children.each(child => {
      const c = child as Phaser.Physics.Arcade.Image;
      const d = Phaser.Math.Distance.Between(c.x, c.y, this.player.x, this.player.y);
      if (d < 270) { c.x = Phaser.Math.Linear(c.x, this.player.x, dt * 4.5); c.y = Phaser.Math.Linear(c.y, this.player.y, dt * 4.5); }
      return true;
    });
  }

  private updateWorld(dt: number): void {
    const stops = [0x83d5e6, 0x35a7cc, 0x24588d, 0x292750, 0x08142f];
    const t = this.altitude / 100 * (stops.length - 1); const index = Math.min(stops.length - 2, Math.floor(t));
    const a = Phaser.Display.Color.ValueToColor(stops[index]!); const b = Phaser.Display.Color.ValueToColor(stops[index + 1]!);
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(a, b, 100, (t % 1) * 100);
    this.backdrop.setFillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
    const spaceAlpha = Phaser.Math.Clamp((this.altitude - 42) / 28, 0, 1);
    this.stars.forEach(s => {
      s.alpha = spaceAlpha * Number(s.getData('baseAlpha') ?? 0.8);
      s.y += s.getData('rate') * dt;
      if (s.y > this.viewHeight + 10) { s.y = -10; s.x = Phaser.Math.Between(5, W - 5); }
    });
    const cloudAlpha = Phaser.Math.Clamp(1 - (this.altitude - 28) / 14, 0, 1);
    this.clouds.forEach(cloud => {
      cloud.alpha = cloudAlpha * Number(cloud.getData('baseAlpha') ?? 0.6);
      cloud.y += cloud.getData('rate') * dt;
      cloud.x += Number(cloud.getData('drift') ?? 0) * dt;
      if (cloud.y > this.viewHeight + 220) {
        cloud.y = -220;
        cloud.x = Phaser.Math.Between(-150, W + 150);
      }
    });
    if (this.altitude > 78 && this.phase === 'playing') {
      const moonProgress = Phaser.Math.Clamp((this.altitude - 78) / 22, 0, 1);
      this.moon.setVisible(true).setAlpha(1);
      this.moon.y = Phaser.Math.Linear(-370, 160, moonProgress);
      this.moon.setScale(Phaser.Math.Linear(0.38, 1, moonProgress));
    }
  }

  private updateHud(): void {
    this.hudHearts.setText(Array.from({ length: 3 }, (_, i) => i < this.lives ? '♥' : '♡').join(' '));
    this.hudCoins.setText(`●  ${this.coinCount}`); this.hudScore.setText(Math.floor(this.campaignScore + this.score).toLocaleString('sv-SE'));
    this.hudAltitude.setText(`${this.getAltitudeKm().toLocaleString('sv-SE')} km`); this.progressFill.width = 588 * this.altitude / 100;
  }

  private getZone(): number {
    const zone = ZONE_PROGRESS_LIMITS.findIndex(limit => this.altitude < limit);
    return zone < 0 ? ZONE_PROGRESS_LIMITS.length - 1 : zone;
  }

  private getAltitudeKm(): number {
    const matchingEnd = ALTITUDE_PROGRESS_POINTS.findIndex((progress, index) => index > 0 && this.altitude < progress);
    const endIndex = matchingEnd < 0 ? ALTITUDE_PROGRESS_POINTS.length - 1 : matchingEnd;
    const progressStart = ALTITUDE_PROGRESS_POINTS[endIndex - 1]!;
    const progressEnd = ALTITUDE_PROGRESS_POINTS[endIndex]!;
    const altitudeStart = ALTITUDE_KM_POINTS[endIndex - 1]!;
    const altitudeEnd = ALTITUDE_KM_POINTS[endIndex]!;
    const zoneProgress = Phaser.Math.Clamp((this.altitude - progressStart) / (progressEnd - progressStart), 0, 1);
    return Math.round(Phaser.Math.Linear(altitudeStart, altitudeEnd, zoneProgress));
  }

  private showZone(zone: number): void {
    this.currentZone = zone;
    this.zoneText.setText(ZONE_LABELS[zone]!).setAlpha(0).setY(170);
    this.tweens.add({ targets: this.zoneText, alpha: 1, y: 190, duration: 500, ease: 'Back.out', hold: 1200, onComplete: () => this.tweens.add({ targets: this.zoneText, alpha: 0, duration: 450 }) });
  }

  private togglePause(): void {
    if (this.phase !== 'playing') return;
    this.paused = !this.paused;
    this.leftHeld = false;
    this.rightHeld = false;
    if (this.paused) {
      this.physics.world.pause(); this.tweens.pauseAll();
      const shade = this.add.rectangle(W / 2, this.viewHeight / 2, W, this.viewHeight, 0x020817, 0.8).setDepth(50);
      const title = this.add.text(W / 2, 510, 'PAUS', { fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: '72px', color: '#fff1b4' }).setOrigin(0.5).setDepth(51);
      const resume = this.add.text(W / 2, 650, 'FORTSÄTT', { fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: '34px', color: '#ffffff', backgroundColor: '#e96d50', padding: { x: 50, y: 20 } }).setOrigin(0.5).setDepth(51).setInteractive({ useHandCursor: true });
      const quit = this.add.text(W / 2, 750, 'TILL MENYN', { fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: '27px', color: '#bceaf1' }).setOrigin(0.5).setDepth(51).setInteractive({ useHandCursor: true });
      this.pauseLayer = this.add.container(0, 0, [shade, title, resume, quit]).setDepth(50);
      resume.on('pointerup', () => this.togglePause()); quit.on('pointerup', () => this.returnToMenu());
    } else {
      this.physics.world.resume(); this.tweens.resumeAll(); this.pauseLayer?.destroy(true); this.pauseLayer = undefined;
    }
  }

  private gameOver(): void {
    if (this.phase !== 'playing') return;
    this.phase = 'gameover'; (this.player.body as Phaser.Physics.Arcade.Body).enable = false;
    this.leftHeld = false; this.rightHeld = false;
    this.hudSetVisible(false);
    this.zoneText.setAlpha(0); this.powerText.setAlpha(0);
    this.exhaust?.stop();
    this.tweens.add({ targets: this.player, angle: 28, y: this.viewHeight + 280, x: `+=${Phaser.Math.Between(-170, 170)}`, duration: 1300, ease: 'Quad.in' });
    this.time.delayedCall(700, () => this.showResult(false));
  }

  private startOutro(): void {
    if (this.phase !== 'playing') return;
    this.phase = 'outro'; (this.player.body as Phaser.Physics.Arcade.Body).enable = false;
    this.leftHeld = false; this.rightHeld = false;
    [this.obstacles, this.coins, this.powers, this.projectiles].forEach(g => g.clear(true, true));
    this.hudSetVisible(false);
    this.zoneText.setAlpha(0); this.powerText.setAlpha(0);
    this.shieldBubble.setVisible(false); this.shieldOrbit.setVisible(false);
    this.rocketSwayTween?.stop();
    this.tweens.killTweensOf(this.player);
    AudioBus.tone(260, 0.6, 'triangle', 0.04, 480);
    this.moon.setVisible(true).setAlpha(1).setDepth(-17);
    this.tweens.add({ targets: this.moon, y: 410, scale: 1.52, duration: 1350, ease: 'Sine.inOut' });
    this.tweens.add({
      targets: this.player, x: 150, y: 305, scale: 0.62, angle: -42,
      duration: 1350, ease: 'Sine.inOut', onComplete: () => this.flyPastMoon()
    });
  }

  private flyPastMoon(): void {
    AudioBus.tone(330, 0.55, 'triangle', 0.035, 620);
    this.tweens.add({
      targets: this.player,
      x: W + 230,
      y: 65,
      angle: 62,
      scale: 0.46,
      duration: 920,
      ease: 'Cubic.in',
      onComplete: () => {
        this.player.setVisible(false);
        this.exhaust?.stop();
        this.beginLunarDescent();
      }
    });
  }

  private beginLunarDescent(): void {
    this.landingScene = this.add.image(W / 2, this.viewHeight / 2, 'moon-landing')
      .setDisplaySize(W, this.viewHeight).setDepth(-18).setAlpha(0);
    this.tweens.add({ targets: this.landingScene, alpha: 1, duration: 760, ease: 'Sine.inOut' });
    this.tweens.add({
      targets: this.moon, alpha: 0, scale: 1.75, duration: 760, ease: 'Sine.inOut',
      onComplete: () => {
        this.moon.setVisible(false);
        this.player.setPosition(W + 180, 245).setAngle(-52).setScale(0.54).setVisible(true);
        if (!this.rocketSprite.anims.isPlaying) this.rocketSprite.play('rocket-flight');
        this.engineGlow.setVisible(true);
        this.exhaust?.start();
        AudioBus.tone(210, 0.75, 'sawtooth', 0.022, 130);
        this.tweens.add({
          targets: this.player, x: 505, y: 475, angle: 22, scale: 0.76,
          duration: 1650, ease: 'Cubic.inOut', onComplete: () => this.finalLandingBurn()
        });
      }
    });
  }

  private finalLandingBurn(): void {
    this.rocketSprite.anims.timeScale = 0.72;
    const dust = this.add.particles(W / 2, 825, 'moon-dust', {
      speedX: { min: -190, max: 190 }, speedY: { min: -105, max: -20 },
      lifespan: { min: 650, max: 1250 }, frequency: 70, quantity: 3,
      gravityY: 55, scale: { start: 0.62, end: 0.08 }, alpha: { start: 0.62, end: 0 },
      tint: [0xd6deea, 0xf2eee0, 0x9aa9bc], blendMode: 'SCREEN'
    }).setDepth(4);
    AudioBus.tone(150, 1.1, 'sawtooth', 0.025, 82);
    this.tweens.add({
      targets: this.player, x: W / 2, y: 690, angle: 0, scale: 0.84,
      duration: 1250, ease: 'Sine.out', onComplete: () => {
        dust.explode(42);
        dust.stop();
        this.rocketSprite.stop().setTexture('rocket-game-idle').setY(66);
        this.engineGlow.setVisible(false);
        this.cameras.main.shake(240, 0.0045);
        AudioBus.tone(92, 0.28, 'triangle', 0.05, 58);
        this.tweens.add({
          targets: this.player, y: 700, scaleY: 0.81, duration: 190, yoyo: true,
          ease: 'Quad.out', onComplete: () => {
            this.player.setScale(0.84).setY(690);
            this.time.delayedCall(800, () => dust.destroy());
            this.time.delayedCall(320, () => this.moonLanding());
          }
        });
      }
    });
  }

  private moonLanding(): void {
    this.exhaust?.stop();
    this.engineGlow.setVisible(false);
    this.rocketSprite.stop().setTexture('rocket-game-idle').setY(66);
    this.tweens.add({ targets: this.portraits, alpha: 0, duration: 300 });

    const hatchGlow = this.add.circle(this.player.x + 57, this.player.y + 8, 25, 0xb9faff, 0.72)
      .setStrokeStyle(4, 0xffffff, 0.9).setDepth(7).setScale(0.25);
    this.tweens.add({ targets: hatchGlow, scale: 1.7, alpha: 0, duration: 850, ease: 'Quad.out', onComplete: () => hatchGlow.destroy() });

    const victory = this.add.text(W / 2, 145, 'VI ÄR PÅ MÅNEN!', {
      fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: '50px', color: '#fff0a3',
      stroke: '#182947', strokeThickness: 9
    }).setOrigin(0.5).setDepth(24).setAlpha(0).setScale(0.72);
    this.tweens.add({ targets: victory, alpha: 1, scale: 1, duration: 520, ease: 'Back.out', hold: 3150, yoyo: true, onComplete: () => victory.destroy() });

    const exits = [
      { id: 'johannes' as CrewId, x: 235, y: 945, scale: 0.42, delay: 0, arc: 150 },
      { id: 'leo' as CrewId, x: 365, y: 980, scale: 0.4, delay: 430, arc: 125 },
      { id: 'oliver' as CrewId, x: 505, y: 935, scale: 0.37, delay: 860, arc: 165 }
    ];
    exits.forEach((exit, index) => this.time.delayedCall(exit.delay, () => this.launchCrewCelebration(exit, index)));
    this.time.delayedCall(5300, () => this.showResult(true));
  }

  private launchCrewCelebration(
    exit: { id: CrewId; x: number; y: number; scale: number; delay: number; arc: number },
    index: number
  ): void {
    const startX = this.player.x + 54;
    const startY = this.player.y + 28;
    const sprite = this.add.sprite(startX, startY, `crew-cheer-${exit.id}-0`)
      .setOrigin(0.5, 1).setDepth(10 + index).setScale(exit.scale * 0.24).setAlpha(0);
    sprite.play(`crew-cheer-${exit.id}`);
    sprite.anims.setProgress(index * 0.22);
    const motion = { progress: 0 };
    this.tweens.add({
      targets: motion, progress: 1, duration: 1280, ease: 'Sine.inOut',
      onStart: () => sprite.setAlpha(1),
      onUpdate: () => {
        const t = motion.progress; const inv = 1 - t;
        const controlX = Phaser.Math.Linear(startX, exit.x, 0.48) + (index - 1) * 28;
        const controlY = Math.min(startY, exit.y) - exit.arc;
        sprite.x = inv * inv * startX + 2 * inv * t * controlX + t * t * exit.x;
        sprite.y = inv * inv * startY + 2 * inv * t * controlY + t * t * exit.y;
        sprite.setScale(Phaser.Math.Linear(exit.scale * 0.24, exit.scale, t));
      },
      onComplete: () => {
        sprite.setPosition(exit.x, exit.y).setScale(exit.scale);
        this.tweens.add({
          targets: sprite, y: exit.y - (34 + index * 5), duration: 680 + index * 70,
          ease: 'Sine.inOut', yoyo: true, repeat: -1, repeatDelay: 170 + index * 45
        });
      }
    });
  }

  private async resolveHighscoreRunId(): Promise<string | null> {
    const run = await this.highscoreRunPromise;
    if (run?.run_id) {
      this.highscoreRunId = run.run_id;
      this.campaignRunId = run.run_id;
    }
    return this.highscoreRunId ?? this.campaignRunId;
  }

  private readonly handleAndroidBack = (event: Event): void => {
    if (!this.scene.isActive()) return;
    event.preventDefault();
    this.returnToMenu();
  };

  private readonly handleWebBack = (): void => {
    if (!this.scene.isActive()) return;
    this.webHistoryEntryActive = false;
    this.openMenuScene();
  };

  private returnToMenu(): void {
    if (!this.scene.isActive()) return;
    if (this.webHistoryEntryActive) {
      this.webHistoryEntryActive = false;
      window.history.back();
      return;
    }
    this.openMenuScene();
  }

  private openMenuScene(): void {
    if (this.paused) {
      this.physics.world.resume();
      this.tweens.resumeAll();
      this.paused = false;
    }
    this.scene.start('Menu');
  }

  private showResult(won: boolean): void {
    const levelScore = Math.floor(this.score + (won ? this.lives * 500 + this.coinCount * 10 : 0));
    const totalScore = this.campaignScore + levelScore;
    const totalDurationMs = this.campaignDurationMs + this.flightDurationMs;
    const totalCoins = this.campaignCoins + this.coinCount;
    const terminal = !won || this.currentLevel === MAX_LEVEL;
    const completedJourney = won && this.currentLevel === MAX_LEVEL;
    const nextLevel = toGameLevel(this.currentLevel + 1);

    const shade = this.add.rectangle(W / 2, this.viewHeight / 2, W, this.viewHeight, 0x020817, 0.82).setDepth(60);
    const panel = this.add.rectangle(W / 2, 640, 620, 900, 0x102b4c, 0.99)
      .setStrokeStyle(6, won ? 0xffdf74 : 0x72dbe7).setDepth(61);
    const title = completedJourney ? 'HELA RYMDRESAN KLAR!' : won ? `NIVÅ ${this.currentLevel} KLAR!` : `SLUT PÅ NIVÅ ${this.currentLevel}`;
    const subtitle = won
      ? this.currentLevel < MAX_LEVEL
        ? `Nästa nivå väntar – poängen och kvarvarande hjärtan följer med!`
        : 'Ni klarade alla fem nivåerna!'
      : `Ni nådde ${Math.floor(this.altitude)} % av den här etappen`;
    this.add.text(W / 2, 255, title, {
      fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: completedJourney ? '44px' : '50px',
      color: won ? '#fff0a3' : '#bceff5', stroke: '#173653', strokeThickness: 8
    }).setOrigin(0.5).setDepth(62);
    this.add.text(W / 2, 345, subtitle, {
      fontFamily: 'Trebuchet MS', fontSize: '24px', color: '#ffffff', align: 'center', wordWrap: { width: 540 }
    }).setOrigin(0.5).setDepth(62);
    this.add.text(250, 465, `NIVÅPOÄNG\n${levelScore.toLocaleString('sv-SE')}`, {
      fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: '29px', color: '#bceff5', align: 'center', lineSpacing: 5
    }).setOrigin(0.5).setDepth(62);
    this.add.text(470, 465, `TOTALT\n${totalScore.toLocaleString('sv-SE')}`, {
      fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: '35px', color: '#fff1a6', align: 'center', lineSpacing: 3
    }).setOrigin(0.5).setDepth(62);
    this.add.text(W / 2, 575, `NIVÅ  ${this.currentLevel}     MYNT TOTALT  ${totalCoins}     HJÄRTAN  ${this.lives}`, {
      fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: '23px', color: '#ffffff', align: 'center'
    }).setOrigin(0.5).setDepth(62);

    if (!terminal) {
      if (this.oliverMode) this.add.text(W / 2, 660, 'OLIVERLÄGE  •  TRÄNING', {
        fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: '22px', color: '#91f0ce'
      }).setOrigin(0.5).setDepth(62);
      const next = this.add.text(W / 2, 790, 'NÄSTA NIVÅ', {
        fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: '32px', color: '#ffffff',
        backgroundColor: '#ed7052', padding: { x: 52, y: 19 }
      }).setOrigin(0.5).setDepth(62).setInteractive({ useHandCursor: true });
      const menu = this.add.text(W / 2, 900, 'TILL MENYN', {
        fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: '25px', color: '#b9eaf1'
      }).setOrigin(0.5).setDepth(62).setInteractive({ useHandCursor: true });
      next.on('pointerup', async () => {
        next.disableInteractive().setText('LADDAR NÄSTA NIVÅ…').setAlpha(0.75);
        const runId = await this.resolveHighscoreRunId();
        this.scene.restart({
          level: nextLevel,
          campaignScore: totalScore,
          campaignDurationMs: totalDurationMs,
          campaignCoins: totalCoins,
          campaignLives: this.lives,
          campaignRunId: runId,
          campaignApiStarted: this.campaignApiStarted,
        } satisfies GameSceneData);
      });
      menu.on('pointerup', () => this.returnToMenu());
      this.tweens.add({ targets: [shade, panel], alpha: { from: 0, to: 1 }, duration: 450 });
      return;
    }

    if (this.oliverMode) {
      this.add.text(W / 2, 750, 'OLIVERLÄGE  •  TRÄNINGSFÄRD\nPoängen sparas inte i topplistan', {
        fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: '25px', color: '#91f0ce',
        align: 'center', lineSpacing: 9, backgroundColor: '#143e43aa', padding: { x: 25, y: 18 }
      }).setOrigin(0.5).setDepth(62);
    } else {
      const nameInput = document.createElement('input');
      nameInput.className = 'highscore-name-input';
      nameInput.type = 'text';
      nameInput.maxLength = 15;
      nameInput.setAttribute('autocomplete', 'nickname');
      nameInput.autocapitalize = 'words';
      nameInput.spellcheck = false;
      nameInput.placeholder = 'DITT NAMN';
      nameInput.value = getPlayerName();
      nameInput.setAttribute('aria-label', 'Ditt namn i topplistan');
      nameInput.addEventListener('keydown', event => event.stopPropagation());
      this.add.dom(W / 2, 715, nameInput).setDepth(63);

      const saveStatus = this.add.text(W / 2, 870, '', {
        fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: '18px', color: '#9deff4', align: 'center',
        wordWrap: { width: 520 }
      }).setOrigin(0.5).setDepth(62);
      const save = this.add.text(W / 2, 800, 'SPARA', {
        fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: '24px', color: '#ffffff',
        backgroundColor: '#8b55b5', padding: { x: 34, y: 15 }
      }).setOrigin(0.5).setDepth(62).setInteractive({ useHandCursor: true });
      let saving = false;
      save.on('pointerup', async () => {
        if (saving) return;
        const name = sanitizePlayerName(nameInput.value);
        if (!name) {
          saveStatus.setText('SKRIV ETT NAMN FÖRST').setColor('#ffd27a');
          nameInput.focus();
          return;
        }
        saving = true;
        save.disableInteractive().setAlpha(0.62);
        nameInput.disabled = true;
        saveStatus.setText('SPARAR…').setColor('#bceaf1');
        try {
          const runId = await this.resolveHighscoreRunId();
          const result = await submitHighscore(runId, {
            name,
            score: totalScore,
            duration_ms: Math.max(1000, Math.round(totalDurationMs)),
            level: this.currentLevel,
            reached_moon: completedJourney,
            altitude: completedJourney ? 100 : Math.floor(this.altitude),
            coins: totalCoins,
            lives_remaining: this.lives,
            oliver_mode: false,
          });
          if (result.accepted) {
            save.setText('SPARAD!').setBackgroundColor('#278f78').setAlpha(1);
            saveStatus.setText(result.rank ? `GLOBAL PLACERING: ${result.rank}` : 'SPARAD I DEN GLOBALA TOPPLISTAN').setColor('#91f0ce');
          } else {
            throw new Error('Resultatet kunde inte sparas globalt.');
          }
        } catch {
          saving = false;
          nameInput.disabled = false;
          save.setText('SPARA').setBackgroundColor('#8b55b5').setAlpha(1).setInteractive({ useHandCursor: true });
          saveStatus.setText('KUNDE INTE SPARA GLOBALT • FÖRSÖK IGEN').setColor('#ffd27a');
        }
      });
    }

    const again = this.add.text(W / 2, 970, 'BÖRJA OM FRÅN NIVÅ 1', {
      fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: '31px', color: '#ffffff',
      backgroundColor: '#ed7052', padding: { x: 48, y: 18 }
    }).setOrigin(0.5).setDepth(62).setInteractive({ useHandCursor: true });
    const menu = this.add.text(W / 2, 1060, 'TILL MENYN', {
      fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: '25px', color: '#b9eaf1'
    }).setOrigin(0.5).setDepth(62).setInteractive({ useHandCursor: true });
    again.on('pointerup', () => this.scene.restart({ level: 1 } satisfies GameSceneData));
    menu.on('pointerup', () => this.returnToMenu());
    this.tweens.add({ targets: [shade, panel], alpha: { from: 0, to: 1 }, duration: 450 });
  }
}
