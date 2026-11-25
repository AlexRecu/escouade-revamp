/**
 * tileArt/castle — Château : décors muraux (tableau, sconce, miroir, statue)
 * + sol en dalles + mur en briques. Port de castle-decor.js.
 */
import { TILE_SIZE, type BiomePalette, type Rng } from './types';
import { rect } from './primitives';
import { makeRng } from './rng';

const CASTLE_PAL = {
  mortar: '#171521', stone: '#3c3548', stone2: '#51485a', stone3: '#65596b', stone4: '#837583',
  goldDark: '#563b27', gold: '#b88a48', goldLight: '#f2d28b', silver: '#abb9c1',
  shadow: '#12111b', ember: '#ff7a36', flame: '#ffe8a1', crimson: '#672e47',
  teal: '#234956', pale: '#c4d6cf', marble: '#9297a1',
};

function castleLine(c: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, col: string, w = 1) {
  c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'butt';
  c.beginPath(); c.moveTo(Math.round(x1) + 0.5, Math.round(y1) + 0.5);
  c.lineTo(Math.round(x2) + 0.5, Math.round(y2) + 0.5); c.stroke();
}

function castlePoly(c: CanvasRenderingContext2D, pts: [number, number][], col: string) {
  c.fillStyle = col; c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath(); c.fill();
}

function castlePainting(c: CanvasRenderingContext2D, r: Rng, variant?: string) {
  rect(c, 8, 7, 25, 33, '#11111a');
  rect(c, 6, 4, 26, 34, CASTLE_PAL.goldDark);
  rect(c, 7, 5, 24, 32, CASTLE_PAL.gold);
  rect(c, 9, 7, 20, 28, CASTLE_PAL.goldLight);
  rect(c, 11, 9, 16, 24, '#231d2b');
  for (const [xx, yy] of [[5, 3], [30, 3], [5, 36], [30, 36]] as [number, number][]) {
    rect(c, xx, yy, 4, 4, CASTLE_PAL.gold);
    rect(c, xx + 1, yy + 1, 2, 2, CASTLE_PAL.goldLight);
  }
  for (let yy = 11; yy < 33; yy += 6) {
    rect(c, 7, yy, 2, 2, CASTLE_PAL.goldLight);
    rect(c, 29, yy, 2, 2, CASTLE_PAL.goldLight);
  }
  const kind = variant || ['portrait', 'landscape', 'haunted'][Math.floor(r() * 3)];
  if (kind === 'landscape') {
    rect(c, 11, 9, 16, 11, '#405d70');
    rect(c, 11, 20, 16, 13, '#293b36');
    castlePoly(c, [[11, 22], [17, 15], [21, 21], [25, 17], [27, 23]], '#74858b');
    rect(c, 13, 25, 14, 8, '#384c37');
    rect(c, 19, 19, 2, 12, '#292a2b');
    rect(c, 17, 20, 6, 3, '#4d6a43');
    rect(c, 14, 29, 9, 1, '#78918b');
  } else if (kind === 'haunted') {
    rect(c, 11, 9, 16, 24, '#2b283b');
    rect(c, 13, 12, 12, 18, '#4b3851');
    rect(c, 18, 14, 4, 5, '#a3a6b6');
    rect(c, 17, 19, 6, 9, '#7e728d');
    rect(c, 18, 18, 1, 1, '#f3d2ad');
    rect(c, 21, 18, 1, 1, '#f3d2ad');
    rect(c, 14, 27, 12, 4, '#2e2737');
  } else {
    rect(c, 11, 9, 16, 24, '#3b354c');
    rect(c, 13, 27, 12, 6, '#673c4c');
    rect(c, 16, 17, 7, 10, '#d1a98c');
    rect(c, 15, 14, 9, 5, '#28232b');
    rect(c, 17, 13, 5, 2, CASTLE_PAL.gold);
    rect(c, 18, 12, 1, 2, CASTLE_PAL.goldLight);
    rect(c, 21, 12, 1, 2, CASTLE_PAL.goldLight);
    rect(c, 17, 20, 1, 1, '#231d2b');
    rect(c, 21, 20, 1, 1, '#231d2b');
    rect(c, 18, 25, 3, 3, '#f0d9a9');
  }
  rect(c, 8, 6, 18, 1, '#ffe4a1');
  rect(c, 8, 7, 1, 24, '#e7b971');
}

