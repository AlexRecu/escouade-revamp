/**
 * tileArt/decorations — Décorations procédurales partagées entre biomes
 * (rocher, toile d'araignée).
 */
import { TILE_SIZE, type BiomePalette, type Rng } from './types';
import { px, shade, line } from './primitives';

/** Petit rocher : amas gris arrondi. */
export function drawRock(ctx: CanvasRenderingContext2D, rng: Rng, _p: BiomePalette) {
  const cx = 5 + ((rng() * (TILE_SIZE - 10)) | 0);
  const cy = 8 + ((rng() * (TILE_SIZE - 14)) | 0);
  const w = 4 + ((rng() * 3) | 0);
  const h = 3 + ((rng() * 2) | 0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Arrondi simple : on saute les coins.
      if (x === 0 && y === 0) continue;
      if (x === w - 1 && y === 0) continue;
      if (x === 0 && y === h - 1) continue;
      if (x === w - 1 && y === h - 1) continue;
      const f = 0.55 + rng() * 0.25;
      px(ctx, cx + x, cy + y, shade('#8a8a92', f));
    }
  }
  // Reflet en haut.
  px(ctx, cx + 1, cy, shade('#8a8a92', 0.95));
}

/** Toile d'araignée dans un coin : rayons + arcs concentriques. */
export function drawWeb(ctx: CanvasRenderingContext2D, rng: Rng, _p: BiomePalette) {
  const corners: Array<[number, number]> = [
    [0, 0],
    [TILE_SIZE - 1, 0],
    [0, TILE_SIZE - 1],
    [TILE_SIZE - 1, TILE_SIZE - 1],
  ];
  const [cx, cy] = corners[(rng() * corners.length) | 0];
  const sx = cx === 0 ? 1 : -1;
  const sy = cy === 0 ? 1 : -1;
  const col = 'rgba(215, 220, 235, 0.45)';
  // Rayons (0°, 45°, 90° depuis le coin).
  line(ctx, cx, cy, cx + sx * 13, cy, col);
  line(ctx, cx, cy, cx + sx * 9, cy + sy * 9, col);
  line(ctx, cx, cy, cx, cy + sy * 13, col);
  // Arcs concentriques.
  for (const r of [5, 10]) {
    for (let t = 0; t <= 90; t += 6) {
      const rad = (t * Math.PI) / 180;
      px(ctx, Math.round(cx + sx * r * Math.cos(rad)), Math.round(cy + sy * r * Math.sin(rad)), col);
    }
  }
}
