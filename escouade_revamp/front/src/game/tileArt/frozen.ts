/**
 * tileArt/frozen — Terres gelées : arbres (mort, sapins) + sol enneigé + mur de glace.
 * Port de escouade-frozen-trees.js : chaque arbre est rendu dans un sprite
 * 72×96 transparent puis mis à l'échelle dans la tuile 32×32.
 */
import { TILE_SIZE, type BiomePalette, type Rng } from './types';
import { rect, thickLine } from './primitives';
import { makeRng } from './rng';

const FROZEN_C = {
  bark: '#3b3542', barkShade: '#262733', barkLight: '#736573', barkIce: '#a3b7bd',
  pineDeep: '#122f3b', pineDark: '#1b4551', pineMid: '#285969', pineLight: '#387482',
  pineEdge: '#102832', snowShade: '#9bb8cb', snowMid: '#cce2ed', snowLight: '#f4f9ff',
  snowBlue: '#77a2bd', ground: '#a2c5d5',
};

const FROZEN_W = 72, FROZEN_H = 96;

function frozenSnowPatch(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, random: Rng) {
  rect(ctx, x, y, w, 2, FROZEN_C.snowShade);
  rect(ctx, x + 1, y, w - 2, 2, FROZEN_C.snowMid);
  rect(ctx, x + 2, y, Math.max(2, w - 5), 1, FROZEN_C.snowLight);
  if (random() > 0.5) rect(ctx, x + Math.floor(w * 0.65), y + 2, 2, 2, FROZEN_C.snowMid);
}

function frozenDrawDead(ctx: CanvasRenderingContext2D, random: Rng) {
  // Emprise au sol et racines.
  rect(ctx, 21, 85, 29, 3, FROZEN_C.snowShade);
  rect(ctx, 17, 88, 38, 2, FROZEN_C.snowMid);
  thickLine(ctx, 35, 85, 34, 58, FROZEN_C.barkShade, 8);
  thickLine(ctx, 34, 58, 30, 36, FROZEN_C.barkShade, 7);
  thickLine(ctx, 30, 36, 31, 16, FROZEN_C.barkShade, 5);
  thickLine(ctx, 35, 83, 35, 59, FROZEN_C.bark, 5);
  thickLine(ctx, 34, 57, 31, 37, FROZEN_C.bark, 4);
  thickLine(ctx, 31, 35, 32, 18, FROZEN_C.barkLight, 3);
  // Branches anguleuses asymétriques ; pas de feuillage.
  const branches: [number, number, number, number, number][] = [
    [32, 36, 19, 27, 5], [19, 27, 13, 14, 4], [20, 27, 8, 24, 3], [32, 44, 45, 31, 5],
    [45, 31, 52, 18, 4], [44, 31, 59, 29, 3], [34, 57, 18, 49, 4], [18, 49, 11, 38, 3],
    [36, 65, 50, 56, 4], [50, 56, 59, 43, 3], [30, 27, 25, 14, 3],
  ];
  branches.forEach(([x0, y0, x1, y1, t], i) => {
    const wobble = (random() - 0.5) * 2;
    thickLine(ctx, x0, y0, x1 + wobble, y1, FROZEN_C.barkShade, t + 1);
    thickLine(ctx, x0, y0, x1 + wobble, y1, FROZEN_C.bark, t - 1);
    if (i % 3 === 0) thickLine(ctx, x0, y0, x1 + wobble, y1, FROZEN_C.barkLight, 1);
  });
  // Neige posée sur les branches orientées vers le haut.
  ([[12, 14, 7], [48, 17, 7], [8, 23, 6], [56, 28, 5], [11, 38, 5], [57, 43, 5], [23, 13, 5]] as [number, number, number][])
    .forEach(([x, y, w]) => frozenSnowPatch(ctx, x, y, w, random));
  rect(ctx, 29, 74, 2, 7, FROZEN_C.barkLight);
  rect(ctx, 39, 67, 2, 9, FROZEN_C.barkShade);
  rect(ctx, 26, 84, 8, 3, FROZEN_C.snowLight);
  rect(ctx, 41, 85, 9, 3, FROZEN_C.snowMid);
}

