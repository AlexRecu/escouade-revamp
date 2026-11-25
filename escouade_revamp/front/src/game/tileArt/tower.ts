/**
 * tileArt/tower — Tour : sol en dalles + murs en blocs de pierre.
 */
import { TILE_SIZE, type Rng } from './types';
import { rect, line } from './primitives';

/** Tour — sol : grandes dalles de pierre bleu-gris foncé. */
export function towerFloor(ctx: CanvasRenderingContext2D, rng: Rng) {
  rect(ctx, 0, 0, TILE_SIZE, TILE_SIZE, '#2a2d3a');
  const shades = ['#33364a', '#3a3d52', '#2c2f42', '#404358'];
  const tile = 16;
  for (let ry = 0; ry < 2; ry++) {
    for (let rx = 0; rx < 2; rx++) {
      const x = rx * tile, y = ry * tile;
      const base = shades[Math.floor(rng() * shades.length)];
      rect(ctx, x + 1, y + 1, tile - 2, tile - 2, base);
      rect(ctx, x + 1, y + 1, tile - 2, 1, '#4a4d62');
      rect(ctx, x + 1, y + 1, 1, tile - 2, '#42455a');
      rect(ctx, x + 1, y + tile - 2, tile - 2, 1, '#1e2030');
      rect(ctx, x + tile - 2, y + 1, 1, tile - 2, '#252838');
      if (rng() < 0.4) {
        rect(ctx, x + 3 + Math.floor(rng() * 8), y + 4 + Math.floor(rng() * 8), 2, 1, '#252838');
      }
    }
  }
  if (rng() < 0.35) {
    const sx = 4 + Math.floor(rng() * 10), sy = 4 + Math.floor(rng() * 10);
    line(ctx, sx, sy, sx + 5, sy + 3, '#1a1c28');
    line(ctx, sx + 5, sy + 3, sx + 10, sy + 6, '#1a1c28');
  }
  for (let i = 0; i < 4; i++) {
    rect(ctx, Math.floor(rng() * 30), Math.floor(rng() * 30), 1, 1, rng() < 0.5 ? '#4a4d62' : '#1e2030');
  }
}

/** Tour — mur : blocs de pierre horizontaux bleu-gris foncé. */
export function towerWall(ctx: CanvasRenderingContext2D, rng: Rng) {
  rect(ctx, 0, 0, TILE_SIZE, TILE_SIZE, '#1a1c28');
  const shades = ['#252838', '#2c2f42', '#33364a', '#2a2d3a'];
  const bh = 8, bw = 16;
  for (let row = 0; row < 4; row++) {
    const y = row * bh;
    const off = (row % 2) * (bw / 2);
    for (let col = -1; col < 3; col++) {
      const x = col * bw + off;
      const base = shades[Math.floor(rng() * shades.length)];
      rect(ctx, x + 1, y + 1, bw - 2, bh - 2, base);
      rect(ctx, x + 1, y + 1, bw - 2, 1, '#3a3d52');
      rect(ctx, x + 1, y + bh - 2, bw - 2, 1, '#141620');
      rect(ctx, x + bw - 2, y + 2, 1, bh - 3, '#1e2030');
      if (rng() < 0.2) rect(ctx, x + 3, y + 3, 2, 1, '#3a3d52');
    }
  }
  if (rng() < 0.3) {
    const sx = 6 + Math.floor(rng() * 16), sy = 2 + Math.floor(rng() * 6);
    line(ctx, sx, sy, sx + 2, sy + 8, '#141620');
    line(ctx, sx + 2, sy + 8, sx + 5, sy + 14, '#141620');
  }
  for (let i = 0; i < 3; i++) {
    rect(ctx, Math.floor(rng() * 30), Math.floor(rng() * 30), 1, 1, rng() < 0.5 ? '#3a3d52' : '#141620');
  }
}
