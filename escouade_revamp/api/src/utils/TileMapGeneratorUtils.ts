import { Position, ChestType } from "../classes/Types";
import type { ZoneType } from "../classes/World/Zone";
import { pickRandomItems, seededRandom } from "./RandomUtils";

const MAP_SIZE = 14;
type TileMap = boolean[][];

const directions: Record<string, { row: number; col: number }> = {
    north: { row: -1, col: 0 },
    south: { row: 1, col: 0 },
    east: { row: 0, col: 1 },
    west: { row: 0, col: -1 },
};

/** Position + type d'un coffre généré sur un étage. */
export type ChestPlacement = {
    position: Position;
    type: ChestType;
};

export type DungeonFloor = {
    tileMap: TileMap;
    startTile: Position;
    endTile: Position;
    campfires: Position[];
    /** Impasses (culs-de-sac) de la map : cases avec un seul voisin praticable. */
    deadEnds: Position[];
    /** Coffres de l'étage (position + type commun/rare). */
    chests: ChestPlacement[];
};

/**
 * Profil de génération par biome : c'est ce qui donne la **variété** entre
 * donjons à taille égale.
 *
 * - `spineLength` : longueur cible du chemin principal (départ → sortie).
 * - `turnChance` : probabilité de tourner à chaque pas (sinuosité).
 * - `branches` : [min, max] de branches (culs-de-sac) greffées sur le spine.
 * - `branchLength` : [min, max] de longueur d'une branche.
 * - `wide` : couloirs élargis (poches de largeur 2) pour les biomes ouverts.
 * - `campfires` : [min, max] de feux de camp (placés le long du spine).
 */
export type BiomeProfile = {
    spineLength: number;
    turnChance: number;
    branches: [number, number];
    branchLength: [number, number];
    wide: boolean;
    campfires: [number, number];
};

/**
 * Paramètres par biome (variété à taille égale) :
 *  - Forêt : méandres sinueux, peu de branches.
 *  - Grotte : dédale, beaucoup de branches (impasses).
 *  - Tour : long et linéaire, quasi pas de branches.
 *  - Château : branches plus longues (petites salles).
 *  - Canyon / Terres Gelées : couloirs larges (ouverts).
 *  - Lac : map dédiée (generateLakeMap), profil non utilisé.
 */
const BIOME_PROFILES: Record<ZoneType, BiomeProfile> = {
    Forest:     { spineLength: 10, turnChance: 0.5,  branches: [1, 2], branchLength: [1, 2], wide: false, campfires: [1, 1] },
    Cave:       { spineLength: 9,  turnChance: 0.6,  branches: [3, 4], branchLength: [1, 2], wide: false, campfires: [1, 1] },
    Tower:      { spineLength: 11, turnChance: 0.25, branches: [0, 1], branchLength: [1, 1], wide: false, campfires: [1, 1] },
    Castle:     { spineLength: 9,  turnChance: 0.4,  branches: [2, 3], branchLength: [1, 3], wide: false, campfires: [1, 1] },
    Canyon:     { spineLength: 9,  turnChance: 0.4,  branches: [2, 3], branchLength: [1, 2], wide: true,  campfires: [1, 1] },
    FrozenLand: { spineLength: 9,  turnChance: 0.4,  branches: [2, 3], branchLength: [1, 2], wide: true,  campfires: [1, 1] },
    Lake:       { spineLength: 9,  turnChance: 0.4,  branches: [0, 0], branchLength: [1, 1], wide: false, campfires: [0, 0] },
};

const DEFAULT_PROFILE: BiomeProfile = BIOME_PROFILES.Forest;

/**
 * Génère un étage de donjon : **colonne vertébrale** (chemin principal
 * sinueux départ → sortie) + **branches** (culs-de-sac) + feux de camp
 * stratégiques. La structure est paramétrée par biome (variété) et le seed
 * rend chaque entrée unique (régénération à chaque entrée).
 *
 * @param seed graine déterministe (mulberry32).
 * @param options.biome biome → profil de génération.
 * @param options.wideCorridors (compat) force le mode couloirs larges.
 */
