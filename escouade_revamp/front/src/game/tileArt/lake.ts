/**
 * tileArt/lake — Lac de Qual-Chen : eau + berges (port de qual-chen-lake-tiles.js).
 * Le lac est un cercle d'eau praticable (barque). Les cases « mur » sont les
 * berges. Le masque d'arête (LN/LE/LS/LW) indique, pour une berge, le côté
 * qui borde l'eau (et inversement pour l'eau) → la boue / le liseré peu
 * profond / les roseaux suivent le rivage pour une transition fluide.
 */
import type { Rng } from './types';
import { px, rect, thickLine } from './primitives';

/** Bits de masque d'arête (directions cardinales). */
export const LN = 1, LE = 2, LS = 4, LW = 8;

/** Palette du lac (terre, herbe, eau, roseaux). */
const LAKE_PAL = {
  soilDeep: '#46382d', soil: '#74513b', soilLight: '#9a7350', soilSpeck: '#c09564',
  grassDeep: '#253f2e', grass: '#456e3e', grassLight: '#6f9551', grassSun: '#a0b66b',
  moss: '#557450', stone: '#8b8b79', stoneDark: '#555b57',
  waterDeep: '#123e50', water: '#1c5c69', waterMid: '#277b85', waterLight: '#42969b',
  waterFoam: '#91bdac', shallow: '#557e6d', mud: '#584536', mudLight: '#86664a',
  reedDark: '#405e37', reed: '#78904a', reedLight: '#b0aa66', reedGold: '#c4a46a',
  shadow: '#1a2e2b',
};

/** Terre / sol nu (base des berges). */
export function lakeEarth(ctx: CanvasRenderingContext2D, r: Rng) {
  rect(ctx, 0, 0, 32, 32, LAKE_PAL.soilDeep);
  for (let i = 0; i < 43; i++) {
    const x = Math.floor(r() * 32), y = Math.floor(r() * 32);
    rect(ctx, x, y, 2 + Math.floor(r() * 6), 1 + Math.floor(r() * 3),
      [LAKE_PAL.soil, LAKE_PAL.soilLight, LAKE_PAL.soilDeep][Math.floor(r() * 3)]);
  }
  for (let i = 0; i < 18; i++) {
    const x = Math.floor(r() * 32), y = Math.floor(r() * 32);
    rect(ctx, x, y, 1 + r() * 2, 1, r() > 0.55 ? LAKE_PAL.soilSpeck : LAKE_PAL.mud);
  }
  for (let i = 0; i < 8; i++) {
    const x = Math.floor(r() * 30), y = Math.floor(r() * 30);
    rect(ctx, x, y, 3, 2, LAKE_PAL.grassDeep);
    rect(ctx, x + 1, y - 1, 1, 2, LAKE_PAL.grassLight);
  }
}

/** Eau du lac. */
export function lakeWater(ctx: CanvasRenderingContext2D, r: Rng) {
  rect(ctx, 0, 0, 32, 32, LAKE_PAL.waterDeep);
  for (let i = 0; i < 22; i++) {
    const x = Math.floor(r() * 32), y = Math.floor(r() * 32);
    rect(ctx, x, y, 3 + Math.floor(r() * 8), 1 + Math.floor(r() * 3),
      [LAKE_PAL.water, LAKE_PAL.waterMid, LAKE_PAL.waterDeep][Math.floor(r() * 3)]);
  }
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(r() * 27), y = Math.floor(r() * 31);
    rect(ctx, x, y, 3 + Math.floor(r() * 3), 1, LAKE_PAL.waterLight);
    if (r() > 0.5) rect(ctx, x + 4, y + 2, 2, 1, LAKE_PAL.waterMid);
  }
}

/** Berge (terre) bordant l'eau : boue humide + terre sèche, **sans herbe**
 *  (la zone proche du rivage reste boueuse, avec roseaux). */
export function lakeLandBank(ctx: CanvasRenderingContext2D, r: Rng, m: number) {
  if (!m) return;
  const depths = [3, 5, 7];
  const dist = (x: number, y: number) => {
    let d = 99;
    if (m & LN) d = Math.min(d, y);
    if (m & LE) d = Math.min(d, 31 - x);
    if (m & LS) d = Math.min(d, 31 - y);
    if (m & LW) d = Math.min(d, x);
    return d;
  };
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const d = dist(x, y);
      const wobble = ((x * 3 + y * 5 + Math.floor(r() * 2)) % 7 === 0) ? 1 : 0;
      if (d < depths[0]) px(ctx, x, y, LAKE_PAL.mud);
      else if (d < depths[1] + wobble) px(ctx, x, y, LAKE_PAL.soil);
      else if (d < depths[2] + wobble && (x + y) % 3 !== 0) px(ctx, x, y, LAKE_PAL.soilLight);
    }
  }
  // Quelques touffes d'herbe en retrait (pas dans la boue).
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(r() * 32), y = Math.floor(r() * 32);
    if (dist(x, y) < depths[1]) continue;
    rect(ctx, x, y, 2, 1, LAKE_PAL.grassLight);
  }
}

