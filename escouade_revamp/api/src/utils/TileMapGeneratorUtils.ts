import { Position } from "../classes/Types";
import { pickRandomItems, seededRandom } from "./RandomUtils";

const MAP_SIZE = 14;
type TileMap = boolean[][];

const directions: Record<string, { row: number; col: number }> = {
    north: { row: -1, col: 0 },
    south: { row: 1, col: 0 },
    east: { row: 0, col: 1 },
    west: { row: 0, col: -1 },
};

export type DungeonFloor = {
    tileMap: TileMap;
    startTile: Position;
    endTile: Position;
    campfires: Position[];
    /** Impasses (culs-de-sac) de la map : cases avec un seul voisin praticable. */
    deadEnds: Position[];
};

export function generateTileMapWithFeatures(
    seed: number = Date.now(),
    options: { wideCorridors?: boolean; maxTiles?: number } = {}
): DungeonFloor {
    // `wideCorridors` : autorise les blocs 2×2 (couloirs de largeur 2) au lieu
    // de corridors de largeur 1 (règle wouldCreate2x2). Utilisé pour les biomes
    // "ouverts" (Vallée des cendres, Terres Gelées).
    // `maxTiles` : nombre de tuiles praticables (plus il est haut, plus la map
    // est grande et plus le départ/arrivée sont éloignés).
    const { wideCorridors = false, maxTiles = 16 } = options;
    const rand = seededRandom(seed);
    const map: TileMap = Array.from({ length: MAP_SIZE }, () => Array(MAP_SIZE).fill(false));

    const start: Position = {
        row: Math.floor(MAP_SIZE / 2),
        col: Math.floor(MAP_SIZE / 2),
    };

    map[start.row][start.col] = true;

    const activeTiles: Position[] = [start];

    let tilesCreated = 1;
    // Garde-fou anti boucle infinie : on borne le nombre de tentatives pour ne
    // jamais bloquer (la map reste valide, juste plus petite).
    const maxIterations = 1000;
    let iterations = 0;

    while (tilesCreated < maxTiles && iterations < maxIterations) {
        iterations++;
        const base = activeTiles[Math.floor(rand() * activeTiles.length)];
        const shuffledDirs = Object.values(directions).sort(() => rand() - 0.5);

        let added = 0;
        for (let dir of shuffledDirs) {
            if (added >= 3) break;

            const newPos: Position = { row: base.row + dir.row, col: base.col + dir.col };

            // En mode couloirs larges, on autorise les blocs 2×2 (pas de
            // wouldCreate2x2) → passages plus ouverts.
            const blockedBy2x2 = !wideCorridors && wouldCreate2x2(newPos, map);
            if (
                isInBounds(newPos) &&
                !map[newPos.row][newPos.col] &&
                !blockedBy2x2
            ) {
                map[newPos.row][newPos.col] = true;
                activeTiles.push(newPos);
                tilesCreated++;
                added++;
            }
        }
    }

    const pathableTiles = activeTiles;
    const startTile = pathableTiles[0];
    const endTile = pathableTiles.reduce((farthest, current) => {
        const d = distance(startTile, current);
        const dFarthest = distance(startTile, farthest);
        return d > dFarthest ? current : farthest;
    });
    const campfireCount = Math.floor(rand() * 3) + 1;

    return {
        tileMap: map,
        startTile: startTile,
        endTile: endTile,
        campfires: placeCampfires(map, campfireCount, [startTile, endTile], rand),
        deadEnds: findDeadEnds(map)
    };
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

/**
 * true si ajouter la case `pos` compléterait un carré 2×2 de tuiles.
 *
 * C'est la règle de **corridor fin** : en interdisant les blocs 2×2, la map
 * reste un réseau de couloirs de largeur 1 (avec coudes), sans jamais
 * s'empêcher de grandir (contrairement à l'ancienne condition qui exigeait
 * 4 voisins vides — impossible, car la case est toujours adjacente à `base`).
 */
function wouldCreate2x2(pos: Position, map: TileMap): boolean {
    const { row, col } = pos;
    // Les 4 coins possibles d'un carré 2×2 dont `pos` est un sommet.
    const corners: [number, number][][] = [
        [[row, col], [row, col + 1], [row + 1, col], [row + 1, col + 1]],
        [[row, col - 1], [row, col], [row + 1, col - 1], [row + 1, col]],
        [[row - 1, col], [row - 1, col + 1], [row, col], [row, col + 1]],
        [[row - 1, col - 1], [row - 1, col], [row, col - 1], [row, col]],
    ];
    for (const square of corners) {
        // `pos` n'est pas encore posée : on compte les 3 autres coins.
        let filled = 0;
        for (const [r, c] of square) {
            if (r === row && c === col) continue;
            if (isInBounds({ row: r, col: c }) && map[r][c]) filled++;
        }
        if (filled === 3) return true;
    }
    return false;
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
 * Forme : un **cercle** fixe centré sur la carte (rayon 3). Au centre, **5
 * tuiles en croix** sont des spots de pêche (c'est en pêchant qu'apparaît
 * Mateus). Le reste du disque est praticable (rives / eau).
 *
 * @returns la tileMap, la case de départ (entrée du lac), la case d'arrivée
 *   (centre) et les 5 tuiles de pêche.
 */
export function generateLakeMap(): {
    tileMap: TileMap;
    startTile: Position;
    endTile: Position;
    fishingTiles: Position[];
} {
    const center = { row: Math.floor(MAP_SIZE / 2), col: Math.floor(MAP_SIZE / 2) };
    const radius = 3;
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

    // Entrée du lac : le point du disque le plus au sud (bord inférieur).
    const startTile = { row: center.row + radius, col: center.col };
    const endTile = { ...center };

    return { tileMap: map, startTile, endTile, fishingTiles };
}