export function generateTileMapWithFeatures(
    seed: number = Date.now(),
    options: { biome?: ZoneType; wideCorridors?: boolean; maxTiles?: number } = {}
): DungeonFloor {
    const profile = options.biome ? BIOME_PROFILES[options.biome] ?? DEFAULT_PROFILE : DEFAULT_PROFILE;
    const wide = profile.wide || options.wideCorridors === true;
    const rand = seededRandom(seed);
    const map: TileMap = Array.from({ length: MAP_SIZE }, () => Array(MAP_SIZE).fill(false));

    const start: Position = { row: Math.floor(MAP_SIZE / 2), col: Math.floor(MAP_SIZE / 2) };
    map[start.row][start.col] = true;

    // 1. Colonne vertébrale : chemin principal sinueux (départ → sortie).
    const spine = growSpine(map, start, profile, rand);
    const startTile = spine[0];
    const endTile = spine[spine.length - 1];

    // 2. Branches (culs-de-sac) greffées sur le spine (hors extrémités).
    const branchCount = randInt(profile.branches[0], profile.branches[1], rand);
    const anchors = pickRandomItems(spine.slice(1, -1), branchCount, rand);
    for (const anchor of anchors) growBranch(map, anchor, profile, rand);

    // 3. Élargissement (biomes ouverts) : poches de largeur 2 le long du spine.
    if (wide) widenSpine(map, spine, rand);

    // 4. Feux de camp stratégiques (répartis le long du spine).
    const campfireCount = randInt(profile.campfires[0], profile.campfires[1], rand);
    const campfires = placeStrategicCampfires(spine, campfireCount, rand);

    const deadEnds = findDeadEnds(map);

    // 5. Coffres (communs + rares) : en impasse si possible, sinon loin de la sortie.
    const chests = placeChests(map, startTile, endTile, campfires, deadEnds, rand);

    return { tileMap: map, startTile, endTile, campfires, deadEnds, chests };
}

/**
 * Place les coffres de l'étage.
 *
 * Probabilités (indépendantes → 0, 1 ou 2 coffres) :
 *  - coffre **commun** : 30%
 *  - coffre **rare**   : 10%
 *
 * Placement : priorité aux **impasses** (culs-de-sac, naturellement loin de la
 * sortie), sinon les cases les plus **éloignées de la sortie** (BFS). On évite
 * la case de départ, la sortie et les feux de camp.
 */
function placeChests(
    map: TileMap,
    startTile: Position,
    endTile: Position,
    campfires: Position[],
    deadEnds: Position[],
    rand: () => number
): ChestPlacement[] {
    const hasCommon = rand() < 0.30;
    const hasRare = rand() < 0.10;
    if (!hasCommon && !hasRare) return [];

    const dist = distanceToEnd(map, endTile);
    const campfireSet = new Set(campfires.map((c) => `${c.row},${c.col}`));
    const deadEndSet = new Set(deadEnds.map((c) => `${c.row},${c.col}`));
    const startKey = `${startTile.row},${startTile.col}`;
    const endKey = `${endTile.row},${endTile.col}`;

    // Candidats : cases praticables, pas start/sortie/feu de camp, à ≥ 2 pas de la sortie.
    const candidates: { pos: Position; d: number; isDeadEnd: boolean }[] = [];
    for (let r = 0; r < map.length; r++) {
        for (let c = 0; c < map[r].length; c++) {
            if (!map[r][c]) continue;
            const key = `${r},${c}`;
            if (key === startKey || key === endKey || campfireSet.has(key)) continue;
            const d = dist.get(key);
            if (d == null || d < 2) continue;
            candidates.push({ pos: { row: r, col: c }, d, isDeadEnd: deadEndSet.has(key) });
        }
    }
    if (candidates.length === 0) return [];

    // Trier : impasses d'abord, puis distance décroissante (les plus loin de la sortie).
    candidates.sort((a, b) => {
        if (a.isDeadEnd !== b.isDeadEnd) return a.isDeadEnd ? -1 : 1;
        return b.d - a.d;
    });

    const chests: ChestPlacement[] = [];
    const used = new Set<string>();
    const pick = (): Position | null => {
        // Choisit aléatoirement parmi les 3 meilleurs candidats non utilisés.
        const top = candidates.filter((c) => !used.has(`${c.pos.row},${c.pos.col}`)).slice(0, 3);
        if (top.length === 0) return null;
        const chosen = top[Math.floor(rand() * top.length)];
        used.add(`${chosen.pos.row},${chosen.pos.col}`);
        return chosen.pos;
    };

    if (hasCommon) {
        const pos = pick();
        if (pos) chests.push({ position: pos, type: "common" });
    }
    if (hasRare) {
        const pos = pick();
        if (pos) chests.push({ position: pos, type: "rare" });
    }
    return chests;
}