/** Case de berge **éloignée** de l'eau (edgeMask = 0) : herbe dense. */
export function lakeGrass(ctx: CanvasRenderingContext2D, r: Rng) {
  rect(ctx, 0, 0, 32, 32, LAKE_PAL.grassDeep);
  for (let i = 0; i < 42; i++) {
    const x = Math.floor(r() * 32), y = Math.floor(r() * 32);
    rect(ctx, x, y, 2 + Math.floor(r() * 7), 1 + Math.floor(r() * 4),
      [LAKE_PAL.grass, LAKE_PAL.grassDeep, LAKE_PAL.moss, LAKE_PAL.grassLight][Math.floor(r() * 4)]);
  }
  for (let i = 0; i < 15; i++) {
    const x = Math.floor(r() * 32), y = Math.floor(r() * 32);
    rect(ctx, x, y, 1 + r() * 2, 1, r() > 0.6 ? LAKE_PAL.grassSun : LAKE_PAL.grassLight);
    if (r() > 0.6) rect(ctx, x + 1, y - 2, 1, 2, LAKE_PAL.grassLight);
  }
  for (let i = 0; i < 4; i++) {
    const x = Math.floor(r() * 28), y = Math.floor(r() * 28);
    rect(ctx, x, y, 3, 2, LAKE_PAL.stoneDark);
    rect(ctx, x + 1, y, 2, 1, LAKE_PAL.stone);
  }
}

/** Eau bordant la terre : liseré de boue + ligne d'eau peu profonde. */
export function lakeWaterBank(ctx: CanvasRenderingContext2D, m: number) {
  if (!m) return;
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      let d = 99;
      if (m & LN) d = Math.min(d, y);
      if (m & LE) d = Math.min(d, 31 - x);
      if (m & LS) d = Math.min(d, 31 - y);
      if (m & LW) d = Math.min(d, x);
      const jag = ((x * 7 + y * 3) % 11 === 0) ? 1 : 0;
      if (d < 2 + jag) px(ctx, x, y, LAKE_PAL.mud);
      else if (d < 4 + jag) px(ctx, x, y, LAKE_PAL.mudLight);
      else if (d < 7 + jag) px(ctx, x, y, LAKE_PAL.shallow);
      else if (d < 10 + jag && (x + y) % 3 !== 0) px(ctx, x, y, LAKE_PAL.waterMid);
    }
  }
}

/** Roseau individuel (tige inclinée + tête brune + feuilles). */
function lakeReed(ctx: CanvasRenderingContext2D, r: Rng, x: number, base: number, h: number) {
  const lean = Math.floor(r() * 5) - 2;
  thickLine(ctx, x, base, x + lean, base - h, LAKE_PAL.reedDark, 2);
  thickLine(ctx, x, base - 1, x + lean, base - h, LAKE_PAL.reedLight, 1);
  if (r() > 0.34) {
    rect(ctx, x + lean - 1, base - h - 2, 3, 5, LAKE_PAL.reedGold);
    rect(ctx, x + lean, base - h - 2, 1, 3, LAKE_PAL.reedGold);
  }
  thickLine(ctx, x, base - 2, x - 3 - Math.floor(r() * 3), base - 7, LAKE_PAL.reed, 2);
  thickLine(ctx, x, base - 2, x + 3 + Math.floor(r() * 3), base - 8, LAKE_PAL.reedLight, 1);
}

/** Bouquet de roseaux côté berge (selon le masque d'arête). */
export function lakeReeds(ctx: CanvasRenderingContext2D, r: Rng, m: number) {
  const loc: Array<[number, number]> = [];
  if (m & LN) loc.push([5, 18], [11, 20], [17, 21], [23, 20], [28, 18]);
  if (m & LS) loc.push([5, 30], [11, 29], [17, 30], [23, 29], [28, 30]);
  if (m & LW) loc.push([8, 14], [12, 22], [8, 28]);
  if (m & LE) loc.push([24, 14], [20, 22], [24, 28]);
  if (!loc.length) loc.push([8, 27], [16, 25], [25, 29]);
  for (let i = 0; i < loc.length; i++) {
    const [xx, yy] = loc[i];
    const x = Math.max(3, Math.min(28, xx + Math.floor(r() * 5) - 2));
    const y = Math.max(14, Math.min(31, yy));
    rect(ctx, x - 2, y - 1, 5, 2, LAKE_PAL.shadow);
    lakeReed(ctx, r, x, y, 9 + Math.floor(r() * 9));
  }
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(r() * 30), y = Math.floor(r() * 30);
    rect(ctx, x, y, 2, 1, LAKE_PAL.waterFoam);
  }
}
