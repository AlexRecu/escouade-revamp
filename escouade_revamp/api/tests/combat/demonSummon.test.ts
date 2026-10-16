// tests/combat/demonSummon.test.ts
import { BattleManager } from "../../src/classes/Combat/BattleManager";
import { Demon } from "../../src/classes/UnitTypes/Demon";
import { Character } from "../../src/classes/UnitTypes/Character";
import { Monster } from "../../src/classes/UnitTypes/Monster";
import { BlackMage } from "../../src/classes/Jobs/BlackMage";

/**
 * Tests de l'invocation de démon (Démoniste, mode auto).
 *
 * Mécanique (livret) : le Démoniste choisit **quand** invoquer et **quel**
 * démon (parmi les pactisés). Une fois invoqué, le démon joue **tout seul**
 * jusqu'à épuiser ses tours (de lui-même, ou parce qu'il a été touché). Il est
 * alors renvoyé et le Démoniste **reprend sa place**.
 *
 * Implémentation : le Démoniste est **masqué** (`isReplaced`) — il reste vivant
 * (compte pour la défaite) mais ne peut ni agir ni être ciblé. Le démon est
 * ajouté au plateau à sa position.
 */

/** Fabrique un Démoniste niveau 20 avec un pacte sur Mateus. */
function makeDemonist(id: string): Character {
  const c = new Character(id, "Démoniste", "Hero", { row: 6, col: 0 }, 30, 30, [], 12, 12, 10, 10, new BlackMage(), null, null);
  c.job.jobLevel = 20;
  c.characterLevel = 20;
  c.evolveJob("Démoniste");
  (c.job as BlackMage).recruitDemon("Mateus, le Corrompu");
  return c;
}

/** Fabrique un ennemi (Frelon). */
function makeEnemy(): Monster {
  return new Monster("Frelon", { row: 0, col: 0 }, "Enemy", 1);
}

