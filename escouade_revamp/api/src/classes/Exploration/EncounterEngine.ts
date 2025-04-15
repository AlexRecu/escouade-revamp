// src/classes/Exploration/EncounterEngine.ts
import { ExplorationState } from "./ExplorationState";
import { CombatState } from "../Battle/CombatState";
import { CombatService } from "../../services/battle/CombatService";

export class EncounterEngine {
  exploration: ExplorationState;
  combat: CombatState | null = null;

  constructor(exploration: ExplorationState) {
    this.exploration = exploration;
  }

  /**
   * Initialise un combat à partir d’une rencontre
   */
  startCombat(): CombatState | null {
    if (!this.exploration.currentEncounter) return null;

    const heroes = this.exploration.party.getAliveMembers();
    const enemies = this.exploration.currentEncounter.enemies;

    this.combat = new CombatState(heroes, enemies);
    return this.combat;
  }

  /**
   * Terminer le combat et poursuivre l’exploration
   */
  finishCombat(): string[] {
    const logs: string[] = [];

    if (!this.combat) return logs;

    const result = CombatService.checkBattleEnd(this.combat);
    if (result === "victory") {
      logs.push("Victoire !");
      this.exploration.endEncounter();
    } else if (result === "defeat") {
      logs.push("Game Over...");
      // Peut-être remettre à zéro la partie ?
    }

    this.combat = null;
    return logs;
  }

  /**
   * Vérifie si un combat est encore actif
   */
  isInCombat(): boolean {
    return this.combat !== null;
  }
}
