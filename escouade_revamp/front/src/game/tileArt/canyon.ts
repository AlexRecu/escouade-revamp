/**
 * tileArt/canyon — Canyon : sol sable/roche + murs à strates.
 */
import { TILE_SIZE, type Rng } from './types';
import { rect, line } from './primitives';

/** Canyon — sol : sable/roche orange-brun avec taches. */
export function canyonFloor(ctx: CanvasRenderingContext2D, rng: Rng) {
  rect(ctx, 0, 0, TILE_SIZE, TILE_SIZE, '#544228');
  const sands = ['#4a3a24', '#544228', '#423220', '#5e4a30', '#4e3e28'];
  for (let i = 0; i < 12; i++) {
    const x = Math.floor(rng() * 28), y = Math.floor(rng() * 28);
    const w = 3 + Math.floor(rng() * 7), h = 2 + Math.floor(rng() * 4);
    rect(ctx, x, y, w, h, sands[Math.floor(rng() * sands.length)]);
  }
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(rng() * 30), y = Math.floor(rng() * 30);
    rect(ctx, x, y, 1 + Math.floor(rng() * 2), 1, rng() < 0.5 ? '#6e5a38' : '#5e4a30');
  }
  if (rng() < 0.4) {
    const sx = 4 + Math.floor(rng() * 12), sy = 4 + Math.floor(rng() * 12);
    line(ctx, sx, sy, sx + 4, sy + 3, '#3a2a18');
    line(ctx, sx + 4, sy + 3, sx + 8, sy + 5, '#3a2a18');
  }
  for (let i = 0; i < 4; i++) {
    rect(ctx, Math.floor(rng() * 31), Math.floor(rng() * 31), 1, 1, rng() < 0.5 ? '#6e5a38' : '#3a2a18');
  }
}

/** Canyon — mur : strates horizontales orange-brun. */
export function canyonWall(ctx: CanvasRenderingContext2D, rng: Rng) {
  rect(ctx, 0, 0, TILE_SIZE, TILE_SIZE, '#2a1e10');
  const shades = ['#2a1e10', '#3a2a18', '#4a3a24', '#322414'];
  for (let row = 0; row < 4; row++) {
    const y = row * 8;
    const base = shades[Math.floor(rng() * shades.length)];
    rect(ctx, 0, y, TILE_SIZE, 8, base);
    rect(ctx, 0, y + 7, TILE_SIZE, 1, '#1a1208');
    for (let i = 0; i < 2; i++) {
      const x = Math.floor(rng() * 28);
      rect(ctx, x, y + 1, 1, 6, '#1a1208');
    }
  }
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(rng() * 28), y = Math.floor(rng() * 28);
    rect(ctx, x, y, 2 + Math.floor(rng() * 5), 1 + Math.floor(rng() * 3), rng() < 0.5 ? '#4a3a24' : '#3a2a18');
  }
  if (rng() < 0.35) {
    const sx = 8 + Math.floor(rng() * 16), sy = 2 + Math.floor(rng() * 4);
    line(ctx, sx, sy, sx + 1, sy + 10, '#1a1208');
    line(ctx, sx + 1, sy + 10, sx + 3, sy + 18, '#1a1208');
  }
  for (let i = 0; i < 3; i++) {
    rect(ctx, Math.floor(rng() * 30), Math.floor(rng() * 30), 1, 1, rng() < 0.5 ? '#5e4a30' : '#1a1208');
  }
}