function castleSconce(c: CanvasRenderingContext2D, _r: Rng, variant?: string) {
  c.save();
  c.globalAlpha = 0.14;
  rect(c, 4, 7, 32, 24, '#ffba54');
  rect(c, 8, 3, 24, 30, '#ffcc68');
  c.restore();
  rect(c, 18, 18, 5, 15, '#322b32');
  rect(c, 19, 19, 3, 12, '#a57742');
  rect(c, 17, 27, 7, 5, '#c59b60');
  rect(c, 11, 23, 18, 3, '#66452f');
  rect(c, 11, 22, 18, 1, '#e3b879');
  rect(c, 11, 18, 3, 6, '#aa8050');
  rect(c, 27, 18, 3, 6, '#aa8050');
  rect(c, 9, 19, 7, 3, '#c49b59');
  rect(c, 25, 19, 7, 3, '#c49b59');
  for (const cx of [12, 28]) {
    rect(c, cx - 2, 12, 4, 8, '#d6c5a0');
    rect(c, cx - 2, 12, 1, 7, '#fff0c8');
    rect(c, cx, 10, 1, 3, '#3d3031');
    rect(c, cx - 2, 6, 4, 5, '#ff8c3e');
    rect(c, cx - 1, 4, 2, 6, '#ffd260');
    rect(c, cx, 5, 1, 4, '#fff8bc');
    if (variant === 'extinguished') {
      rect(c, cx - 3, 4, 6, 9, '#3c3548');
      rect(c, cx - 1, 3, 1, 4, '#69616a');
    }
  }
  rect(c, 18, 32, 5, 2, '#554334');
  rect(c, 19, 33, 3, 2, '#d6a96e');
}

function castleMirror(c: CanvasRenderingContext2D, _r: Rng, variant?: string) {
  rect(c, 9, 6, 25, 37, '#13141d');
  rect(c, 7, 3, 25, 37, '#4b5364');
  rect(c, 8, 4, 23, 35, '#a1a5a3');
  rect(c, 10, 6, 19, 31, '#5d7180');
  rect(c, 12, 8, 15, 27, '#2b4756');
  castlePoly(c, [[12, 8], [19, 8], [13, 25], [12, 25]], '#668b98');
  castlePoly(c, [[23, 8], [27, 8], [15, 35], [13, 35]], '#476b79');
  rect(c, 18, 11, 2, 12, '#83a9b0');
  rect(c, 21, 11, 1, 9, '#9cc1bf');
  rect(c, 13, 29, 8, 2, '#345461');
  for (const [x, y] of [[7, 3], [29, 3], [7, 37], [29, 37]] as [number, number][]) {
    rect(c, x, y, 4, 4, '#d5c8a5');
    rect(c, x + 1, y + 1, 2, 2, '#7a817d');
  }
  rect(c, 17, 1, 6, 3, '#a8a18c');
  rect(c, 19, 0, 2, 3, '#e6d5a4');
  rect(c, 17, 39, 6, 2, '#a8a18c');
  if (variant === 'cracked') {
    castleLine(c, 20, 8, 18, 15, '#c9d6d3');
    castleLine(c, 18, 15, 23, 22, '#c9d6d3');
    castleLine(c, 23, 22, 17, 29, '#c9d6d3');
    castleLine(c, 18, 15, 13, 18, '#c9d6d3');
    castleLine(c, 23, 22, 27, 26, '#c9d6d3');
  }
}