function frozenFirLayer(ctx: CanvasRenderingContext2D, cx: number, top: number, bottom: number, half: number, random: Rng) {
  const h = bottom - top;
  // Rampe triangulaire en gradins, avec jitter de bordure au niveau du pixel.
  for (let y = top; y < bottom; y++) {
    const t = (y - top) / h;
    const jag = (y % 5 === 0 ? -2 : y % 5 === 1 ? 0 : y % 5 === 2 ? 1 : y % 5 === 3 ? 2 : 0);
    const hw = Math.max(2, Math.floor(half * (0.23 + 0.77 * t)) + jag);
    rect(ctx, cx - hw, y, hw * 2, 1, FROZEN_C.pineDeep);
    if (hw > 5) rect(ctx, cx - hw + 2, y, Math.max(1, Math.floor(hw * 0.9)), 1, FROZEN_C.pineMid);
    if (hw > 9 && y % 3 !== 0) rect(ctx, cx + Math.floor(hw * 0.25), y, Math.max(1, Math.floor(hw * 0.5)), 1, FROZEN_C.pineDark);
  }
  // Dents de branches sur la silhouette basse.
  for (let k = -2; k <= 2; k++) {
    const x = cx + Math.round(k * half * 0.38);
    const by = bottom - 2 + Math.floor(random() * 3);
    rect(ctx, x, by, 4, 3, k < 0 ? FROZEN_C.pineMid : FROZEN_C.pineDeep);
  }
  // Bandes de neige : calotte haute + étagères blanches brisées.
  const snowRows = [top + 2, top + Math.floor(h * 0.34), top + Math.floor(h * 0.62), bottom - 5];
  snowRows.forEach((y, i) => {
    if (y >= bottom - 1) return;
    const t = (y - top) / h;
    const hw = Math.max(3, Math.floor(half * (0.23 + 0.77 * t)));
    const left = cx - hw + 2;
    const length = Math.max(5, hw * 2 - 4);
    const gap = Math.max(2, Math.floor(length * 0.18));
    rect(ctx, left, y, Math.max(4, Math.floor(length * 0.52)), 2, i === 0 ? FROZEN_C.snowLight : FROZEN_C.snowMid);
    rect(ctx, left + Math.floor(length * 0.55) + gap, y + 1, Math.max(3, Math.floor(length * 0.22)), 2, FROZEN_C.snowShade);
    if (i !== 0) rect(ctx, left + 3, y - 1, Math.max(3, Math.floor(length * 0.3)), 1, FROZEN_C.snowLight);
    if (i === 3) { rect(ctx, left + 5, y + 2, 2, 3, FROZEN_C.snowShade); rect(ctx, left + Math.floor(length * 0.65), y + 2, 2, 3, FROZEN_C.snowMid); }
  });
  // Pixels de neige scintillants, déterministes, épars.
  for (let i = 0; i < Math.max(3, Math.floor(half * 0.35)); i++) {
    const yy = top + 4 + Math.floor(random() * (h - 8));
    const t = (yy - top) / h;
    const hw = Math.max(2, Math.floor(half * (0.23 + 0.77 * t)));
    const xx = cx - hw + 2 + Math.floor(random() * Math.max(1, hw * 2 - 4));
    rect(ctx, xx, yy, random() > 0.7 ? 2 : 1, 1, random() > 0.4 ? FROZEN_C.snowMid : FROZEN_C.pineLight);
  }
}

function frozenDrawFir(ctx: CanvasRenderingContext2D, random: Rng, large: boolean) {
  const cx = 36;
  const tiers: [number, number, number][] = large
    ? [[9, 32, 14], [22, 46, 21], [36, 62, 27], [51, 78, 32]]
    : [[27, 46, 11], [39, 58, 16], [52, 74, 22]];
  rect(ctx, cx - 4, 69, 8, 18, FROZEN_C.barkShade);
  rect(ctx, cx - 2, 69, 4, 18, FROZEN_C.bark);
  rect(ctx, cx - 2, 75, 1, 11, FROZEN_C.barkLight);
  // Du bas vers le haut pour que chaque étage recouvre les précédents.
  [...tiers].reverse().forEach(([t, b, hw]) => frozenFirLayer(ctx, cx, t, b, hw, random));
  // Givre au sommet et au sol.
  rect(ctx, cx - 2, tiers[0][0] - 2, 4, 5, FROZEN_C.snowLight);
  rect(ctx, cx - 3, tiers[0][0] + 2, 7, 2, FROZEN_C.snowMid);
  rect(ctx, 22, 85, 30, 3, FROZEN_C.snowShade);
  rect(ctx, 16, 88, 42, 2, FROZEN_C.snowMid);
  rect(ctx, 27, 85, 13, 2, FROZEN_C.snowLight);
  rect(ctx, 43, 87, 9, 2, FROZEN_C.snowLight);
}

function renderFrozenTree(type: 'dead' | 'fir-small' | 'fir-large', seed: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = FROZEN_W;
  canvas.height = FROZEN_H;
  const ctx = canvas.getContext('2d', { alpha: true })!;
  ctx.imageSmoothingEnabled = false;
  const random = makeRng(seed);
  if (type === 'dead') frozenDrawDead(ctx, random);
  else if (type === 'fir-small') frozenDrawFir(ctx, random, false);
  else if (type === 'fir-large') frozenDrawFir(ctx, random, true);
  return canvas;
}

