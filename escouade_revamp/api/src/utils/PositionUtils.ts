import { Position } from "../classes/Types";
import { Unit } from "../classes/UnitTypes/Unit";


/**
 * Determines if a position is adjacent (including diagonally) to a target position.
 * 
 * @param {Position} position - The position to check for adjacency.
 * @param {Position} goal - The target position to compare against.
 * @returns {boolean} True if the position is adjacent to the goal, false otherwise.
 */
export function isAdjacentToGoal(position: Position, goal: Position): boolean {
    return Math.abs(position.row - goal.row) <= 1 && Math.abs(position.col - goal.col) <= 1;
}

/**
 * La liste des position adjacentes
 * 
 * @param {Position} target la position à tester
 * @returns {Position[]}
 */
export function getAdjacentPositions(target: Position): Position[] {
    return [
        { row: target.row - 1, col: target.col },
        { row: target.row + 1, col: target.col },
        { row: target.row, col: target.col - 1 },
        { row: target.row, col: target.col + 1 },
        { row: target.row - 1, col: target.col - 1 },
        { row: target.row - 1, col: target.col + 1 },
        { row: target.row + 1, col: target.col - 1 },
        { row: target.row + 1, col: target.col + 1 }
    ];
}

/**
 * La liste des position adjacentes disponibles
 * 
 * @param {Position} currentPosition la position à tester
 * @param  {Unit[]} units Liste de toutes les unités
 * @returns {Position[]}
 */
export function findAvailablePositions(currentPosition: Position, units: Unit[]): Position[] {
    const GRID_MIN = 0, GRID_MAX = 7;

    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

    let adjacentPositions = getAdjacentPositions(currentPosition)
        .map(pos => ({
            row: clamp(pos.row, GRID_MIN, GRID_MAX),
            col: clamp(pos.col, GRID_MIN, GRID_MAX)
        }))
        .filter(pos => !isOccupied(pos, units));

    return adjacentPositions;
}

/**
 * Trouve la case de recul d'une cible frappée par une masse : la case
 * adjacente (Chebyshev, 8 directions) qui s'éloigne le plus de l'attaquant.
 *
 * @param attackerPos position de l'attaquant (celui qui frappe à la masse)
 * @param targetPos position de la cible (le monstre à repousser)
 * @param units toutes les unités du plateau (pour vérifier l'occupation)
 * @returns la case de recul, ou null si aucune case libre n'est disponible
 */
export function findPushPosition(attackerPos: Position, targetPos: Position, units: Unit[]): Position | null {
    const GRID_MIN = 0, GRID_MAX = 7;
    const inBounds = (p: Position) => p.row >= GRID_MIN && p.row <= GRID_MAX && p.col >= GRID_MIN && p.col <= GRID_MAX;

    // Direction de la poussée : de l'attaquant vers la cible.
    const dr = Math.sign(targetPos.row - attackerPos.row);
    const dc = Math.sign(targetPos.col - attackerPos.col);

    const candidates = getAdjacentPositions(targetPos)
        .filter(inBounds)
        .filter((p) => !isOccupied(p, units));

    if (candidates.length === 0) return null;

    // Point idéal : la case juste derrière la cible, dans la direction opposée
    // à l'attaquant (ex. attaquant à gauche → la case à droite de la cible).
    const ideal = { row: targetPos.row + dr, col: targetPos.col + dc };
    const chebyshev = (a: Position, b: Position) =>
        Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));

    // On choisit la case libre la plus proche du point idéal (distance de
    // Chebyshev) : c'est le recul le plus direct, comme dans l'exemple du
    // livret. Si le point idéal est occupé, on prend la plus proche.
    return candidates.reduce((best, p) =>
        chebyshev(p, ideal) < chebyshev(best, ideal) ? p : best
    );
}

/**
 * Détermine si une position est occupée par une unité
 * 
 * @param {Position} pos Position à tester
 * @param  {Unit[]} units Liste de toutes les unités
 * @returns {boolean} True si la position pos est occupée
 */
