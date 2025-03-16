import { Position } from "../classes/Types";
import { Unit } from "../classes/Unit";

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
 * Détermine si une position est occupée par une unité
 * 
 * @param {Position} pos Position à tester
 * @param  {Unit[]} units Liste de toutes les unités
 * @returns {boolean} True si la position pos est occupée
 */
export function isOccupied(pos: Position, units: Unit[]): boolean {
    return units.some(unit => unit.position.row === pos.row && unit.position.col === pos.col);
}