/** Dessine un arbre gelé dans la tuile 32×32 (ancré en bas, centré). */
function drawFrozenTreeInTile(ctx: CanvasRenderingContext2D, type: 'dead' | 'fir-small' | 'fir-large', rng: Rng) {
  const seed = Math.floor(rng() * 1e9);
  const sprite = renderFrozenTree(type, seed);
  const displayH = 30;
  const w = displayH * FROZEN_W / FROZEN_H;
  const x = Math.round((TILE_SIZE - w) / 2);
  const y = TILE_SIZE - displayH;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sprite, x, y, Math.round(w), displayH);
  ctx.restore();
}

/** Arbre mort gelé (sprite 72×96 mis à l'échelle). */
export function drawDeadTree(ctx: CanvasRenderingContext2D, rng: Rng, _p: BiomePalette) {
  drawFrozenTreeInTile(ctx, 'dead', rng);
}

/** Sapin gelé (deux tailles) : sprite 72×96 mis à l'échelle. */
export function drawSnowPine(ctx: CanvasRenderingContext2D, rng: Rng, _p: BiomePalette, big: boolean) {
  drawFrozenTreeInTile(ctx, big ? 'fir-large' : 'fir-small', rng);
}

/** Terres gelées — sol : neige bleutée avec taches, cristaux et ombres. */
export function frozenFloor(ctx: CanvasRenderingContext2D, rng: Rng) {
  rect(ctx, 0, 0, TILE_SIZE, TILE_SIZE, '#c8dce8');
  const snows = ['#c8dce8', '#d4e4f0', '#bcd0e0', '#e0eef8', '#c0d4e4'];
  for (let i = 0; i < 12; i++) {
    const x = Math.floor(rng() * 28), y = Math.floor(rng() * 28);
    const w = 3 + Math.floor(rng() * 7), h = 2 + Math.floor(rng() * 4);
    rect(ctx, x, y, w, h, snows[Math.floor(rng() * snows.length)]);
  }
  // Ombres bleutées (creux de neige).
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(rng() * 28), y = Math.floor(rng() * 28);
    rect(ctx, x, y, 2 + Math.floor(rng() * 4), 1 + Math.floor(rng() * 2), '#a8c0d4');
  }
  // Cristaux / paillettes de givre.
  for (let i = 0; i < 8; i++) {
    const x = Math.floor(rng() * 31), y = Math.floor(rng() * 31);
    rect(ctx, x, y, 1, 1, rng() < 0.5 ? '#ffffff' : '#e8f4fc');
  }
  // Quelques cailloux affleurants.
  for (let i = 0; i < 3; i++) {
    const x = Math.floor(rng() * 28), y = Math.floor(rng() * 28);
    rect(ctx, x, y, 2 + Math.floor(rng() * 3), 1 + Math.floor(rng() * 2), '#8aa0b4');
    rect(ctx, x, y, 2 + Math.floor(rng() * 3), 1, '#a0b8cc');
  }
}

/** Terres gelées — mur : glace bleutée avec strates et fissures. */
export function frozenWall(ctx: CanvasRenderingContext2D, rng: Rng) {
  rect(ctx, 0, 0, TILE_SIZE, TILE_SIZE, '#a8c4d8');
  const ices = ['#a8c4d8', '#b4d0e4', '#9cb8d0', '#c0d8ec', '#a0c0d4'];
  for (let row = 0; row < 4; row++) {
    const y = row * 8;
    const base = ices[Math.floor(rng() * ices.length)];
    rect(ctx, 0, y, TILE_SIZE, 8, base);
    rect(ctx, 0, y + 7, TILE_SIZE, 1, '#8aa8c0');
    // Reflets horizontaux.
    for (let i = 0; i < 2; i++) {
      const x = Math.floor(rng() * 24);
      rect(ctx, x, y + 1 + Math.floor(rng() * 5), 3 + Math.floor(rng() * 6), 1, '#d4e8f4');
    }
  }
  // Fissures verticales.
  for (let i = 0; i < 2; i++) {
    const x = Math.floor(rng() * 30);
    const y0 = Math.floor(rng() * 8);
    thickLine(ctx, x, y0, x + 1, y0 + 10, '#7a98b0', 1);
    thickLine(ctx, x + 1, y0 + 10, x, y0 + 18, '#7a98b0', 1);
  }
  // Paillettes de givre.
  for (let i = 0; i < 5; i++) {
    rect(ctx, Math.floor(rng() * 31), Math.floor(rng() * 31), 1, 1, rng() < 0.5 ? '#e8f4fc' : '#ffffff');
  }
}
