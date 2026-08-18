import Phaser from 'phaser';

const tex = (scene: Phaser.Scene, key: string, width: number, height: number, draw: (g: Phaser.GameObjects.Graphics) => void) => {
  const g = scene.add.graphics();
  draw(g);
  g.generateTexture(key, width, height);
  g.destroy();
};

export function createGameTextures(scene: Phaser.Scene): void {
  tex(scene, 'spark', 24, 24, g => g.fillStyle(0xffffff).fillCircle(12, 12, 7));
  tex(scene, 'cloud', 240, 120, g => {
    g.fillStyle(0x92cfe6, 0.28).fillEllipse(120, 90, 220, 54);
    g.fillStyle(0xffffff, 0.92).fillCircle(64, 70, 42).fillCircle(112, 52, 56).fillCircle(166, 70, 46).fillEllipse(118, 86, 190, 55);
    g.fillStyle(0xd8f4ff, 0.75).fillEllipse(124, 94, 166, 30);
  });
  tex(scene, 'coin', 62, 62, g => {
    g.fillStyle(0x9a5b11).fillCircle(31, 34, 26);
    g.fillStyle(0xffd95d).fillCircle(31, 29, 26);
    g.lineStyle(5, 0xfff3aa).strokeCircle(31, 29, 20);
    g.fillStyle(0xffffff, 0.45).fillEllipse(23, 19, 9, 14);
    g.fillStyle(0xf59b27).fillTriangle(31, 15, 41, 31, 31, 45).fillTriangle(31, 15, 21, 31, 31, 45);
  });
  tex(scene, 'bird', 110, 58, g => {
    g.fillStyle(0x253552).fillEllipse(55, 34, 44, 22);
    g.fillTriangle(48, 34, 10, 8, 34, 40).fillTriangle(62, 34, 100, 8, 76, 40);
    g.fillStyle(0xffd45b).fillTriangle(76, 31, 102, 36, 78, 41);
    g.fillStyle(0xffffff).fillCircle(69, 29, 5); g.fillStyle(0x06142e).fillCircle(71, 29, 2);
  });
  tex(scene, 'plane', 170, 82, g => {
    g.fillStyle(0xf5f0df).fillRoundedRect(18, 32, 132, 25, 12).fillTriangle(148, 32, 166, 17, 154, 57);
    g.fillStyle(0xf46f4f).fillTriangle(76, 38, 115, 6, 103, 43).fillTriangle(73, 51, 105, 75, 96, 48).fillRect(25, 23, 18, 14);
    g.fillStyle(0x2db7c4).fillRoundedRect(50, 36, 58, 7, 3);
    g.fillStyle(0x173251).fillCircle(34, 58, 8).fillCircle(125, 58, 8);
  });
  tex(scene, 'balloon', 112, 156, g => {
    g.fillStyle(0xf2664f).fillEllipse(56, 52, 86, 100);
    g.fillStyle(0xffc34d).fillTriangle(37, 12, 56, 101, 74, 12);
    g.fillStyle(0x2bbac4).fillTriangle(18, 40, 56, 101, 94, 40);
    g.lineStyle(3, 0x5b3c2e).lineBetween(44, 96, 39, 128).lineBetween(68, 96, 73, 128);
    g.fillStyle(0x8d5836).fillRoundedRect(35, 126, 42, 26, 4);
  });
  tex(scene, 'satellite', 170, 106, g => {
    g.fillStyle(0x2a4666).fillRoundedRect(66, 25, 40, 56, 8);
    g.fillStyle(0xe6eef6).fillCircle(86, 53, 20); g.fillStyle(0xf2ae35).fillCircle(86, 53, 9);
    g.fillStyle(0x176d9d).fillRect(7, 22, 54, 60).fillRect(111, 22, 54, 60);
    g.lineStyle(3, 0x7fe3f0).strokeRect(12, 27, 20, 22).strokeRect(36, 27, 20, 22).strokeRect(116, 27, 20, 22).strokeRect(140, 27, 20, 22);
    g.lineStyle(5, 0xd7e3ec).lineBetween(61, 52, 66, 52).lineBetween(106, 52, 111, 52);
  });
  tex(scene, 'asteroid', 104, 96, g => {
    g.fillStyle(0x6d6781).fillPoints([{x:52,y:3},{x:91,y:23},{x:100,y:61},{x:72,y:91},{x:30,y:88},{x:5,y:55},{x:18,y:18}], true);
    g.fillStyle(0x48465f).fillCircle(37, 30, 13).fillCircle(71, 61, 16).fillCircle(29, 70, 8);
    g.fillStyle(0x9990a6, 0.6).fillCircle(65, 23, 9);
  });
  tex(scene, 'paintball', 26, 26, g => g.fillStyle(0xff4fa0).fillCircle(13, 13, 11).fillStyle(0xffffff, 0.7).fillCircle(9, 8, 4));
  tex(scene, 'moon-dust', 48, 48, g => {
    g.fillStyle(0xdde4ee, 0.08).fillCircle(24, 24, 22);
    g.fillStyle(0xe9edf2, 0.15).fillCircle(24, 24, 15);
    g.fillStyle(0xffffff, 0.34).fillCircle(20, 19, 7);
  });

}

