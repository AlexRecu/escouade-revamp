import { CombatState } from "../../classes/Battle/CombatState";
import { Unit } from "../../classes/UnitTypes/Unit";


export class AIService {
  /**
   * Décide de l’action à réaliser par une unité ennemie et l’exécute
   * @returns le journal des actions (logs)
   */
  static async decideAndAct(enemy: Unit, state: CombatState): Promise<string[]> {
    const logs: string[] = [];

    // Si l'ennemi ne peut pas agir (paralysé, sommeil, etc.)
    if (!enemy.canAct || enemy.isDead()) {
      logs.push(`${enemy.name} est incapable d'agir.`);
      return logs;
    }

    const heroes = state.heroes.filter(h => !h.isDead());
    if (heroes.length === 0) return logs;

    // Choisir une cible proche (par défaut)
    const target = enemy.getClosestUnit("Hero", heroes);
    if (!target) return logs;

    const isAdjacent = Math.abs(enemy.position.row - target.position.row) <= 1 &&
                       Math.abs(enemy.position.col - target.position.col) <= 1;

    // 🟠 S'il est au contact → attaque
    if (isAdjacent) {
      const roll = Math.ceil(Math.random() * 6);
      const critRoll = roll === 6 ? Math.ceil(Math.random() * 6) : 0;
      logs.push(...enemy.attack(target, roll, critRoll, 0));
    } 
    // 🟡 Sinon → se rapproche de la cible
    else {
      enemy.moveTowards(target.position, 3, [...state.heroes, ...state.enemies]);
      logs.push(`${enemy.name} se rapproche de ${target.name}`);
    }

    // Marquer l'unité comme ayant agi
    enemy.canAct = false;
    return logs;
  }
}