describe("Invocation de démon (Démoniste, mode auto)", () => {
  test("summonDemon : le démoniste est masqué, le démon est ajouté à sa place", () => {
    const demonist = makeDemonist("d1");
    const enemy = makeEnemy();
    const battle = new BattleManager([demonist, enemy]);

    const logs = battle.summonDemon(demonist, "Mateus, le Corrompu");

    expect(logs.some((l) => l.includes("invoque"))).toBe(true);
    // Le démoniste est masqué (hors champ) mais toujours présent et vivant.
    expect(demonist.isReplaced).toBe(true);
    expect(battle.combatState.units).toContain(demonist);
    // Le démon est sur le plateau, à la position du démoniste.
    const demon = battle.combatState.units.find((u) => u instanceof Demon) as Demon;
    expect(demon).toBeDefined();
    expect(demon.position).toEqual(demonist.position);
    expect(demon.summoner).toBe(demonist);
    // Le coût en Mana a été déduit (4).
    expect(demonist.currentMp).toBe(8);
  });

  test("summonDemon : refuse si le démoniste est déjà masqué", () => {
    const demonist = makeDemonist("d2");
    const enemy = makeEnemy();
    const battle = new BattleManager([demonist, enemy]);
    battle.summonDemon(demonist, "Mateus, le Corrompu");
    const logs = battle.summonDemon(demonist, "Mateus, le Corrompu");
    expect(logs.some((l) => l.includes("déjà un démon"))).toBe(true);
  });

  test("summonDemon : refuse si le démon n'est pas pactisé", () => {
    const demonist = makeDemonist("d3");
    const enemy = makeEnemy();
    const battle = new BattleManager([demonist, enemy]);
    const logs = battle.summonDemon(demonist, "Bélias, le Titan");
    expect(logs.some((l) => l.includes("n'est pas pactisé"))).toBe(true);
    expect(battle.combatState.units.find((u) => u instanceof Demon)).toBeUndefined();
  });

  test("Le démoniste masqué n'est pas dans l'ordre d'action", () => {
    const demonist = makeDemonist("d4");
    const enemy = makeEnemy();
    const battle = new BattleManager([demonist, enemy]);
    battle.summonDemon(demonist, "Mateus, le Corrompu");
    battle.combatState.buildActionOrder();
    expect(battle.combatState.actionOrder).not.toContain(demonist);
    // Le démon, lui, est dans l'ordre d'action.
    const demon = battle.combatState.units.find((u) => u instanceof Demon) as Demon;
    expect(battle.combatState.actionOrder).toContain(demon);
  });

  test("Le démoniste masqué n'est pas ciblé par getClosestUnit", () => {
    const demonist = makeDemonist("d5");
    const enemy = makeEnemy();
    const battle = new BattleManager([demonist, enemy]);
    battle.summonDemon(demonist, "Mateus, le Corrompu");
    // L'ennemi cherche le héros le plus proche : il ne doit pas cibler le
    // démoniste masqué (mais le démon, qui est à sa place).
    const target = enemy.getClosestUnit("Hero", battle.combatState.units);
    expect(target).not.toBe(demonist);
    expect(target).toBeInstanceOf(Demon);
  });

  test("Le démoniste masqué compte toujours pour la vie (pas de fausse défaite)", () => {
    const demonist = makeDemonist("d6");
    const enemy = makeEnemy();
    const battle = new BattleManager([demonist, enemy]);
    battle.summonDemon(demonist, "Mateus, le Corrompu");
    // Le démoniste est le seul héros "réel" : masqué, il doit quand même
    // compter pour la vie (sinon, s'il est seul, checkEnd déclencherait une
    // fausse défaite). NB : le démon est aussi de type "Hero", il compte aussi.
    expect(battle.combatState.aliveHeroes).toContain(demonist);
  });

  test("Le démon épuisé de lui-même est renvoyé, le démoniste reprend sa place", () => {
    const demonist = makeDemonist("d7");
    const enemy = makeEnemy();
    const battle = new BattleManager([demonist, enemy]);
    battle.summonDemon(demonist, "Mateus, le Corrompu");

    const demon = battle.combatState.units.find((u) => u instanceof Demon) as Demon;
    // Mateus a 4 tours d'endurance : on épuise ses tours de lui-même.
    demon.currentTurn = demon.stats.endurance;
    expect(demon.isDead()).toBe(true);

    // On déclenche le nettoyage (fin de round).
    (battle as any).cleanupFinishedInvocations();

    // Le démon est retiré du plateau.
    expect(battle.combatState.units.find((u) => u instanceof Demon)).toBeUndefined();
    // Le démoniste est démasqué (reprend sa place).
    expect(demonist.isReplaced).toBe(false);
    expect(battle.combatState.units).toContain(demonist);
  });

  test("Le démon touché (endurance à 0) est renvoyé, le démoniste reprend sa place", () => {
    const demonist = makeDemonist("d8");
    const enemy = makeEnemy();
    const battle = new BattleManager([demonist, enemy]);
    battle.summonDemon(demonist, "Mateus, le Corrompu");

    const demon = battle.combatState.units.find((u) => u instanceof Demon) as Demon;
    // On épuise son endurance (touché) sans qu'il ait joué tous ses tours.
    demon.stats.endurance = 0;
    expect(demon.isDead()).toBe(true);

    (battle as any).cleanupFinishedInvocations();

    expect(battle.combatState.units.find((u) => u instanceof Demon)).toBeUndefined();
    expect(demonist.isReplaced).toBe(false);
  });

  test("Mode auto : un Démoniste invoque son démon au début du combat", () => {
    const demonist = makeDemonist("d9");
    const enemy = makeEnemy();
    const battle = new BattleManager([demonist, enemy]);

    // On simule le tour du démoniste en mode auto (executeActorAction).
    (battle as any).executeActorAction(demonist);

    // Le démoniste a invoqué son démon (masqué) et le démon est sur le plateau.
    expect(demonist.isReplaced).toBe(true);
    expect(battle.combatState.units.find((u) => u instanceof Demon)).toBeDefined();
  });
});