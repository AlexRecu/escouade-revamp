// tests/combat/demonCombat.test.ts
import { Demon } from "../../src/classes/UnitTypes/Demon";
import { BattleManager } from "../../src/classes/Combat/BattleManager";
import { Character } from "../../src/classes/UnitTypes/Character";
import { Warrior } from "../../src/classes/Jobs/Warrior";

/** Fabrique un héros Guerrier. */
function makeWarrior(id: string, row: number, col: number): Character {
  return new Character(id, `Guerrier ${id}`, "Hero", { row, col }, 30, 30, [], 10, 10, 10, 10, new Warrior(), null, null);
}

describe("Combat contre un démon (Phase B1)", () => {
  test("Un démon est vaincu quand son endurance est épuisée", () => {
    const demon = new Demon("Mateus, le Corrompu", "Enemy", { row: 2, col: 2 });
    const endurance = demon.stats.endurance; // 4
    expect(demon.isDead()).toBe(false);

    // Chaque applyDamage = 1 point d'endurance.
    for (let i = 0; i < endurance; i++) {
      demon.applyDamage(1, []);
    }
    expect(demon.isDead()).toBe(true);
  });

  test("Un démon ennemi peut être vaincu en combat (victoire)", () => {
    const hero = makeWarrior("h1", 6, 0);
    const demon = new Demon("Mateus, le Corrompu", "Enemy", { row: 2, col: 2 });
    const battle = new BattleManager([hero, demon]);
    const initialEndurance = demon.stats.endurance;

    // Force la victoire : épuise l'endurance du démon.
    for (let i = 0; i < initialEndurance; i++) demon.applyDamage(1, []);
    battle.combatState.checkEnd();

    expect(battle.result).toBe("victory");
    expect(battle.combatState.enemies).toHaveLength(1);
    expect(battle.combatState.enemies[0].isDead()).toBe(true);
  });

  test("Le démon agit via sa séquence d'actions (act)", () => {
    const demon = new Demon("Mateus, le Corrompu", "Enemy", { row: 2, col: 2 });
    const log = demon.act([]);
    expect(log.length).toBeGreaterThan(0);
    expect(demon.currentTurn).toBe(1);
  });
});
