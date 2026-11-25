/**
 * tileArt/primitives — Primitives de dessin pixel-art (sans anti-aliasing).
 */
import { TILE_SIZE, type Rng } from './types';

/** Remplit un pixel (1×1) à (x, y). */
export function px(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  if (x < 0 || y < 0 || x >= TILE_SIZE || y >= TILE_SIZE) return;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

/** Remplit un rectangle de pixels. */
export function rect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/** Nuance une couleur hex par un facteur (1 = inchangé, <1 plus sombre). */
export function shade(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * factor)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * factor)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * factor)));
  return `rgb(${r},${g},${b})`;
}

/**
 * Remplit le canvas d'une teinte de base avec un léger bruit par pixel
 * (±variance) pour casser l'effet aplat.
 */
export function noisyFill(ctx: CanvasRenderingContext2D, colors: string[], rng: Rng, variance = 0.12) {
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const base = colors[(rng() * colors.length) | 0];
      const f = 1 + (rng() * 2 - 1) * variance;
      px(ctx, x, y, shade(base, f));
    }
  }
}

/** Trace une ligne de pixels (Bresenham). */
export function line(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string
) {
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    px(ctx, x, y, color);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

/** Ligne de pixels épaisse (Bresenham, pinceau carré, sans anti-aliasing). */
export function thickLine(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, x1: number, y1: number,
  color: string, thick = 1
) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    rect(ctx, x0 - Math.floor(thick / 2), y0 - Math.floor(thick / 2), thick, thick, color);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