function castleStatue(c: CanvasRenderingContext2D, r: Rng, variant?: string) {
  rect(c, 5, 49, 34, 5, '#171722');
  rect(c, 4, 45, 32, 6, '#50515d');
  rect(c, 6, 44, 28, 3, '#a8a7a9');
  rect(c, 8, 37, 24, 9, '#777987');
  rect(c, 9, 38, 22, 2, '#b1b2ae');
  rect(c, 9, 44, 22, 2, '#4e505c');
  rect(c, 12, 39, 16, 5, '#858791');
  rect(c, 14, 41, 12, 2, '#656675');
  rect(c, 7, 34, 26, 5, '#a6a7a8');
  rect(c, 8, 35, 24, 1, '#e0d8cb');
  const queen = variant === 'queen';
  if (queen) {
    castlePoly(c, [[17, 19], [24, 19], [30, 34], [11, 34]], '#a2a5af');
    castlePoly(c, [[18, 20], [21, 20], [18, 32], [14, 33]], '#d0c9c1');
    rect(c, 14, 19, 5, 13, '#858996');
    rect(c, 23, 19, 5, 13, '#777d8c');
    rect(c, 17, 9, 8, 11, '#b7b6b4');
    rect(c, 16, 7, 10, 5, '#5f626f');
    rect(c, 17, 5, 2, 4, '#c1b49a');
    rect(c, 21, 4, 2, 5, '#c1b49a');
    rect(c, 25, 5, 2, 4, '#c1b49a');
    rect(c, 17, 12, 2, 1, '#555b69');
    rect(c, 23, 12, 2, 1, '#555b69');
    rect(c, 20, 23, 3, 5, '#d6d1cb');
  } else {
    rect(c, 15, 23, 5, 12, '#686d7c');
    rect(c, 22, 23, 5, 12, '#737b88');
    rect(c, 13, 15, 16, 13, '#9b9eaa');
    rect(c, 15, 17, 12, 10, '#697281');
    rect(c, 12, 16, 4, 13, '#b7b6b5');
    rect(c, 27, 16, 4, 13, '#777b8b');
    rect(c, 16, 6, 11, 11, '#b6b7b5');
    rect(c, 15, 5, 13, 4, '#7c7e88');
    rect(c, 18, 11, 8, 2, '#3c404d');
    rect(c, 19, 9, 1, 4, '#c6c6c3');
    rect(c, 20, 1, 2, 4, '#c4bba9');
    rect(c, 18, 3, 6, 2, '#a0a0a2');
    rect(c, 30, 13, 2, 21, '#b9b6ad');
    rect(c, 28, 21, 6, 2, '#6e6564');
    rect(c, 29, 31, 4, 3, '#6b6064');
    rect(c, 20, 19, 2, 5, '#c6bbaa');
  }
  rect(c, 8, 47, 9, 1, '#d3c8b8');
  rect(c, 24, 46, 7, 1, '#c6c4bd');
  if (r() < 0.5) {
    rect(c, 12, 40, 4, 2, '#65796f');
    rect(c, 10, 43, 3, 1, '#536e62');
  }
}

type CastleDecorType = 'painting' | 'sconce' | 'mirror' | 'statue';

const CASTLE_DIMS: Record<CastleDecorType, [number, number]> = {
  painting: [40, 48], sconce: [40, 48], mirror: [40, 48], statue: [40, 56],
};

function renderCastleDecor(type: CastleDecorType, seed: number, variant?: string): HTMLCanvasElement {
  const [w, h] = CASTLE_DIMS[type];
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const c = canvas.getContext('2d', { alpha: true })!;
  c.imageSmoothingEnabled = false;
  const r = makeRng(seed);
  if (type === 'painting') castlePainting(c, r, variant);
  else if (type === 'sconce') castleSconce(c, r, variant);
  else if (type === 'mirror') castleMirror(c, r, variant);
  else if (type === 'statue') castleStatue(c, r, variant);
  return canvas;
}

/** Dessine un décor de château dans la tuile 32×32 (centré ; statue ancrée en bas). */
function drawCastleDecorInTile(ctx: CanvasRenderingContext2D, type: CastleDecorType, rng: Rng) {
  const seed = Math.floor(rng() * 1e9);
  const sprite = renderCastleDecor(type, seed);
  const displayH = type === 'statue' ? 32 : 30;
  const w = displayH * sprite.width / sprite.height;
  const x = Math.round((TILE_SIZE - w) / 2);
  const y = type === 'statue' ? TILE_SIZE - displayH : Math.round((TILE_SIZE - displayH) / 2);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sprite, x, y, Math.round(w), displayH);
  ctx.restore();
}

