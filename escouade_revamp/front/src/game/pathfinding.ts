import type { Position, HubLayout } from '../types/world';

/**
 * Pathfinding de la ville (front).
 *
 * La ville est une grille de tuiles (14×14). `true` = marchable, `false` =
 * bloquée. Les bâtiments sont des obstacles (on ne marche pas dessus) : pour
 * interagir, on marche jusqu'à la case marchable la plus proche du bâtiment.
 *
 * Déplacement en 4 directions (haut/bas/gauche/droite) : plus lisible qu'en
 * 8 directions (pas de traversée de coins) pour un point-and-clic.
 */

const DIRS: Position[] = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
];

const key = (p: Position) => `${p.row},${p.col}`;

/** Les cases de bâtiment (obstacles). */
export function buildingSet(layout: HubLayout): Set<string> {
  const s = new Set<string>();
  for (const b of layout.buildings) s.add(`${b.row},${b.col}`);
  return s;
}

/** Une case est-elle marchable ? (dans les bornes, tuile praticable, pas un bâtiment). */
export function isWalkable(layout: HubLayout, pos: Position, buildings: Set<string>): boolean {
  const { rows, cols } = layout.size;
  if (pos.row < 0 || pos.row >= rows || pos.col < 0 || pos.col >= cols) return false;
  if (!layout.tileMap[pos.row]?.[pos.col]) return false;
  if (buildings.has(key(pos))) return false;
  return true;
}

/**
 * Chemin le plus court (BFS) de `start` à `goal` (4 directions).
 * @returns la liste des cases à traverser (sans `start`, avec `goal`), ou [] si inaccessible.
 */
export function findPath(layout: HubLayout, start: Position, goal: Position, buildings: Set<string>): Position[] {
  if (!isWalkable(layout, goal, buildings)) return [];
  if (key(start) === key(goal)) return [];

  const cameFrom = new Map<string, Position | null>();
  cameFrom.set(key(start), null);
  const queue: Position[] = [start];

  while (queue.length > 0) {
    const pos = queue.shift()!;
    if (key(pos) === key(goal)) break;
    for (const d of DIRS) {
      const next = { row: pos.row + d.row, col: pos.col + d.col };
      const k = key(next);
      if (cameFrom.has(k) || !isWalkable(layout, next, buildings)) continue;
      cameFrom.set(k, pos);
      queue.push(next);
    }
  }

  if (!cameFrom.has(key(goal))) return [];

  const path: Position[] = [];
  let cur: Position | null = goal;
  while (cur) {
    path.push(cur);
    cur = cameFrom.get(key(cur)) ?? null;
  }
  return path.reverse().slice(1);
}

/**
 * Case marchable la plus proche d'un bâtiment (pour s'arrêter devant).
 * BFS depuis la case du bâtiment vers l'extérieur.
 */
export function nearestWalkableToBuilding(layout: HubLayout, building: Position, buildings: Set<string>): Position | null {
  const { rows, cols } = layout.size;
  const visited = new Set<string>([key(building)]);
  const queue: Position[] = [building];
  while (queue.length > 0) {
    const pos = queue.shift()!;
    for (const d of DIRS) {
      const next = { row: pos.row + d.row, col: pos.col + d.col };
      const k = key(next);
      if (next.row < 0 || next.row >= rows || next.col < 0 || next.col >= cols) continue;
      if (visited.has(k)) continue;
      visited.add(k);
      if (isWalkable(layout, next, buildings)) return next;
      queue.push(next);
    }
  }
  return null;
}
