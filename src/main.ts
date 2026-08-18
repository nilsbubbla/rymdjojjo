import Phaser from 'phaser';
import './style.css';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';

const expandedPortrait = window.innerHeight / Math.max(1, window.innerWidth) > 1280 / 720;

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 720,
  height: 1280,
  backgroundColor: '#07132f',
  dom: { createContainer: true },
  render: { antialias: true, pixelArt: false, roundPixels: false },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false }
  },
  scale: {
    mode: expandedPortrait ? Phaser.Scale.EXPAND : Phaser.Scale.FIT,
    autoCenter: expandedPortrait ? Phaser.Scale.NO_CENTER : Phaser.Scale.CENTER_HORIZONTALLY,
    width: 720,
    height: 1280
  },
  input: { activePointers: 3 },
  scene: [BootScene, MenuScene, GameScene]
});
