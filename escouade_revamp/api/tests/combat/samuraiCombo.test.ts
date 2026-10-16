// tests/combat/samuraiCombo.test.ts
import { BattleManager } from "../../src/classes/Combat/BattleManager";
import { Character } from "../../src/classes/UnitTypes/Character";
import { Monster } from "../../src/classes/UnitTypes/Monster";
import { RedMage } from "../../src/classes/Jobs/RedMage";

/**
 * Tests de la mécanique des combos (passif Bushido du Samouraï).
 *
 * Mécanique (livret) : le Samouraï débloque le passif **Bushido** lui
 * permettant d'**enchaîner plusieurs compétences d'AP** (Hissatsu), débloquées
 * au fur et à mesure du niveau. Il gagne aussi **+2 AP** max.
 *
 * Implémentation : `Character.useCombo(combo, allUnits)` enchaîne les
 * compétences nommées tant qu'il a de l'AP. Le bonus d'AP est appliqué dans
 * `evolveJob` (via `Evolution.apBonus`). En mode auto, `AIService.
 * executeSamuraiAction` enchaîne les Hissatsu débloqués.
 */

/** Fabrique un Samouraï (Mage Rouge évolué) au niveau donné. */
function makeSamurai(id: string, level = 20): Character {
  const c = new Character(id, "Samouraï", "Hero", { row: 6, col: 0 }, 30, 30, [], 12, 12, 10, 10, new RedMage(), null, null);
  c.job.jobLevel = level;
  c.characterLevel = level;
  c.evolveJob("Samouraï");
  return c;
}

/** Fabrique un ennemi (Frelon) adjacent au Samouraï. */
function makeEnemy(): Monster {
  return new Monster("Frelon", { row: 5, col: 0 }, "Enemy", 1);
}

describe("Mécanique des combos (Bushido du Samouraï)", () => {
  test("L'évolution Samouraï accorde +2 AP (maxAp et currentAp)", () => {
    const samurai = makeSamurai("s1");
    // Base 10 AP + bonus 2 de l'évolution.
    expect(samurai.maxAp).toBe(12);
    expect(samurai.currentAp).toBe(12);
  });

  test("Au niveau 20, seul Gyôten est débloqué ; au niveau 30, les 6 Hissatsu", () => {
    const s20 = makeSamurai("s2", 20);
    const names20 = s20.getAvailableAbilities().map((s) => s.name);
    expect(names20).toEqual(["Gyôten"]);

    const s30 = makeSamurai("s3", 30);
    const names30 = s30.getAvailableAbilities().map((s) => s.name);
    expect(names30).toEqual(["Gyôten", "Yaten", "Shinten", "Kyûten", "Guren", "Zeninage"]);
  });

  test("useCombo enchaîne plusieurs Hissatsu et consomme l'AP", () => {
    const samurai = makeSamurai("s4", 30);
    const enemy = makeEnemy();
    const battle = new BattleManager([samurai, enemy]);

    const apBefore = samurai.currentAp;
    const hpBefore = enemy.currentHp;
    const logs = samurai.useCombo(["Gyôten", "Shinten"], battle.combatState.units);

    // Les deux Hissatsu coûtent 1 AP chacun.
    expect(samurai.currentAp).toBe(apBefore - 2);
    // L'ennemi a pris des dégâts.
    expect(enemy.currentHp).toBeLessThan(hpBefore);
    // Le log mentionne les deux compétences.
    expect(logs.some((l) => l.includes("Gyôten"))).toBe(true);
    expect(logs.some((l) => l.includes("Shinten"))).toBe(true);
  });

  test("useCombo s'arrête quand il n'y a plus assez d'AP", () => {
    const samurai = makeSamurai("s5", 30);
    const enemy = makeEnemy();
    const battle = new BattleManager([samurai, enemy]);

    // On ne laisse que 1 AP : Gyôten passe, Shinten est refusé.
    samurai.currentAp = 1;
    const logs = samurai.useCombo(["Gyôten", "Shinten"], battle.combatState.units);

    expect(samurai.currentAp).toBe(0);
    expect(logs.some((l) => l.includes("Pas assez d'AP"))).toBe(true);
  });

  test("useCombo signale une compétence introuvable", () => {
    const samurai = makeSamurai("s6", 30);
    const enemy = makeEnemy();
    const battle = new BattleManager([samurai, enemy]);
    const logs = samurai.useCombo(["Inexistant"], battle.combatState.units);
    expect(logs.some((l) => l.includes("introuvable"))).toBe(true);
  });

  test("Zeninage sacrifie l'or : dégâts = or × 0,01% des PV de l'adversaire", () => {
    const samurai = makeSamurai("s7", 30);
    const enemy = makeEnemy();
    const battle = new BattleManager([samurai, enemy]);

    samurai.gold = 100000; // damage = 100000 * 0.0001 * maxHp = 10 * maxHp → KO
    const hpBefore = enemy.currentHp;
    samurai.useCombo(["Zeninage"], battle.combatState.units);

    // L'or est sacrifié.
    expect(samurai.gold).toBe(0);
    // L'ennemi a pris de gros dégâts (KO avec 10× ses PV max).
    expect(enemy.currentHp).toBeLessThan(hpBefore);
  });

  test("performAction('combo') exécute l'enchaînement (point d'entrée joueur)", () => {
    const samurai = makeSamurai("s8", 30);
    const enemy = makeEnemy();
    const battle = new BattleManager([samurai, enemy]);

    const apBefore = samurai.currentAp;
    const logs = battle.performAction(samurai, "combo", [], { combo: ["Gyôten", "Shinten"] });

    expect(samurai.currentAp).toBe(apBefore - 2);
    expect(logs.some((l) => l.includes("Gyôten"))).toBe(true);
  });

  test("Mode auto : un Samouraï enchaîne ses Hissatsu au lieu d'attaquer", () => {
    const samurai = makeSamurai("s9", 30);
    const enemy = makeEnemy();
    const battle = new BattleManager([samurai, enemy]);

    const hpBefore = enemy.currentHp;
    // On simule le tour du Samouraï en mode auto.
    (battle as any).executeActorAction(samurai);

    // L'ennemi a pris des dégâts (Hissatsu enchaînés).
    expect(enemy.currentHp).toBeLessThan(hpBefore);
  });

  test("Une unité non-Samouraï (Monster) ne peut pas enchaîner de combos", () => {
    const enemy = makeEnemy();
    const logs = enemy.useCombo(["Gyôten"], [enemy]);
    expect(logs.some((l) => l.includes("ne peut pas enchaîner"))).toBe(true);
  });
});
