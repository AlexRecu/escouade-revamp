/**
 * tileArt — Génération procédurale de textures de tuiles (Canvas 2D, pixel-art).
 *
 * Remplace les aplats CSS des tuiles de donjon par des textures dessinées au
 * chargement : variations de dalles, nuances de couleurs, décorations par
 * biome (arbres, herbe, rochers, sable…). Chaque texture est un petit canvas
 * 32×32 converti en dataURL et **mémorisé** (généré une seule fois par biome).
 *
 * La sélection de variante par case est **déterministe** (hash de
 * row/col/étage/biome) : les tuiles restent stables entre les re-renders,
 * sans état à gérer côté serveur.
 *
 * Ce module est le point d'entrée : il contient la logique de rendu, les
 * palettes par biome et l'API publique. Le dessin de chaque biome est isolé
 * dans un fichier dédié (forest.ts, cave.ts, tower.ts, castle.ts, canyon.ts,
 * frozen.ts, lake.ts) pour la lisibilité.
 *
 * Usage :
 *   const url = tileFor('forest', 'floor', r, c, floor);
 *   <div style={{ backgroundImage: `url(${url})` }} />
 */

import {
  TILE_SIZE,
  type BiomeKey,
  type BiomePalette,
  type BiomeArt,
} from './types';
import { makeRng, hashTile, pickVariant } from './rng';
import { noisyFill, rect } from './primitives';
import { drawRock, drawWeb } from './decorations';
import { drawTree, drawBigTree, drawBush, forestFloor, forestWall } from './forest';
import { caveFloor, caveWall } from './cave';
import { towerFloor, towerWall } from './tower';
import {
  drawCastlePainting, drawCastleSconce, drawCastleMirror, drawCastleStatue,
  castleFloor, castleWall,
} from './castle';
import { canyonFloor, canyonWall } from './canyon';
import { drawDeadTree, drawSnowPine, frozenFloor, frozenWall } from './frozen';
import {
  lakeWater, lakeWaterBank, lakeEarth, lakeLandBank, lakeGrass, lakeReeds,
} from './lake';

// Re-exports de l'API publique (types, constantes, utilitaires).
export { TILE_SIZE } from './types';
export type { BiomeKey, BiomeArt, BiomePalette, DecorSpec, Rng } from './types';
export { makeRng, hashTile, pickVariant } from './rng';
export { LN, LE, LS, LW } from './lake';

/** Nombre de variantes générées par type (sol / mur). */
const FLOOR_VARIANTS = 6;
const WALL_VARIANTS = 4;

/* ── Rendu d'une tuile ───────────────────────────────────────────────────── */

function renderTile(
  kind: 'floor' | 'wall',
  palette: BiomePalette,
  seed: number,
  facing?: boolean,
  forceDecor?: number,
  edgeMask = 0
): string {
  const canvas = document.createElement('canvas');
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.imageSmoothingEnabled = false;
  const rng = makeRng(seed);

  // Lac : sol = eau, mur = berge. Le masque d'arête oriente la transition
  // eau/terre (boue, liseré peu profond, roseaux) vers le rivage.
  if (palette.lake) {
    if (kind === 'floor') {
      lakeWater(ctx, rng);
      lakeWaterBank(ctx, edgeMask);
    } else if (edgeMask) {
      // Berge directement au bord de l'eau : boue + roseaux.
      lakeEarth(ctx, rng);
      lakeLandBank(ctx, rng, edgeMask);
      if (rng() < 0.8) lakeReeds(ctx, rng, edgeMask);
    } else {
      // Berge éloignée de l'eau : herbe dense.
      lakeGrass(ctx, rng);
    }
    return canvas.toDataURL('image/png');
  }

  // Rendu sur mesure (tower, forest, cave, canyon, frozen).
  if (palette.customRender) {
    palette.customRender(ctx, rng, kind);
  } else if (palette.castle) {
    if (kind === 'floor') castleFloor(ctx, rng);
    else castleWall(ctx, rng);
  } else if (kind === 'floor') {
    noisyFill(ctx, palette.floor, rng, 0.14);
    // Joints de dalle : grille discrète (2×2 dalles par tuile).
    ctx.globalAlpha = 0.35;
    rect(ctx, 0, 15, TILE_SIZE, 1, palette.seam);
    rect(ctx, 15, 0, 1, TILE_SIZE, palette.seam);
    ctx.globalAlpha = 1;
  } else {
    noisyFill(ctx, palette.wall, rng, 0.16);
    // Motif de briques / pierres.
    ctx.globalAlpha = 0.4;
    for (let y = 0; y < TILE_SIZE; y += 8) rect(ctx, 0, y, TILE_SIZE, 1, palette.seam);
    for (let y = 0; y < TILE_SIZE; y += 8) {
      const off = (y / 8) % 2 === 0 ? 0 : 8;
      for (let x = off; x < TILE_SIZE; x += 16) rect(ctx, x, y, 1, 8, palette.seam);
    }
    ctx.globalAlpha = 1;
  }

  // Décorations :
  //  - `forceDecor` : force un décor précis (par index) — utilisé pour générer
  //    des variantes de mur face avec une répartition garantie (ex. château).
  //  - `multiDecor` : chaque décor est tiré indépendamment (proba = weight),
  //    plusieurs décors peuvent coexister sur une tuile (forêt, caverne, lac).
  //  - sinon : au plus UNE déco par tuile, choisie au poids (lisibilité).
  const applicable = palette.decor.filter((d) => d.on === 'both' || d.on === kind);
  if (forceDecor != null && applicable[forceDecor]) {
    applicable[forceDecor].draw(ctx, rng, palette);
  } else if (palette.multiDecor) {
    for (const d of applicable) {
      if (d.oriented && !facing) continue;
      if (rng() < (d.weight ?? palette.decorDensity)) d.draw(ctx, rng, palette);
    }
  } else if (applicable.length > 0 && rng() < palette.decorDensity) {
    const pool = applicable.filter((d) => !d.oriented || facing);
    if (pool.length > 0) {
      const total = pool.reduce((s, d) => s + (d.weight ?? 1), 0);
      let r = rng() * total;
      for (const d of pool) {
        r -= d.weight ?? 1;
        if (r <= 0) {
          d.draw(ctx, rng, palette);
          break;
        }
      }
    }
  }

  return canvas.toDataURL('image/png');
}

