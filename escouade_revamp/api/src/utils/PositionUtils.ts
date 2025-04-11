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
        const key: string = `${currentPos.row},${currentPos.col}`;
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
 * Génère une position aléatoire pour un monstre qui n'est pas occupée sur le plateau
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

/**
 * Permet de générer la liste des positions valides pour les monstres en début de combat
 */
export function getAvailableMonsterPositions(): Position[] {
    const possiblePositions: Position[] = [];

    // On liste toutes les positions disponibles entre les lignes 2 et 7
    for (let row = 2; row <= 7; row++) {
        for (let col = 0; col <= 7; col++) {
            possiblePositions.push({ row, col });
        }
    }

    return possiblePositions;
}