/** Distance (BFS) de chaque case praticable à la sortie. */
function distanceToEnd(map: TileMap, end: Position): Map<string, number> {
    const dist = new Map<string, number>();
    const queue: Position[] = [end];
    dist.set(`${end.row},${end.col}`, 0);
    while (queue.length > 0) {
        const cur = queue.shift()!;
        const d = dist.get(`${cur.row},${cur.col}`)!;
        for (const dir of Object.values(directions)) {
            const n = { row: cur.row + dir.row, col: cur.col + dir.col };
            const key = `${n.row},${n.col}`;
            if (isInBounds(n) && map[n.row][n.col] && !dist.has(key)) {
                dist.set(key, d + 1);
                queue.push(n);
            }
        }
    }
    return dist;
}

/** Tracé du chemin principal : avance en tournant aléatoirement (sinuosité). */
function growSpine(map: TileMap, start: Position, profile: BiomeProfile, rand: () => number): Position[] {
    const spine: Position[] = [start];
    let current = start;
    let dir = pickRandom(Object.values(directions), rand)!;
    for (let i = 1; i < profile.spineLength; i++) {
        if (rand() < profile.turnChance) dir = turn(dir, rand() < 0.5);
        let next = { row: current.row + dir.row, col: current.col + dir.col };
        if (!isInBounds(next) || map[next.row][next.col]) {
            // Bloqué : essayer tour horaire, anti-horaire, puis demi-tour.
            const candidates = [turn(dir, true), turn(dir, false), opposite(dir)].filter((d) => {
                const n = { row: current.row + d.row, col: current.col + d.col };
                return isInBounds(n) && !map[n.row][n.col];
            });
            if (candidates.length === 0) break; // coin mort : on arrête le spine
            dir = pickRandom(candidates, rand)!;
            next = { row: current.row + dir.row, col: current.col + dir.col };
        }
        map[next.row][next.col] = true;
        spine.push(next);
        current = next;
    }
    return spine;
}

/** Branche (cul-de-sac) partant d'une tuile du spine. */
function growBranch(map: TileMap, from: Position, profile: BiomeProfile, rand: () => number): void {
    const len = randInt(profile.branchLength[0], profile.branchLength[1], rand);
    const freeDirs = Object.values(directions).filter((d) => {
        const n = { row: from.row + d.row, col: from.col + d.col };
        return isInBounds(n) && !map[n.row][n.col];
    });
    const firstDir = pickRandom(freeDirs, rand);
    if (!firstDir) return;
    let dir: { row: number; col: number } = firstDir;
    let current = from;
    for (let i = 0; i < len; i++) {
        let next = { row: current.row + dir.row, col: current.col + dir.col };
        if (!isInBounds(next) || map[next.row][next.col]) {
            const candidates: { row: number; col: number }[] = [turn(dir, true), turn(dir, false)].filter((d) => {
                const n = { row: current.row + d.row, col: current.col + d.col };
                return isInBounds(n) && !map[n.row][n.col];
            });
            if (candidates.length === 0) break;
            dir = pickRandom(candidates, rand)!;
            next = { row: current.row + dir.row, col: current.col + dir.col };
        }
        map[next.row][next.col] = true;
        current = next;
    }
}

/** Élargit le spine (biomes ouverts) : ajoute ~1 tuile libre par tuile du spine. */
function widenSpine(map: TileMap, spine: Position[], rand: () => number): void {
    for (const tile of spine) {
        if (rand() > 0.5) continue;
        const free = [
            { row: tile.row, col: tile.col + 1 },
            { row: tile.row, col: tile.col - 1 },
            { row: tile.row + 1, col: tile.col },
            { row: tile.row - 1, col: tile.col },
        ].filter((n) => isInBounds(n) && !map[n.row][n.col]);
        const extra = pickRandom(free, rand);
        if (extra) map[extra.row][extra.col] = true;
    }
}

/** Feux de camp répartis le long du spine (hors extrémités), avec léger jitter. */
function placeStrategicCampfires(spine: Position[], count: number, rand: () => number): Position[] {
    const usable = spine.slice(1, -1);
    if (count === 0 || usable.length === 0) return [];
    const n = Math.min(count, usable.length);
    const result: Position[] = [];
    const step = usable.length / (n + 1);
    for (let i = 1; i <= n; i++) {
        let idx = Math.floor(step * i) + (Math.floor(rand() * 3) - 1);
        idx = Math.max(0, Math.min(usable.length - 1, idx));
        result.push(usable[idx]);
    }
    return result;
}

