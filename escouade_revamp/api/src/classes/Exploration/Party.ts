// src/classes/Exploration/Party.ts
import { Character } from "../UnitTypes/Character";
import { Position } from "../Types";

export class Party {
  members: Character[];
  position: Position; // Position actuelle du groupe dans la zone
  visitedTiles: Set<string>; // Historique des positions explorées
  defeatedEnemies: number = 0;

  constructor(members: Character[], startPosition: Position) {
    this.members = members;
    this.position = startPosition;
    this.visitedTiles = new Set();
    this.markTileVisited(startPosition);
  }

  moveTo(position: Position) {
    this.position = position;
    this.markTileVisited(position);
  }

  markTileVisited(pos: Position) {
    const key = `${pos.row},${pos.col}`;
    this.visitedTiles.add(key);
  }

  hasVisited(pos: Position): boolean {
    const key = `${pos.row},${pos.col}`;
    return this.visitedTiles.has(key);
  }

  isDefeated(): boolean {
    return this.members.every(member => member.isDead());
  }

  getAliveMembers(): Character[] {
    return this.members.filter(member => !member.isDead());
  }
}
