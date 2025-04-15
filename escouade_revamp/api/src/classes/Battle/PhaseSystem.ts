import { AIService } from "../../services/battle/AIService";
import { manageStatusAfterPhase, manageStatusBeforePhase } from "../../utils/StatusUtils";
import { Unit } from "../UnitTypes/Unit";
import { CombatState } from "./CombatState";


export class PhaseSystem {
  state: CombatState;

  constructor(state: CombatState) {
    this.state = state;
  }

  /**
   * Lance le cycle de tour complet
   */
  async runTurnCycle() {
    // Phase des héros
    this.state.startTurn("hero-turn");
    this.handleStartPhaseStatuses(this.state.heroes);

    await this.waitForHeroActions(); // Le front-end gère les actions des joueurs

    this.handleEndPhaseStatuses(this.state.heroes);
    this.state.checkVictoryOrDefeat();
    if (this.state.phase === "end") return;

    // Phase des ennemis
    this.state.startTurn("enemy-turn");
    this.handleStartPhaseStatuses(this.state.enemies);

    await this.executeEnemyAI();

    this.handleEndPhaseStatuses(this.state.enemies);
    this.state.turnCount++;
    this.state.checkVictoryOrDefeat();
  }

  /**
   * Gère les statuts de début de phase
   */
  private handleStartPhaseStatuses(units: Unit[]) {
    for (const unit of units.filter(u => !u.isDead())) {
      const logs = manageStatusBeforePhase(unit);
      logs.forEach(log => this.state.logAction(log));
    }
  }

  /**
   * Gère les statuts de fin de phase
   */
  private handleEndPhaseStatuses(units: Unit[]) {
    for (const unit of units.filter(u => !u.isDead())) {
      const logs = manageStatusAfterPhase(unit);
      logs.forEach(log => this.state.logAction(log));
    }
    this.state.removeDeadUnits();
  }

  /**
   * Attend que tous les joueurs aient terminé leur tour (peut être déclenché via events côté client)
   */
  private async waitForHeroActions(): Promise<void> {
    // Cette méthode est appelée côté backend, mais doit attendre une confirmation client (ex: bouton "Fin de tour")
    return new Promise((resolve) => {
      // À intégrer avec un WebSocket ou une API : resolve() est appelé par le client une fois tous les héros ont fini
      const interval = setInterval(() => {
        const allActed = this.state.heroes.every(h => h.canAct === false || h.isDead());
        if (allActed) {
          clearInterval(interval);
          resolve();
        }
      }, 500);
    });
  }

  /**
   * Fait agir chaque ennemi via le service d’IA
   */
  private async executeEnemyAI(): Promise<void> {
    for (const enemy of this.state.enemies.filter(e => !e.isDead())) {
      const log: string[] = await AIService.decideAndAct(enemy, this.state);
      log.forEach(line => this.state.logAction(line));
    }
  }
}
