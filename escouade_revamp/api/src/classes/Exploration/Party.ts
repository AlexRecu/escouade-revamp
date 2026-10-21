// src/classes/Exploration/Party.ts
import { Character } from "../UnitTypes/Character";
import { Position } from "../Types";
import { IdGenerator } from "../../utils/IdGeneratorUtils";

export class Party {
  id: string;
  members: Character[];
  position: Position; // Position actuelle du groupe dans la zone
  visitedTiles: Set<string>; // Historique des positions explorées
  defeatedEnemies: number = 0;
  /** Niveau de progression du monde (0 → 6). Monte à chaque zone complétée. */
  worldLevel: number = 0;
  /** Noms des donjons déjà complétés (scaling dynamique des zones). */
  completedZones: Set<string> = new Set();
  /**
   * **Pot commun d'or** de l'équipe (source de vérité pour les transactions
   * de ville : marchand, auberge, sanctuaire…). L'or par membre (`Character.gold`)
   * n'est plus utilisé en ville ; il est migré vers ce pot à la création/chargement.
   */
  gold: number = 0;
  /**
   * **Bestiaire** : noms des monstres déjà rencontrés (sur l'ensemble des
   * explorations). Persisté pour que la mappemonde affiche les monstres connus
   * (et « ? » pour les inconnus) même après rechargement.
   */
  seenMonsters: Set<string> = new Set();
  /**
   * **Villes visitées** (ids de hubs). Source de vérité du brouillard de guerre
   * des villes : on ne peut voyager en caravane que vers des villes qu'on a
   * déjà vues. Une ville est marquée visitée quand on y arrive (caravane ou
   * transition) ou quand la partie y démarre.
   */
  visitedHubs: Set<string> = new Set();

  constructor(id: string, members: Character[], startPosition: Position) {
    this.id = id ?? IdGenerator.generate("Party");
    this.members = members;
    this.position = startPosition;
    this.visitedTiles = new Set();
    this.markTileVisited(startPosition);
  }

  /** Ajoute un monstre au bestiaire (idempotent). */
  markMonsterSeen(monsterName: string): void {
    this.seenMonsters.add(monsterName);
  }

  /** Marque une ville comme visitée (idempotent) — révèle la ville au brouillard. */
  markHubVisited(hubId: string): void {
    if (hubId) this.visitedHubs.add(hubId);
  }

  /**
   * Totalise l'or des membres dans le pot commun et le vide.
   * Appelé à la création/chargement d'une partie pour migrer l'or par membre
   * (les parties antérieures stockaient l'or sur chaque `Character`).
   */
  consolidateGold(): void {
    for (const m of this.members) {
      this.gold += m.gold;
      m.gold = 0;
    }
    // L'or est toujours un nombre entier : on arrondit le pot commun (corrige
    // aussi les fractions résiduelles d'anciennes versions).
    this.gold = Math.floor(this.gold);
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

  /**
   * Niveau effectif d'une zone selon la progression du monde.
   *  - Zone non complétée → worldLevel + 1
   *  - Zone complétée → worldLevel
   *  - Borné à [1, 6].
   */
  effectiveZoneLevel(zoneName: string): number {
    const base = this.completedZones.has(zoneName) ? this.worldLevel : this.worldLevel + 1;
    return Math.min(6, Math.max(1, base));
  }

  /**
   * Marque une zone comme complétée et fait monter le niveau du monde.
   * Idempotent : ne monte qu'une fois par zone.
   * @returns true si le niveau a monté (zone complétée pour la 1re fois).
   */
  completeZone(zoneName: string): boolean {
    if (this.completedZones.has(zoneName)) return false;
    this.completedZones.add(zoneName);
    if (this.worldLevel < 6) this.worldLevel++;
    return true;
  }

  /**
   * Sérialise l'équipe en objet JSON (round-trip).
   *
   * Les membres sont sérialisés via `CharacterFactory.toSerialized` (import
   * paresseux pour éviter une dépendance circulaire factory ↔ classe).
   */
  toSerialized(): any {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { CharacterFactory } = require("../../services/factory/CharacterFactory");
    return {
      id: this.id,
      position: this.position,
      visitedTiles: Array.from(this.visitedTiles),
      defeatedEnemies: this.defeatedEnemies,
      worldLevel: this.worldLevel,
      completedZones: Array.from(this.completedZones),
      gold: this.gold,
      seenMonsters: Array.from(this.seenMonsters),
      visitedHubs: Array.from(this.visitedHubs),
      members: this.members.map((m) => CharacterFactory.toSerialized(m)),
    };
  }

  isDefeated(): boolean {
    return this.members.every(member => member.isDead());
  }

  getAliveMembers(): Character[] {
    return this.members.filter(member => !member.isDead());
  }
}