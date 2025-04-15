// src/classes/Exploration/ExplorationState.ts
import { Zone } from "../World/Zone";
import { Party } from "./Party";
import { Encounter } from "./Encounter";
import { Position } from "../Types";

export class ExplorationState {
  party: Party;
  zone: Zone;
  currentEncounter: Encounter | null = null;
  stepsTaken: number = 0;

  constructor(party: Party, zone: Zone) {
    this.party = party;
    this.zone = zone;
  }

  /**
   * Met à jour la position du groupe
   */
  movePartyTo(newPos: Position): string[] {
    this.party.moveTo(newPos);
    this.stepsTaken++;

    if (this.zone.shouldTriggerEncounter()) {
      this.currentEncounter = new Encounter(this.zone);
      return [`Rencontre déclenchée !`, ...this.currentEncounter.getSummary().enemies];
    }

    return [`Le groupe se déplace en ${newPos.row},${newPos.col}`];
  }

  /**
   * Fait avancer l’exploration si pas de combat en cours
   */
  canMove(): boolean {
    return this.currentEncounter === null;
  }

  /**
   * Fin d’un combat : on réinitialise l’état
   */
  endEncounter() {
    if (this.currentEncounter) {
      this.party.defeatedEnemies += this.currentEncounter.enemies.length;
      this.currentEncounter = null;
    }
  }

  isExplorationComplete(): boolean {
    return (
      this.zone.endTile &&
      this.party.position.row === this.zone.endTile.row &&
      this.party.position.col === this.zone.endTile.col
    );
  }
}
