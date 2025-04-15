import { Position } from "../Types";
import { Unit } from "../UnitTypes/Unit";

export type CombatPhase = "placement" | "hero-turn" | "enemy-turn" | "end";

export class CombatState {
  gridSize: number = 8;
  units: Unit[] = []; // tous les participants au combat
  heroes: Unit[] = [];
  enemies: Unit[] = [];
  phase: CombatPhase = "placement";
  turnCount: number = 1;
  currentActingUnitIndex: number = 0;
  actionLog: string[] = [];
  isVictory: boolean = false;
  isDefeat: boolean = false;

  constructor(heroes: Unit[], enemies: Unit[]) {
    this.heroes = heroes;
    this.enemies = enemies;
    this.units = [...heroes, ...enemies];
  }

  /**
   * Met à jour l'ordre des unités (peut être amélioré pour inclure l'initiative)
   */
  getActionOrder(): Unit[] {
    return this.phase === "hero-turn" ? this.heroes.filter(h => !h.isDead()) : this.enemies.filter(e => !e.isDead());
  }

  /**
   * Passe à l'unité suivante dans l'ordre d'action
   */
  nextUnit(): Unit | null {
    const order = this.getActionOrder();
    this.currentActingUnitIndex++;
    if (this.currentActingUnitIndex >= order.length) return null;
    return order[this.currentActingUnitIndex];
  }

  /**
   * Réinitialise l'ordre pour le prochain tour
   */
  startTurn(phase: CombatPhase) {
    this.phase = phase;
    this.currentActingUnitIndex = 0;
  }

  /**
   * Ajoute un message dans le journal d’action
   */
  logAction(message: string) {
    this.actionLog.push(`[Tour ${this.turnCount}] ${message}`);
  }

  /**
   * Vérifie les conditions de victoire ou de défaite
   */
  checkVictoryOrDefeat(): "victory" | "defeat" | null {
    if (this.enemies.every(e => e.isDead())) {
      this.isVictory = true;
      this.phase = "end";
      return "victory";
    }
    if (this.heroes.every(h => h.isDead())) {
      this.isDefeat = true;
      this.phase = "end";
      return "defeat";
    }
    return null;
  }

  /**
   * Retourne toutes les unités vivantes
   */
  getAliveUnits(): Unit[] {
    return this.units.filter(u => !u.isDead());
  }

  /**
   * Renvoie l'unité présente à une position donnée
   */
  getUnitAt(pos: Position): Unit | undefined {
    return this.units.find(u => u.position.row === pos.row && u.position.col === pos.col && !u.isDead());
  }

  /**
   * Supprime les unités mortes de la grille si nécessaire
   */
  removeDeadUnits() {
    this.units = this.units.filter(u => !u.isDead());
  }
}