export function isOccupied(pos: Position, units: Unit[]): boolean {
    return units.some(unit => unit.position.row === pos.row && unit.position.col === pos.col);
}



/***
 * Détermine le chemin le plus court en évitant les obstacles
 * 
 * @param {Position} start Position de départ
 * @param {Position} goal Position d'arrivée souhaitée
 * @param  {Unit[]} units Liste de toutes les unités
 * @returns {Position[]} La liste des positions pour effectuer le chemin le plus court
 */
export function findPathDijkstra(start: Position, goal: Position, units: Unit[]): Position[] {
    const GRID_SIZE = 8;
    const directions = [
        { row: -1, col: 0 }, { row: 1, col: 0 },  // Haut, Bas
        { row: 0, col: -1 }, { row: 0, col: 1 },  // Gauche, Droite
        { row: -1, col: -1 }, { row: -1, col: 1 }, // Diagonales
        { row: 1, col: -1 }, { row: 1, col: 1 }
    ];

    const inBounds = (pos: Position) =>
        pos.row >= 0 && pos.row < GRID_SIZE && pos.col >= 0 && pos.col < GRID_SIZE;

    const cameFrom = new Map<string, Position | null>();
    const cost = new Map<string, number>();

    const startKey = `${start.row},${start.col}`;
    const goalKey = `${goal.row},${goal.col}`;

    cameFrom.set(startKey, null);
    cost.set(startKey, 0);

    let queue: { pos: Position, priority: number }[] = [{ pos: start, priority: 0 }];

    while (queue.length > 0) {
        queue.sort((a, b) => a.priority - b.priority);
        const { pos } = queue.shift()!; // Extraire le noeud avec la plus faible priorité

        const posKey = `${pos.row},${pos.col}`;
        if (posKey === goalKey) break; // On a atteint la cible

        for (let dir of directions) {
            const newPos = { row: pos.row + dir.row, col: pos.col + dir.col };
            const newKey = `${newPos.row},${newPos.col}`;

            if (!inBounds(newPos) || isOccupied(newPos, units)) continue;

            const newCost = cost.get(posKey)! + 1;
            if (!cost.has(newKey) || newCost < cost.get(newKey)!) {
                cost.set(newKey, newCost);
                cameFrom.set(newKey, pos);
                queue.push({ pos: newPos, priority: newCost });
            }
        }
    }

    if (!cameFrom.has(goalKey)) return []; // Pas de chemin trouvé

    // Reconstruction du chemin
    let path: Position[] = [];
    let currentPos: Position | null = goal;
    while (currentPos) {
        path.push(currentPos);
        const key:string = `${currentPos.row},${currentPos.col}`;
        currentPos = cameFrom.get(key) || null;
    }

    return path.reverse().slice(1); // On enlève la position de départ
}

/**
 * Détermine si une position est occupée par une unité
 * 
 * @param {Position} pos Position à tester
 * @param  {Unit[]} units Liste de toutes les unités
 * @returns {Unit} L'unité qui occupe la position pos si occupée
 */
export function whoOccupies(pos: Position, units: Unit[]): Unit | undefined {
    return units.find(unit => unit.position.row === pos.row && unit.position.col === pos.col);
}

/**
 * Génère une position aléatoire non occupée sur le plateau
 * (les lignes 0 et 1 sont réservées aux alliés, donc exclues)
 * 
 * @param {Unit[]} units Liste des unités actuelles sur le plateau
 * @returns {Position | null} Une position disponible ou null si aucune trouvée
 */
export function getRandomAvailablePosition(units: Unit[]): Position | null {
    const possiblePositions: Position[] = [];

    // On liste toutes les positions disponibles entre les lignes 2 et 7
    for (let row = 2; row <= 7; row++) {
        for (let col = 0; col <= 7; col++) {
            const pos = { row, col };
            if (!isOccupied(pos, units)) {
                possiblePositions.push(pos);
            }
        }
    }

    // S'il n'y a plus de place sur le plateau on renvoie null
    if (possiblePositions.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * possiblePositions.length);
    return possiblePositions[randomIndex];
}