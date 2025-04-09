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
};

export function generateTileMapWithFeatures(seed: number = Date.now()): DungeonFloor {
    const rand = seededRandom(seed);
    const map: TileMap = Array.from({ length: MAP_SIZE }, () => Array(MAP_SIZE).fill(false));

    const start: Position = {
        row: Math.floor(MAP_SIZE / 2),
        col: Math.floor(MAP_SIZE / 2),
    };

    map[start.row][start.col] = true;

    const activeTiles: Position[] = [start];

    let tilesCreated = 1;
    const maxTiles = 8;

    while (tilesCreated < maxTiles) {
        const base = activeTiles[Math.floor(rand() * activeTiles.length)];
        const shuffledDirs = Object.values(directions).sort(() => rand() - 0.5);

        let added = 0;
        for (let dir of shuffledDirs) {
            if (added >= 3) break;

            const newPos: Position = { row: base.row + dir.row, col: base.col + dir.col };

            if (
                isInBounds(newPos) &&
                !map[newPos.row][newPos.col] &&
                areNeighborsEmpty(newPos, map)
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
        campfires: placeCampfires(map, campfireCount, [startTile, endTile], rand)
    };
}

function isInBounds(pos: Position): boolean {
    return pos.row >= 0 && pos.row < MAP_SIZE && pos.col >= 0 && pos.col < MAP_SIZE;
}

function areNeighborsEmpty(pos: Position, map: TileMap): boolean {
    return Object.values(directions).every((dir) => {
        const r = pos.row + dir.row;
        const c = pos.col + dir.col;
        return !isInBounds({ row: r, col: c }) || !map[r][c];
    });
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