export function drawCastlePainting(ctx: CanvasRenderingContext2D, rng: Rng, _p: BiomePalette) {
  drawCastleDecorInTile(ctx, 'painting', rng);
}
export function drawCastleSconce(ctx: CanvasRenderingContext2D, rng: Rng, _p: BiomePalette) {
  drawCastleDecorInTile(ctx, 'sconce', rng);
}
export function drawCastleMirror(ctx: CanvasRenderingContext2D, rng: Rng, _p: BiomePalette) {
  drawCastleDecorInTile(ctx, 'mirror', rng);
}
export function drawCastleStatue(ctx: CanvasRenderingContext2D, rng: Rng, _p: BiomePalette) {
  drawCastleDecorInTile(ctx, 'statue', rng);
}

/** Sol du château : dalles de pierre (2×2 par tuile) avec biseau, joints
 *  sombres, fissures et poussière. Dessiné au Canvas, inspiré des dalles. */
export function castleFloor(ctx: CanvasRenderingContext2D, rng: Rng) {
  rect(ctx, 0, 0, TILE_SIZE, TILE_SIZE, '#2e2b38');
  const shades = ['#45414e', '#4e4752', '#59515c', '#615663'];
  const tile = 16;
  for (let ry = 0; ry < 2; ry++) {
    for (let rx = 0; rx < 2; rx++) {
      const x = rx * tile, y = ry * tile;
      const base = shades[Math.floor(rng() * shades.length)];
      rect(ctx, x + 1, y + 1, tile - 2, tile - 2, base);
      // Biseau : arête haute + gauche plus claire, basse + droite plus sombre.
      rect(ctx, x + 1, y + 1, tile - 2, 1, '#776b75');
      rect(ctx, x + 1, y + 1, 1, tile - 2, '#6b6170');
      rect(ctx, x + 1, y + tile - 2, tile - 2, 1, '#2c2935');
      rect(ctx, x + tile - 2, y + 1, 1, tile - 2, '#332f3b');
      // Usure : petites taches sombres.
      if (rng() < 0.5) {
        rect(ctx, x + 4 + Math.floor(rng() * 6), y + 6 + Math.floor(rng() * 6), 2, 1, '#3a3541');
        rect(ctx, x + 5 + Math.floor(rng() * 6), y + 7 + Math.floor(rng() * 6), 1, 2, '#3a3541');
      }
    }
  }
  // Fissure diagonale occasionnelle traversant la tuile.
  if (rng() < 0.4) {
    const sx = 2 + Math.floor(rng() * 8), sy = 6 + Math.floor(rng() * 6);
    castleLine(ctx, sx, sy, sx + 6, sy + 4, '#292632');
    castleLine(ctx, sx + 6, sy + 4, sx + 12, sy + 7, '#292632');
    rect(ctx, sx + 5, sy + 4, 1, 2, '#94858a');
  }
  // Poussière épars.
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(rng() * 31), y = Math.floor(rng() * 30);
    rect(ctx, x, y, 1, 1, rng() < 0.5 ? '#8d7b7c' : '#302a39');
  }
}

/** Mur du château : briques de pierre en rangées (décalage alterné) avec
 *  biseau et joints sombres. Dessiné au Canvas, inspiré des briques. */
export function castleWall(ctx: CanvasRenderingContext2D, rng: Rng) {
  rect(ctx, 0, 0, TILE_SIZE, TILE_SIZE, '#201d2c');
  const shades = ['#393243', '#443c4c', '#504558', '#5a4c5b'];
  const bh = 8, bw = 16;
  for (let row = 0; row < 4; row++) {
    const y = row * bh;
    const off = (row % 2) * (bw / 2);
    for (let col = -1; col < 3; col++) {
      const x = col * bw + off;
      const base = shades[Math.floor(rng() * shades.length)];
      rect(ctx, x + 1, y + 1, bw - 2, bh - 2, base);
      // Biseau : arête haute claire, basse sombre.
      rect(ctx, x + 1, y + 1, bw - 2, 1, '#65596b');
      rect(ctx, x + 1, y + bh - 2, bw - 2, 1, '#25212e');
      // Joint vertical droit.
      rect(ctx, x + bw - 2, y + 2, 1, bh - 3, '#292533');
      // Usure : petite tache claire.
      if (rng() < 0.25) rect(ctx, x + 4, y + 3, 2, 1, '#6b5e70');
    }
  }
  // Liseré bas (soubassement).
  rect(ctx, 0, 30, TILE_SIZE, 2, '#211d2b');
}