export function createPortraits(scene: Phaser.Scene): void {
  const source = scene.textures.get('crew').getSourceImage() as HTMLImageElement;
  const defs = [
    { key: 'portrait-johannes', sx: 180, sy: 0, sw: 470, sh: 470 },
    { key: 'portrait-leo', sx: 650, sy: 40, sw: 390, sh: 390 },
    { key: 'portrait-oliver', sx: 1030, sy: 165, sw: 330, sh: 330 }
  ];
  defs.forEach(d => {
    const texture = scene.textures.createCanvas(d.key, 256, 256)!;
    const ctx = texture.context;
    ctx.clearRect(0, 0, 256, 256);
    ctx.save();
    ctx.beginPath(); ctx.arc(128, 128, 126, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(source, d.sx, d.sy, d.sw, d.sh, 0, 0, 256, 256);
    ctx.restore();
    texture.refresh();
  });
}

function createGridFrames(
  scene: Phaser.Scene,
  sourceKey: string,
  framePrefix: string,
  columns: number,
  rows: number,
  frameCount: number,
  outputWidth: number,
  outputHeight: number
): void {
  const source = scene.textures.get(sourceKey).getSourceImage() as HTMLImageElement;
  const sourceWidth = source.naturalWidth || source.width;
  const sourceHeight = source.naturalHeight || source.height;
  const cellWidth = sourceWidth / columns;
  const cellHeight = sourceHeight / rows;

  for (let frame = 0; frame < frameCount; frame++) {
    const texture = scene.textures.createCanvas(`${framePrefix}-${frame}`, outputWidth, outputHeight)!;
    const context = texture.context;
    context.clearRect(0, 0, outputWidth, outputHeight);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(
      source,
      (frame % columns) * cellWidth,
      Math.floor(frame / columns) * cellHeight,
      cellWidth,
      cellHeight,
      0,
      0,
      outputWidth,
      outputHeight
    );
    texture.refresh();
  }
}

function createSheetFrames(
  scene: Phaser.Scene,
  sourceKey: string,
  framePrefix: string,
  outputWidth: number,
  outputHeight: number
): void {
  createGridFrames(scene, sourceKey, framePrefix, 2, 2, 4, outputWidth, outputHeight);
}

function createAlignedUfoFrames(scene: Phaser.Scene): void {
  const source = scene.textures.get('obstacle-ufo-sheet').getSourceImage() as HTMLImageElement;
  const sourceWidth = source.naturalWidth || source.width;
  const sourceHeight = source.naturalHeight || source.height;
  const cellWidth = sourceWidth / 2;
  const cellHeight = sourceHeight / 2;
  // The UFO sits much higher in the two lower source cells. These offsets lock
  // the saucer's visual centre between frames instead of letting it jump.
  const offsets = [
    { x: -10, y: 0 },
    { x: 0, y: 0 },
    { x: -8, y: 42 },
    { x: -16, y: 42 }
  ];

  for (let frame = 0; frame < 4; frame++) {
    const texture = scene.textures.createCanvas(`obstacle-ufo-${frame}`, 384, 256)!;
    const context = texture.context;
    const offset = offsets[frame]!;
    context.clearRect(0, 0, 384, 256);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(
      source,
      (frame % 2) * cellWidth,
      Math.floor(frame / 2) * cellHeight,
      cellWidth,
      cellHeight,
      offset.x,
      offset.y,
      384,
      256
    );
    texture.refresh();
  }
}

function createRocketFlightFrames(scene: Phaser.Scene): void {
  const rocket = scene.textures.get('rocket').getSourceImage() as HTMLImageElement;
  const flames = scene.textures.get('rocket-flames-sheet').getSourceImage() as HTMLImageElement;
  const flameRects = [
    { sx: 100, sy: 40, sw: 450, sh: 410, dx: 66, dy: 291, dw: 124, dh: 112 },
    { sx: 704, sy: 40, sw: 500, sh: 430, dx: 68, dy: 291, dw: 120, dh: 124 },
    { sx: 85, sy: 500, sw: 480, sh: 600, dx: 62, dy: 291, dw: 132, dh: 149 },
    { sx: 695, sy: 500, sw: 500, sh: 600, dx: 68, dy: 291, dw: 120, dh: 139 }
  ];

  const makeFrame = (key: string, flameFrame?: number) => {
    const texture = scene.textures.createCanvas(key, 256, 440)!;
    const context = texture.context;
    context.clearRect(0, 0, 256, 440);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    if (flameFrame !== undefined) {
      const r = flameRects[flameFrame]!;
      context.drawImage(flames, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh);
    }
    // The body is deliberately drawn last, in the exact same position in every
    // frame, so the exhaust tucks under the bells and the window portraits stay locked.
    context.drawImage(rocket, 0, 0, rocket.naturalWidth || rocket.width, rocket.naturalHeight || rocket.height, 25.5, 0, 205, 308);
    texture.refresh();
  };

  makeFrame('rocket-game-idle');
  flameRects.forEach((_rect, frame) => makeFrame(`rocket-flight-${frame}`, frame));
}

function createScaledTexture(
  scene: Phaser.Scene,
  sourceKey: string,
  outputKey: string,
  outputWidth: number,
  outputHeight: number
): void {
  const source = scene.textures.get(sourceKey).getSourceImage() as HTMLImageElement;
  const texture = scene.textures.createCanvas(outputKey, outputWidth, outputHeight)!;
  const context = texture.context;
  context.clearRect(0, 0, outputWidth, outputHeight);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, outputWidth, outputHeight);
  texture.refresh();
}

