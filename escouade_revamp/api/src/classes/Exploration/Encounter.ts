// src/classes/World/Encounter.ts

import { Monster } from "../UnitTypes/Monster";
import { Position } from "../Types";
import { generateMonsterGroup } from "../../services/dungeon/EncounterGenerator";
import { Zone } from "../World/Zone";

export class Encounter {
  zone: Zone;
  enemies: Monster[];
  turnOrder: ('players' | 'enemies')[];
  initiatedAt: Date;

  constructor(zone: Zone) {
    this.zone = zone;
    this.enemies = generateMonsterGroup(zone); // Génération dynamique
    this.turnOrder = this.generateTurnOrder();
    this.initiatedAt = new Date();
  }

  /**
   * Détermine qui commence le combat (aléatoire ou selon initiative future)
   */
  private generateTurnOrder(): ('players' | 'enemies')[] {
    return Math.random() < 0.5 ? ['players', 'enemies'] : ['enemies', 'players'];
  }

  /**
   * Renvoie la liste des ennemis positionnés pour le combat
   */
  getEnemyPlacements(): { monster: Monster; position: Position }[] {
    // Peut être délégué à un helper ou service
    return this.enemies.map((monster, index) => ({
      monster,
      position: {
        row: Math.floor(Math.random() * 6) + 2, // rows 2-7
        col: index % 8,
      },
    }));
  }

  /**
   * Retourne un résumé utile pour le client (frontend)
   */
  getSummary() {
    return {
      zone: this.zone.name,
      enemies: this.enemies.map(m => m.name),
      turnOrder: this.turnOrder,
      time: this.initiatedAt.toISOString(),
    };
  }
}
