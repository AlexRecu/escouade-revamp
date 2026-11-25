/**
 * tileArt/cave — Caverne : sol en pierre sombre + murs à strates.
 */
import { TILE_SIZE, type Rng } from './types';
import { rect, line } from './primitives';

/** Caverne — sol : pierre sombre avec taches et cailloux. */
export function caveFloor(ctx: CanvasRenderingContext2D, rng: Rng) {
  rect(ctx, 0, 0, TILE_SIZE, TILE_SIZE, '#2a3148');
  const stones = ['#2a3148', '#333a52', '#232a40', '#3a4258', '#2e3550'];
  for (let i = 0; i < 10; i++) {
    const x = Math.floor(rng() * 28), y = Math.floor(rng() * 28);
    const w = 3 + Math.floor(rng() * 7), h = 2 + Math.floor(rng() * 5);
    rect(ctx, x, y, w, h, stones[Math.floor(rng() * stones.length)]);
  }
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(rng() * 30), y = Math.floor(rng() * 30);
    rect(ctx, x, y, 1 + Math.floor(rng() * 2), 1, rng() < 0.5 ? '#4a5268' : '#3a4258');
  }
  if (rng() < 0.4) {
    const sx = 4 + Math.floor(rng() * 12), sy = 4 + Math.floor(rng() * 12);
    line(ctx, sx, sy, sx + 4, sy + 3, '#1a2030');
    line(ctx, sx + 4, sy + 3, sx + 8, sy + 5, '#1a2030');
  }
  for (let i = 0; i < 4; i++) {
    rect(ctx, Math.floor(rng() * 31), Math.floor(rng() * 31), 1, 1, rng() < 0.5 ? '#4a5268' : '#1a2030');
  }
}

/** Caverne — mur : pierre sombre avec strates horizontales. */
export function caveWall(ctx: CanvasRenderingContext2D, rng: Rng) {
  rect(ctx, 0, 0, TILE_SIZE, TILE_SIZE, '#0a0e1a');
  const shades = ['#0a0e1a', '#0e1424', '#141c30', '#0c1220'];
  for (let row = 0; row < 4; row++) {
    const y = row * 8;
    const base = shades[Math.floor(rng() * shades.length)];
    rect(ctx, 0, y, TILE_SIZE, 8, base);
    rect(ctx, 0, y + 7, TILE_SIZE, 1, '#060a14');
    for (let i = 0; i < 2; i++) {
      const x = Math.floor(rng() * 28);
      rect(ctx, x, y + 1, 1, 6, '#060a14');
    }
  }
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(rng() * 28), y = Math.floor(rng() * 28);
    rect(ctx, x, y, 2 + Math.floor(rng() * 5), 1 + Math.floor(rng() * 3), rng() < 0.5 ? '#141c30' : '#0e1424');
  }
  if (rng() < 0.35) {
    const sx = 6 + Math.floor(rng() * 16), sy = 2 + Math.floor(rng() * 6);
    line(ctx, sx, sy, sx + 2, sy + 8, '#060a14');
    line(ctx, sx + 2, sy + 8, sx + 5, sy + 14, '#060a14');
  }
  for (let i = 0; i < 3; i++) {
    rect(ctx, Math.floor(rng() * 30), Math.floor(rng() * 30), 1, 1, rng() < 0.5 ? '#1a2440' : '#060a14');
  }
}
