import Phaser from 'phaser';
import { AudioBus } from '../game/AudioBus';
import { clearLegacyLocalScores, fetchLeaderboard } from '../game/HighscoreService';
import { toGameLevel } from '../game/levels';

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create(): void {
    clearLegacyLocalScores();
    const extraHeight = Math.max(0, this.scale.height - 1280);
    const viewHeight = 1280 + extraHeight;
    const crewWidth = Math.min(690, 620 + extraHeight * 0.18);
    const crewHeight = crewWidth * (373 / 560);
    const crewBottom = viewHeight - 2;
    const crewY = crewBottom - crewHeight / 2;
    const secondaryButtonY = crewBottom - crewHeight - 90;
    const startButtonY = secondaryButtonY - 95;
    const rocketY = 465 + (startButtonY - 680) * 0.45;
    this.drawSky();
    const crewGlow = this.add.ellipse(360, crewBottom - 80, crewWidth + 50, crewHeight * 0.46, 0x8bf4e2, 0.14);
    const crew = this.add.image(360, crewY, 'crew').setDisplaySize(crewWidth, crewHeight).setAlpha(0.98);
    const rocket = this.add.image(360, rocketY, 'rocket-idle').setDisplaySize(175, 263);
    this.tweens.add({ targets: rocket, y: rocketY + 10, angle: { from: -1.1, to: 1.1 }, duration: 1600, ease: 'Sine.inOut', yoyo: true, repeat: -1 });
    this.tweens.add({ targets: [crew, crewGlow], y: '-=5', duration: 1800, ease: 'Sine.inOut', yoyo: true, repeat: -1 });

    this.add.text(360, 178, 'RYMDRESAN', {
      fontFamily: 'Trebuchet MS', fontStyle: '900', fontSize: '86px', color: '#fff5cf', stroke: '#163050', strokeThickness: 13,
      shadow: { offsetX: 0, offsetY: 10, color: '#061327', blur: 14, fill: true }
    }).setOrigin(0.5);
    this.add.text(360, 262, '–  FRÅN JORDEN TILL MÅNEN  –', {
      fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: '23px', color: '#a9f7ff', letterSpacing: 2
    }).setOrigin(0.5);

    this.makeButton(360, startButtonY, 410, 84, 'STARTA FÄRDEN', 0xff6f50, () => {
      AudioBus.unlock(); AudioBus.tone(440, 0.14, 'triangle', 0.05, 440);
      this.cameras.main.fadeOut(300, 7, 19, 47);
      this.time.delayedCall(310, () => this.scene.start('Game', { level: 1 }));
    });
    this.makeButton(215, secondaryButtonY, 260, 62, 'INSTÄLLNINGAR', 0x1989a6, () => this.showSettings());
    this.makeButton(505, secondaryButtonY, 260, 62, 'TOPPLISTA', 0x8b55b5, () => this.showLeaderboard());

    this.add.rectangle(106, 62, 182, 66, 0x071832, 0.72).setStrokeStyle(2, 0xffffff, 0.16);
    this.add.circle(47, 62, 28, 0x0e2947, 1).setStrokeStyle(3, 0xffd76b, 0.92);
    this.add.image(47, 62, 'portrait-johannes').setDisplaySize(52, 52);
    this.add.text(81, 41, 'BÄSTA', { fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: '14px', color: '#9deff4', letterSpacing: 1 });
    const bestScore = this.add.text(81, 57, '…', { fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: '25px', color: '#fff1a6' });
    void fetchLeaderboard().then(payload => {
      if (!this.scene.isActive()) return;
      const leader = payload.entries.find(entry => entry.rank === 1) ?? payload.entries[0];
      bestScore.setText(leader ? leader.score.toLocaleString('sv-SE') : '—');
    });
    this.cameras.main.fadeIn(400, 7, 19, 47);
    const testParams = new URLSearchParams(window.location.search);
    if (import.meta.env.DEV && (testParams.has('testScene') || testParams.has('testAltitude'))) {
      const testLevel = toGameLevel(testParams.get('testLevel') || 1);
      this.time.delayedCall(80, () => this.scene.start('Game', { level: testLevel }));
    }
  }

  private drawSky(): void {
    const viewHeight = Math.max(1280, this.scale.height);
    const extraHeight = viewHeight - 1280;
    const colors = [0x06142f, 0x0c2f58, 0x155e85, 0x52bed0, 0xf3a660];
    const rows = Math.ceil(viewHeight / 20);
    for (let i = 0; i < rows; i++) {
      const t = i / Math.max(1, rows - 1);
      const segment = t * (colors.length - 1);
      const a = colors[Math.floor(segment)]!;
      const b = colors[Math.min(colors.length - 1, Math.ceil(segment))]!;
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(a), Phaser.Display.Color.ValueToColor(b), 100, (segment % 1) * 100);
      this.add.rectangle(360, i * 20 + 10, 720, 21, Phaser.Display.Color.GetColor(c.r, c.g, c.b));
    }
    for (let i = 0; i < 48; i++) {
      const s = this.add.circle(Phaser.Math.Between(16, 704), Phaser.Math.Between(20, 610), Phaser.Math.Between(1, 3), 0xffffff, Phaser.Math.FloatBetween(0.3, 0.9));
      this.tweens.add({ targets: s, alpha: { from: 0.25, to: 1 }, duration: Phaser.Math.Between(700, 1800), yoyo: true, repeat: -1 });
    }
    this.add.image(105, 740, 'cloud-cumulus').setDisplaySize(360, 203).setAlpha(0.68);
    this.add.image(625, 785, 'cloud-wispy').setDisplaySize(350, 116).setAlpha(0.58);
    this.add.image(95, 1195 + extraHeight, 'cloud-wispy').setDisplaySize(420, 139).setAlpha(0.34);
    this.add.image(625, 1225 + extraHeight, 'cloud-cumulus').setDisplaySize(410, 231).setAlpha(0.28).setFlipX(true);
  }

  private makeButton(x: number, y: number, w: number, h: number, label: string, color: number, action: () => void): void {
    const shadow = this.add.graphics().fillStyle(0x061329, 0.72).fillRoundedRect(-w / 2, -h / 2 + 9, w, h, 23);
    const face = this.add.graphics().fillStyle(color, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 23).lineStyle(4, 0xffffff, 0.84).strokeRoundedRect(-w / 2, -h / 2, w, h, 23);
    const sheen = this.add.graphics().fillStyle(0xffffff, 0.18).fillRoundedRect(-w / 2 + 12, -h / 2 + 9, w - 24, 13, 7);
    const text = this.add.text(0, 0, label, { fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: `${h * 0.36}px`, color: '#ffffff', stroke: '#18314f', strokeThickness: 5 }).setOrigin(0.5);
    const hit = this.add.zone(0, 0, w, h).setInteractive({ useHandCursor: true });
    const button = this.add.container(x, y, [shadow, face, sheen, text, hit]);
    hit.on('pointerover', () => this.tweens.add({ targets: button, scale: 1.035, duration: 90 }));
    hit.on('pointerout', () => this.tweens.add({ targets: button, scale: 1, y, duration: 90 }));
    hit.on('pointerdown', () => { button.y = y + 5; shadow.alpha = 0.3; });
    hit.on('pointerup', () => { button.y = y; shadow.alpha = 1; action(); });
  }

  private showSettings(): void {
    const viewHeight = Math.max(1280, this.scale.height);
    const shade = this.add.rectangle(360, viewHeight / 2, 720, viewHeight, 0x020916, 0.88).setInteractive();
    const panel = this.add.rectangle(360, 600, 620, 720, 0x102b4c, 0.99).setStrokeStyle(5, 0x7ae7ec);
    const title = this.add.text(360, 300, 'INSTÄLLNINGAR', {
      fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: '46px', color: '#fff2b8',
      stroke: '#173653', strokeThickness: 7
    }).setOrigin(0.5);
    const layer = this.add.container(0, 0, [shade, panel, title]).setDepth(50);

    const addToggle = (
      y: number, icon: string, label: string,
      getEnabled: () => boolean, setEnabled: (enabled: boolean) => void
    ): void => {
      const row = this.add.rectangle(360, y, 548, 112, 0x071c35, 0.75).setStrokeStyle(2, 0xffffff, 0.1);
      const iconText = this.add.text(118, y, icon, { fontSize: '42px' }).setOrigin(0.5);
      const labelText = this.add.text(165, y, label, {
        fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: '26px', color: '#ffffff'
      }).setOrigin(0, 0.5);
      const toggle = this.add.text(585, y, '', {
        fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: '20px', color: '#ffffff',
        padding: { x: 17, y: 12 }
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      const refresh = (): void => {
        const enabled = getEnabled();
        toggle.setText(enabled ? 'PÅ' : 'AV').setBackgroundColor(enabled ? '#258f77' : '#5e6975');
      };
      toggle.on('pointerup', () => { setEnabled(!getEnabled()); refresh(); });
      refresh();
      layer.add([row, iconText, labelText, toggle]);
    };

    addToggle(430, '🧑‍🚀', 'OLIVERLÄGE',
      () => localStorage.getItem('rymdjojjo-oliver-mode') === '1',
      enabled => localStorage.setItem('rymdjojjo-oliver-mode', enabled ? '1' : '0'));
    addToggle(565, '🔊', 'LJUDEFFEKTER',
      () => !AudioBus.muted, enabled => AudioBus.setEffectsEnabled(enabled));
    addToggle(700, '♫', 'MUSIK',
      () => AudioBus.musicEnabled, enabled => AudioBus.setMusicEnabled(enabled));

    const close = this.add.text(360, 860, 'KLAR', {
      fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: '29px', color: '#ffffff',
      backgroundColor: '#ef6d50', padding: { x: 55, y: 18 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    close.on('pointerup', () => layer.destroy(true));
    layer.add(close);
  }

  private showLeaderboard(): void {
    const viewHeight = Math.max(1280, this.scale.height);
    const shade = this.add.rectangle(360, viewHeight / 2, 720, viewHeight, 0x020916, 0.9).setInteractive();
    const panel = this.add.rectangle(360, 640, 630, 1030, 0x102b4c, 0.99).setStrokeStyle(5, 0xa985e4);
    const title = this.add.text(360, 190, 'RYMDENS TOPP 10', {
      fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: '46px', color: '#fff2b8',
      stroke: '#173653', strokeThickness: 7
    }).setOrigin(0.5);
    const header = this.add.text(360, 285, 'PLAC.   RYMDPILOT                 NIVÅ      POÄNG', {
      fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: '19px', color: '#9deff4'
    }).setOrigin(0.5);
    const status = this.add.text(360, 955, 'HÄMTAR TOPPLISTAN…', {
      fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: '21px', color: '#bceaf1'
    }).setOrigin(0.5);
    const close = this.add.text(360, 1090, 'STÄNG', {
      fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: '28px', color: '#ffffff',
      backgroundColor: '#e66d55', padding: { x: 48, y: 18 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const refresh = this.add.text(360, 1015, '↻  UPPDATERA', {
      fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: '22px', color: '#d8c9ff'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const layer = this.add.container(0, 0, [shade, panel, title, header, status, refresh, close]).setDepth(50);
    let rows: Phaser.GameObjects.GameObject[] = [];

    const load = async (): Promise<void> => {
      status.setText('HÄMTAR TOPPLISTAN…').setColor('#bceaf1');
      rows.forEach(row => row.destroy());
      rows = [];
      const payload = await fetchLeaderboard();
      if (!layer.active) return;
      if (!payload.entries.length) {
        status.setText(payload.unavailable ? 'DEN GLOBALA TOPPLISTAN KUNDE INTE HÄMTAS' : 'INGA RESULTAT ÄN')
          .setColor(payload.unavailable ? '#ffd27a' : '#bceaf1');
        return;
      }
      payload.entries.slice(0, 10).forEach((entry, index) => {
        const y = 340 + index * 57;
        const background = this.add.rectangle(360, y, 560, 49, index % 2 ? 0x0a203c : 0x183b5c, 0.68)
          .setStrokeStyle(1, 0xffffff, 0.08);
        const medal = index === 0 ? '#ffdf70' : index === 1 ? '#dce9ef' : index === 2 ? '#e6a46d' : '#ffffff';
        const rank = this.add.text(102, y, `${index + 1}.`, {
          fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: '24px', color: medal
        }).setOrigin(0, 0.5);
        const name = this.add.text(160, y, entry.name, {
          fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: '23px', color: '#ffffff'
        }).setOrigin(0, 0.5).setFixedSize(240, 35);
        const level = this.add.text(440, y, `N${entry.level}${entry.reached_moon ? ' ★' : ''}`, {
          fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: '21px', color: '#9deff4'
        }).setOrigin(0.5);
        const score = this.add.text(620, y, entry.score.toLocaleString('sv-SE'), {
          fontFamily: 'Trebuchet MS', fontStyle: 'bold', fontSize: '23px', color: '#fff0a3'
        }).setOrigin(1, 0.5);
        rows.push(background, rank, name, level, score);
        layer.add([background, rank, name, level, score]);
      });
      status.setText('GLOBAL TOPPLISTA').setColor('#91f0ce');
    };

    refresh.on('pointerup', () => void load());
    close.on('pointerup', () => layer.destroy(true));
    void load();
  }
}
