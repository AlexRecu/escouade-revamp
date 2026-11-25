/**
 * tileArt/forest — Forêt : arbres (murs) + sol herbeux.
 */
import { TILE_SIZE, type BiomePalette, type Rng } from './types';
import { px, rect, shade } from './primitives';

/** Arbre (silhouette) : tronc + feuillage. Dessiné sur le mur. */
export function drawTree(ctx: CanvasRenderingContext2D, rng: Rng, p: BiomePalette) {
  const cx = 8 + ((rng() * (TILE_SIZE - 16)) | 0);
  const trunkH = 6 + ((rng() * 3) | 0);
  const baseY = TILE_SIZE - 2;
  // Tronc.
  for (let y = 0; y < trunkH; y++) {
    px(ctx, cx, baseY - y, shade('#5a3a22', 0.8 + rng() * 0.3));
    px(ctx, cx + 1, baseY - y, shade('#4a2f1c', 0.8 + rng() * 0.3));
  }
  // Feuillage : amas de pixels verts autour du sommet.
  const topY = baseY - trunkH;
  const r = 5 + ((rng() * 2) | 0);
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y > r * r) continue;
      if (rng() > 0.85) continue; // trous dans le feuillage
      const f = 0.6 + rng() * 0.5;
      px(ctx, cx + x, topY + y, shade(p.accent, f));
    }
  }
}

/**
 * Grand arbre : tronc épais + double couronne de feuillage, plus haut que
 * l'arbre standard. Dessiné sur le mur.
 */
export function drawBigTree(ctx: CanvasRenderingContext2D, rng: Rng, p: BiomePalette) {
  const cx = 10 + ((rng() * (TILE_SIZE - 20)) | 0);
  const baseY = TILE_SIZE - 1;
  const trunkH = 10 + ((rng() * 3) | 0);
  // Tronc épais (2-3 px).
  const trunkW = 2 + ((rng() * 2) | 0);
  for (let y = 0; y < trunkH; y++) {
    for (let x = 0; x < trunkW; x++) {
      px(ctx, cx + x, baseY - y, shade('#5a3a22', 0.7 + rng() * 0.35));
    }
  }
  // Double couronne : un amas bas + un amas plus haut et plus large.
  const blobs: Array<[number, number, number]> = [
    [baseY - trunkH + 2, 0, 6 + ((rng() * 2) | 0)],
    [baseY - trunkH - 3, 0, 7 + ((rng() * 2) | 0)],
  ];
  for (const [by, , r] of blobs) {
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        if (x * x + y * y > r * r) continue;
        if (rng() > 0.82) continue;
        const f = 0.55 + rng() * 0.5;
        px(ctx, cx + x, by + y, shade(p.accent, f));
      }
    }
  }
}

/** Buisson bas : touffe de feuillage au sol. */
export function drawBush(ctx: CanvasRenderingContext2D, rng: Rng, p: BiomePalette) {
  const cx = 6 + ((rng() * (TILE_SIZE - 12)) | 0);
  const cy = TILE_SIZE - 6 - ((rng() * 4) | 0);
  const r = 3 + ((rng() * 2) | 0);
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y > r * r) continue;
      if (rng() > 0.8) continue;
      const f = 0.55 + rng() * 0.4;
      px(ctx, cx + x, cy + y, shade(p.accent, f));
    }
  }
}

/** Forêt — sol : herbe verte avec taches, brins et fleurs. */
export function forestFloor(ctx: CanvasRenderingContext2D, rng: Rng) {
  rect(ctx, 0, 0, TILE_SIZE, TILE_SIZE, '#2a4a30');
  const greens = ['#24402a', '#2a4a30', '#1f3a26', '#325a38', '#284830'];
  for (let i = 0; i < 12; i++) {
    const x = Math.floor(rng() * 28), y = Math.floor(rng() * 28);
    const w = 2 + Math.floor(rng() * 6), h = 2 + Math.floor(rng() * 4);
    rect(ctx, x, y, w, h, greens[Math.floor(rng() * greens.length)]);
  }
  for (let i = 0; i < 15; i++) {
    const x = Math.floor(rng() * 31), y = Math.floor(rng() * 31);
    rect(ctx, x, y, 1, 1 + Math.floor(rng() * 2), rng() < 0.5 ? '#3a6a40' : '#4a7a50');
  }
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(rng() * 30), y = Math.floor(rng() * 30);
    rect(ctx, x, y, 1, 1, rng() < 0.5 ? '#c49454' : '#a07840');
    if (rng() < 0.4) rect(ctx, x + 1, y, 1, 1, '#c49454');
  }
  for (let i = 0; i < 3; i++) {
    const x = Math.floor(rng() * 28), y = Math.floor(rng() * 28);
    rect(ctx, x, y, 3 + Math.floor(rng() * 4), 2 + Math.floor(rng() * 3), '#1a3020');
  }
}

/** Forêt — mur : sous-bois sombre avec texture. */
export function forestWall(ctx: CanvasRenderingContext2D, rng: Rng) {
  rect(ctx, 0, 0, TILE_SIZE, TILE_SIZE, '#0c1a10');
  const greens = ['#0c1a10', '#10241a', '#0a160c', '#142a1e', '#0e2016'];
  for (let i = 0; i < 10; i++) {
    const x = Math.floor(rng() * 28), y = Math.floor(rng() * 28);
    const w = 3 + Math.floor(rng() * 8), h = 2 + Math.floor(rng() * 5);
    rect(ctx, x, y, w, h, greens[Math.floor(rng() * greens.length)]);
  }
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(rng() * 31), y = Math.floor(rng() * 31);
    rect(ctx, x, y, 1, 1 + Math.floor(rng() * 2), rng() < 0.5 ? '#1a3a24' : '#142a1e');
  }
}