export function createSpriteAnimations(scene: Phaser.Scene): void {
  createScaledTexture(scene, 'rocket', 'rocket-idle', 256, 384);
  createRocketFlightFrames(scene);
  if (!scene.anims.exists('rocket-flight')) {
    scene.anims.create({
      key: 'rocket-flight',
      frames: [0, 1, 2, 3, 2, 1].map(frame => ({ key: `rocket-flight-${frame}` })),
      frameRate: 12,
      repeat: -1
    });
  }

  const crewIds = ['johannes', 'leo', 'oliver'] as const;
  crewIds.forEach(id => {
    const prefix = `crew-walk-${id}`;
    createGridFrames(scene, `${prefix}-sheet`, prefix, 4, 2, 8, 384, 512);
    if (!scene.anims.exists(prefix)) {
      scene.anims.create({
        key: prefix,
        frames: [0, 1, 2, 3, 4, 5, 6, 7].map(frame => ({ key: `${prefix}-${frame}` })),
        frameRate: id === 'oliver' ? 11 : 12,
        repeat: -1
      });
    }

    const cheerPrefix = `crew-cheer-${id}`;
    createGridFrames(scene, `${cheerPrefix}-sheet`, cheerPrefix, 2, 2, 4, 512, 512);
    if (!scene.anims.exists(cheerPrefix)) {
      scene.anims.create({
        key: cheerPrefix,
        frames: [0, 1, 2, 3].map(frame => ({ key: `${cheerPrefix}-${frame}` })),
        frameRate: id === 'oliver' ? 5.5 : 5,
        repeat: -1
      });
    }
  });

  createGridFrames(scene, 'asteroid-pack-sheet', 'obstacle-asteroid', 2, 2, 4, 420, 384);

  createSheetFrames(scene, 'obstacle-bird-flap-sheet', 'obstacle-bird-flap', 384, 256);
  if (!scene.anims.exists('bird-flap')) {
    scene.anims.create({
      key: 'bird-flap',
      frames: [0, 1, 2, 3].map(frame => ({ key: `obstacle-bird-flap-${frame}` })),
      frameRate: 10,
      repeat: -1
    });
  }

  createSheetFrames(scene, 'obstacle-plane-propeller-sheet', 'obstacle-plane-propeller', 384, 256);
  if (!scene.anims.exists('plane-propeller')) {
    scene.anims.create({
      key: 'plane-propeller',
      frames: [0, 1, 2, 3].map(frame => ({ key: `obstacle-plane-propeller-${frame}` })),
      frameRate: 14,
      repeat: -1
    });
  }

  createAlignedUfoFrames(scene);
  if (!scene.anims.exists('ufo-lights')) {
    scene.anims.create({
      key: 'ufo-lights',
      frames: [0, 1, 2, 3, 2, 1].map(frame => ({ key: `obstacle-ufo-${frame}` })),
      frameRate: 8,
      repeat: -1
    });
  }
}