/* ── Palettes par biome ──────────────────────────────────────────────────── */

const PALETTES: Record<BiomeKey, BiomePalette> = {
  forest: {
    floor: ['#24402a', '#2a4a30', '#1f3a26'],
    wall: ['#0c1a10', '#10241a', '#0a160c'],
    seam: '#16281b',
    accent: '#6fce8a',
    decorDensity: 0.5,
    multiDecor: true,
    customRender: (ctx, rng, kind) => {
      if (kind === 'floor') forestFloor(ctx, rng);
      else forestWall(ctx, rng);
    },
    decor: [
      { on: 'wall', draw: drawTree },
      { on: 'wall', draw: drawBigTree },
      { on: 'wall', draw: drawBush },
    ],
  },
  cave: {
    floor: ['#2a3148', '#333a52', '#232a40'],
    wall: ['#0a0e1a', '#0e1424', '#080b14'],
    seam: '#171d2e',
    accent: '#7fa8ff',
    decorDensity: 0.5,
    multiDecor: true,
    customRender: (ctx, rng, kind) => {
      if (kind === 'floor') caveFloor(ctx, rng);
      else caveWall(ctx, rng);
    },
    decor: [
      { on: 'wall', draw: drawRock, weight: 0.5 },
      { on: 'wall', draw: drawWeb, weight: 0.25 },
    ],
  },
  tower: {
    floor: ['#33334a', '#3a3a52', '#2c2c42'],
    wall: ['#101018', '#14141e', '#0c0c12'],
    seam: '#1c1c2a',
    accent: '#b9a7ff',
    decorDensity: 0.5,
    customRender: (ctx, rng, kind) => {
      if (kind === 'floor') towerFloor(ctx, rng);
      else towerWall(ctx, rng);
    },
    decor: [{ on: 'wall', draw: drawWeb }],
  },
  castle: {
    floor: ['#3a3040', '#423848', '#332a38'],
    wall: ['#141018', '#18121c', '#100c12'],
    seam: '#221c28',
    accent: '#e8c15a',
    decorDensity: 0.2,
    castle: true,
    wallFacing: true,
    decor: [
      { on: 'wall', oriented: true, draw: drawCastlePainting, weight: 1 },
      { on: 'wall', oriented: true, draw: drawCastleSconce, weight: 1 },
      { on: 'wall', oriented: true, draw: drawCastleMirror, weight: 1 },
      { on: 'wall', oriented: true, draw: drawCastleStatue, weight: 1 },
    ],
  },
  canyon: {
    floor: ['#4a3a24', '#544228', '#423220'],
    wall: ['#1a120a', '#201810', '#140e08'],
    seam: '#2a2014',
    accent: '#e8a85a',
    decorDensity: 0.5,
    customRender: (ctx, rng, kind) => {
      if (kind === 'floor') canyonFloor(ctx, rng);
      else canyonWall(ctx, rng);
    },
    decor: [{ on: 'wall', draw: drawRock }],
  },
  frozen: {
    floor: ['#2e4a62', '#36546c', '#284258'],
    wall: ['#0a1420', '#0e1a28', '#081018'],
    seam: '#182838',
    accent: '#8fd8ff',
    decorDensity: 0.9,
    customRender: (ctx, rng, kind) => {
      if (kind === 'floor') frozenFloor(ctx, rng);
      else frozenWall(ctx, rng);
    },
    decor: [
      { on: 'wall', weight: 1, draw: drawDeadTree },
      { on: 'wall', weight: 3, draw: (ctx, rng, p) => drawSnowPine(ctx, rng, p, false) },
      { on: 'wall', weight: 3, draw: (ctx, rng, p) => drawSnowPine(ctx, rng, p, true) },
    ],
  },
  lake: {
    // Rendu spécial (flag `lake`) : sol = eau, mur = berge, avec masque
    // d'arête pour une transition fluide (voir lake.ts).
    floor: [],
    wall: [],
    seam: '#2a2418',
    accent: '#6fce8a',
    decorDensity: 0,
    lake: true,
    decor: [],
  },
};

