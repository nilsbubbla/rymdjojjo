import Phaser from 'phaser';
import { createGameTextures, createPortraits, createSpriteAnimations } from '../game/visuals';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload(): void {
    this.load.image('crew', 'assets/crew-master.png');
    this.load.image('crew-walk-johannes-sheet', 'assets/crew-walk-johannes-v3.png');
    this.load.image('crew-walk-leo-sheet', 'assets/crew-walk-leo-v3.png');
    this.load.image('crew-walk-oliver-sheet', 'assets/crew-walk-oliver-v3.png');
    this.load.image('crew-cheer-johannes-sheet', 'assets/crew-cheer-johannes-v2.png');
    this.load.image('crew-cheer-leo-sheet', 'assets/crew-cheer-leo-v2.png');
    this.load.image('crew-cheer-oliver-sheet', 'assets/crew-cheer-oliver-v2.png');
    this.load.image('rocket', 'assets/rocket.png');
    this.load.image('rocket-flames-sheet', 'assets/rocket-flames-v3.png');
    this.load.image('cloud-cumulus', 'assets/cloud-cumulus-v3.png');
    this.load.image('cloud-wispy', 'assets/cloud-wispy-v3.png');
    this.load.image('launch-site', 'assets/launch-site-v2.png');
    this.load.image('obstacle-bird', 'assets/obstacle-bird-v2.png');
    this.load.image('obstacle-bird-flap-sheet', 'assets/obstacle-bird-flap-v2.png');
    this.load.image('obstacle-plane-propeller-sheet', 'assets/obstacle-plane-propeller-v3.png');
    this.load.image('obstacle-balloon', 'assets/obstacle-balloon.png');
    this.load.image('obstacle-satellite', 'assets/obstacle-satellite.png');
    this.load.image('obstacle-ufo-sheet', 'assets/obstacle-ufo-v2.png');
    this.load.image('obstacle-jumbojet', 'assets/obstacle-jumbojet-v2.png');
    this.load.image('asteroid-pack-sheet', 'assets/asteroid-pack-v2.png');
    this.load.image('moon-disk', 'assets/moon-disk-v2.png');
    this.load.image('moon-landing', 'assets/moon-landing-v2.png');
    this.load.image('paintball-blaster', 'assets/paintball-blaster-v2.png');
    this.load.image('power-paint', 'assets/paintball-blaster-v2.png');
    this.load.image('power-shield', 'assets/power-shield-v2.png');
    this.load.image('power-boost', 'assets/power-magnet-v3.png');
    this.load.image('power-slow', 'assets/power-slow-v2.png');
    const bar = this.add.rectangle(360, 670, 400, 18, 0x203f63).setStrokeStyle(3, 0xffffff, 0.5);
    const fill = this.add.rectangle(162, 670, 0, 12, 0x4de3df).setOrigin(0, 0.5);
    this.add.text(360, 625, 'Packar rymdfärden…', { fontFamily: 'Trebuchet MS', fontSize: '26px', color: '#ffffff' }).setOrigin(0.5);
    this.load.on('progress', (p: number) => { fill.width = 396 * p; });
    this.load.on('complete', () => { bar.setFillStyle(0x193452); });
  }

  create(): void {
    createGameTextures(this);
    createPortraits(this);
    createSpriteAnimations(this);
    this.scene.start('Menu');
  }
}