/** Rotation de 90° (horaire si `clockwise`, sinon anti-horaire). */
function turn(dir: { row: number; col: number }, clockwise: boolean): { row: number; col: number } {
    return clockwise ? { row: dir.col, col: -dir.row } : { row: -dir.col, col: dir.row };
}
function opposite(dir: { row: number; col: number }): { row: number; col: number } {
    return { row: -dir.row, col: -dir.col };
}
function pickRandom<T>(items: T[], rand: () => number): T | undefined {
    return items.length === 0 ? undefined : items[Math.floor(rand() * items.length)];
}
function randInt(min: number, max: number, rand: () => number): number {
    return min + Math.floor(rand() * (max - min + 1));
}

/**
 * Détecte les impasses (culs-de-sac) de la map : cases praticables qui n'ont
 * qu'**un seul** voisin praticable (hors diagonale).
 *
 * NB : le point de départ peut aussi être une impasse (1 voisin) ; on le
 * conserve dans la liste, c'est à l'appelant de filtrer si besoin.
 */
export function findDeadEnds(tileMap: TileMap): Position[] {
    const deadEnds: Position[] = [];
    for (let row = 0; row < tileMap.length; row++) {
        for (let col = 0; col < tileMap[row].length; col++) {
            if (!tileMap[row][col]) continue;
            let neighbors = 0;
            for (const dir of Object.values(directions)) {
                const r = row + dir.row;
                const c = col + dir.col;
                if (isInBounds({ row: r, col: c }) && tileMap[r][c]) neighbors++;
            }
            if (neighbors === 1) deadEnds.push({ row, col });
        }
    }
    return deadEnds;
}

function isInBounds(pos: Position): boolean {
    return pos.row >= 0 && pos.row < MAP_SIZE && pos.col >= 0 && pos.col < MAP_SIZE;
}

function distance(a: Position, b: Position): number {
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

export function placeCampfires(tileMap: boolean[][], count: number, avoid: Position[], rand: () => number): Position[] {
    const candidates = getAllValidTiles(tileMap).filter(tile =>
        avoid.every(av => distance(tile, av) >= 3)
    );
    return pickRandomItems(candidates, count, rand);
}

export function getAllValidTiles(tileMap: boolean[][]): Position[] {
    const tiles: Position[] = [];
    for (let row = 0; row < tileMap.length; row++) {
        for (let col = 0; col < tileMap[row].length; col++) {
            if (tileMap[row][col]) tiles.push({ row, col });
        }
    }
    return tiles;
}

/**
 * Génère la map du **lac** (zone dédiée, non aléatoire).
 *
 * Forme : un **cercle** fixe centré sur la carte (rayon 5). Au centre, **5
 * tuiles en croix** sont des spots de pêche (c'est en pêchant qu'apparaît
 * Mateus). Le reste du disque est praticable (rives / eau).
 *
 * Le **port** (bord sud du disque) est à la fois l'**entrée** et la **sortie**
 * du lac : on y arrive, on explore le lac, et on en repart par le même port.
 * C'est pourquoi `startTile` et `endTile` sont la même case (le port).
 *
 * @returns la tileMap, la case de départ/sortie (le port) et les 5 tuiles de pêche.
 */
export function generateLakeMap(): {
    tileMap: TileMap;
    startTile: Position;
    endTile: Position;
    fishingTiles: Position[];
} {
    const center = { row: Math.floor(MAP_SIZE / 2), col: Math.floor(MAP_SIZE / 2) };
    const radius = 5;
    const map: TileMap = Array.from({ length: MAP_SIZE }, () => Array(MAP_SIZE).fill(false));

    // Disque : toutes les cases à distance euclidienne <= rayon du centre.
    for (let row = 0; row < MAP_SIZE; row++) {
        for (let col = 0; col < MAP_SIZE; col++) {
            const d = Math.hypot(row - center.row, col - center.col);
            if (d <= radius) map[row][col] = true;
        }
    }

    // 5 tuiles de pêche en croix (centre + 4 voisins orthogonaux).
    const fishingTiles: Position[] = [
        { row: center.row, col: center.col },
        { row: center.row - 1, col: center.col },
        { row: center.row + 1, col: center.col },
        { row: center.row, col: center.col - 1 },
        { row: center.row, col: center.col + 1 },
    ];

    // Le port (bord sud du disque) est l'entrée ET la sortie du lac.
    const port: Position = { row: center.row + radius, col: center.col };
    const startTile = port;
    const endTile = { ...port };

    return { tileMap: map, startTile, endTile, fishingTiles };
}