/* ── Cache + API publique ────────────────────────────────────────────────── */

const cache = new Map<BiomeKey, BiomeArt>();

/**
 * Renvoie (et met en cache) le jeu de textures d'un biome.
 * Génère FLOOR_VARIANTS sols + WALL_VARIANTS murs.
 */
export function getBiomeArt(biome: BiomeKey): BiomeArt {
  const hit = cache.get(biome);
  if (hit) return hit;

  const palette = PALETTES[biome] ?? PALETTES.forest;
  const base = hashTile(0, 0, 0, biome);

  // Lac : on génère des variantes par **masque d'arête** (0..15) pour que la
  // transition eau/terre suive le rivage. 2 variantes par masque.
  if (palette.lake) {
    const art: BiomeArt = { floor: [], wall: [], lakeFloor: {}, lakeWall: {} };
    for (let mask = 0; mask < 16; mask++) {
      art.lakeFloor![mask] = [];
      art.lakeWall![mask] = [];
      for (let i = 0; i < 2; i++) {
        art.lakeFloor![mask].push(renderTile('floor', palette, base + mask * 1000 + i * 7919, undefined, undefined, mask));
        art.lakeWall![mask].push(renderTile('wall', palette, base + mask * 1000 + i * 104729, undefined, undefined, mask));
      }
    }
    cache.set(biome, art);
    return art;
  }

  const floor: string[] = [];
  const wall: string[] = [];
  // Graines stables par biome pour des variantes reproductibles.
  for (let i = 0; i < FLOOR_VARIANTS; i++) floor.push(renderTile('floor', palette, base + i * 7919));
  for (let i = 0; i < WALL_VARIANTS; i++) wall.push(renderTile('wall', palette, base + i * 104729));

  const art: BiomeArt = { floor, wall };
  // Variantes de mur « face praticable » (ex. décors du château, qui ne
  // se placent que sur un mur adjacent en cardinal à une case praticable).
  // La répartition des décors est **déterministe** selon leurs poids : sur
  // WALL_VARIANTS variantes, on force N_i décors de type i (N_i ∝ weight),
  // pour garantir la présence de chaque type.
  if (palette.wallFacing) {
    const wallDecor = palette.decor.filter((d) => d.on === 'wall' || d.on === 'both');
    const totalW = wallDecor.reduce((s, d) => s + (d.weight ?? 1), 0);
    // Nombre de variantes par décor (répartition proportionnelle, arrondi).
    const counts = wallDecor.map((d) => Math.round(((d.weight ?? 1) / totalW) * WALL_VARIANTS));
    // Ajuste pour que la somme fasse bien WALL_VARIANTS.
    let sum = counts.reduce((s, n) => s + n, 0);
    let idx = 0;
    while (sum < WALL_VARIANTS) {
      counts[idx % counts.length]++;
      sum++;
      idx++;
    }
    while (sum > WALL_VARIANTS && counts.some((n) => n > 0)) {
      const k = counts.findIndex((n) => n > 0);
      counts[k]--;
      sum--;
    }
    // Déroule la liste des indices de décor à forcer.
    const forced: number[] = [];
    counts.forEach((n, di) => {
      for (let k = 0; k < n; k++) forced.push(di);
    });
    art.wallFace = forced.map((di, i) =>
      renderTile('wall', palette, base + 30011 + i * 104729, true, di)
    );
  }
  cache.set(biome, art);
  return art;
}

/**
 * Renvoie la dataURL de la tuile (sol ou mur) pour une case donnée.
 * `facing` : true si le mur est adjacent (cardinale) à une case praticable
 * (décors orientés, ex. décors du château).
 * `edgeMask` : masque d'arête (LN/LE/LS/LW) pour le lac — indique le côté
 * qui borde l'eau (berge) ou la terre (eau).
 */
export function tileFor(
  biome: BiomeKey,
  kind: 'floor' | 'wall',
  row: number,
  col: number,
  floor: number,
  facing?: boolean,
  edgeMask = 0
): string {
  const art = getBiomeArt(biome);
  if (art.lakeFloor && art.lakeWall) {
    const list = (kind === 'floor' ? art.lakeFloor : art.lakeWall)[edgeMask & 15];
    if (list && list.length) return pickVariant(list, hashTile(row, col, floor, biome));
  }
  if (kind === 'wall' && facing && art.wallFace) {
    return pickVariant(art.wallFace, hashTile(row, col, floor, biome));
  }
  const urls = kind === 'floor' ? art.floor : art.wall;
  return pickVariant(urls, hashTile(row, col, floor, biome));
}
