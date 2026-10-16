// tests/combat/eonSummon.test.ts
import { BattleManager } from "../../src/classes/Combat/BattleManager";
import { Eon } from "../../src/classes/UnitTypes/Eon";
import { Character } from "../../src/classes/UnitTypes/Character";
import { Monster } from "../../src/classes/UnitTypes/Monster";
import { BlueMage } from "../../src/classes/Jobs/BlueMage";
import { Warrior } from "../../src/classes/Jobs/Warrior";

/**
 * Tests de l'invocation d'Eon (Invocateur, mode coopératif).
 *
 * Mécanique (livret) : l'Invocateur choisit **quand** invoquer et **quel** Eon.
 * Une fois invoqué, l'Eon est **possédé** par le lanceur : il est à sa position,
 * avec ses stats (dégâts basés sur son Intelligence) et 10 points de transe (TP).
 * Le lanceur **n'a plus accès à ses sorts/compétences habituels** : il ne peut
 * sélectionner que les actions de l'Eon. L'invocation se termine si le lanceur
 * n'a plus de PV ou de TP. Au moins 1 TP/tour.
 *
 * Implémentation : l'Invocateur est **masqué** (`isReplaced`) — il reste vivant
 * (compte pour la défaite) mais ne peut ni agir ni être ciblé. L'Eon est ajouté
 * au plateau à sa position et agit via `useAbilityByName` (choix joueur ou IA).
 */

/** Fabrique un Invocateur niveau 20 (Mage Bleu évolué). */
function makeInvoker(id: string): Character {
  const c = new Character(id, "Invocateur", "Hero", { row: 6, col: 0 }, 30, 30, [], 12, 12, 10, 10, new BlueMage(), null, null);
  c.job.jobLevel = 20;
  c.characterLevel = 20;
  c.evolveJob("Invocateur");
  return c;
}

/** Fabrique un ennemi (Frelon). */
function makeEnemy(): Monster {
  return new Monster("Frelon", { row: 0, col: 0 }, "Enemy", 1);
}

describe("Invocation d'Eon (Invocateur, mode coopératif)", () => {
  test("summonEon : l'invocateur est masqué, l'Eon est ajouté à sa place", () => {
    const invoker = makeInvoker("e1");
    const enemy = makeEnemy();
    const battle = new BattleManager([invoker, enemy]);

    const logs = battle.summonEon(invoker, "Phoenix");

    expect(logs.some((l) => l.includes("invoque"))).toBe(true);
    // L'invocateur est masqué (hors champ) mais toujours présent et vivant.
    expect(invoker.isReplaced).toBe(true);
    expect(battle.combatState.units).toContain(invoker);
    // L'Eon est sur le plateau, à la position de l'invocateur.
    const eon = battle.combatState.units.find((u) => u instanceof Eon) as Eon;
    expect(eon).toBeDefined();
    expect(eon.position).toEqual(invoker.position);
    expect(eon.summoner).toBe(invoker);
    // L'Eon démarre avec 10 points de transe.
    expect(eon.currentTransePoint).toBe(10);
    // L'Eon utilise les stats de l'invocateur (Intelligence partagée).
    expect(eon.stats.intelligence).toBe(invoker.stats.intelligence);
  });

  test("summonEon : refuse si l'invocateur est déjà masqué", () => {
    const invoker = makeInvoker("e2");
    const enemy = makeEnemy();
    const battle = new BattleManager([invoker, enemy]);
    battle.summonEon(invoker, "Phoenix");
    const logs = battle.summonEon(invoker, "Garuda");
    expect(logs.some((l) => l.includes("déjà un Eon"))).toBe(true);
  });

  test("summonEon : refuse si l'Eon est inconnu", () => {
    const invoker = makeInvoker("e3");
    const enemy = makeEnemy();
    const battle = new BattleManager([invoker, enemy]);
    const logs = battle.summonEon(invoker, "Zorglub");
    expect(logs.some((l) => l.includes("inconnu"))).toBe(true);
    expect(battle.combatState.units.find((u) => u instanceof Eon)).toBeUndefined();
  });

  test("summonEon : refuse si le personnage n'est pas un Invocateur", () => {
    const warrior = new Character("e4", "Guerrier", "Hero", { row: 6, col: 0 }, 30, 30, [], 12, 12, 10, 10, new Warrior(), null, null);
    const enemy = makeEnemy();
    const battle = new BattleManager([warrior, enemy]);
    const logs = battle.summonEon(warrior, "Phoenix");
    expect(logs.some((l) => l.includes("Seul un Invocateur"))).toBe(true);
    expect(battle.combatState.units.find((u) => u instanceof Eon)).toBeUndefined();
  });

  test("L'invocateur masqué n'est pas dans l'ordre d'action, l'Eon si", () => {
    const invoker = makeInvoker("e5");
    const enemy = makeEnemy();
    const battle = new BattleManager([invoker, enemy]);
    battle.summonEon(invoker, "Phoenix");
    battle.combatState.buildActionOrder();
    expect(battle.combatState.actionOrder).not.toContain(invoker);
    const eon = battle.combatState.units.find((u) => u instanceof Eon) as Eon;
    expect(battle.combatState.actionOrder).toContain(eon);
  });

  test("L'invocateur masqué n'est pas ciblé par getClosestUnit", () => {
    const invoker = makeInvoker("e6");
    const enemy = makeEnemy();
    const battle = new BattleManager([invoker, enemy]);
    battle.summonEon(invoker, "Phoenix");
    // L'ennemi cherche le héros le plus proche : il ne doit pas cibler
    // l'invocateur masqué (mais l'Eon, qui est à sa place).
    const target = enemy.getClosestUnit("Hero", battle.combatState.units);
    expect(target).not.toBe(invoker);
    expect(target).toBeInstanceOf(Eon);
  });

  test("L'invocateur masqué compte toujours pour la vie (pas de fausse défaite)", () => {
    const invoker = makeInvoker("e7");
    const enemy = makeEnemy();
    const battle = new BattleManager([invoker, enemy]);
    battle.summonEon(invoker, "Phoenix");
    expect(battle.combatState.aliveHeroes).toContain(invoker);
  });

  test("Une compétence Eon déduit des TP et inflige des dégâts", () => {
    const invoker = makeInvoker("e8");
    const enemy = makeEnemy();
    const battle = new BattleManager([invoker, enemy]);
    battle.summonEon(invoker, "Phoenix");
    const eon = battle.combatState.units.find((u) => u instanceof Eon) as Eon;

    const hpBefore = enemy.currentHp;
    const tpBefore = eon.currentTransePoint;
    // "Cyclone écarlate" coûte 3 TP.
    const logs = eon.useAbilityByName("Cyclone écarlate", battle.combatState.units);

    expect(eon.currentTransePoint).toBe(tpBefore - 3);
    expect(enemy.currentHp).toBeLessThan(hpBefore);
    expect(logs.some((l) => l.includes("perd"))).toBe(true);
  });

  test("L'invocation se termine quand les TP sont épuisés (invocationEnded)", () => {
    const invoker = makeInvoker("e9");
    const enemy = makeEnemy();
    const battle = new BattleManager([invoker, enemy]);
    battle.summonEon(invoker, "Phoenix");
    const eon = battle.combatState.units.find((u) => u instanceof Eon) as Eon;

    // On épuise les TP de l'Eon.
    eon.currentTransePoint = 0;
    eon.invocationEnded = true;
    expect(eon.isDead()).toBe(true);

    // Le nettoyage renvoie l'Eon et démasque l'invocateur.
    (battle as any).cleanupFinishedInvocations();
    expect(battle.combatState.units.find((u) => u instanceof Eon)).toBeUndefined();
    expect(invoker.isReplaced).toBe(false);
    expect(battle.combatState.units).toContain(invoker);
  });

  test("L'invocation se termine quand l'invocateur n'a plus de PV", () => {
    const invoker = makeInvoker("e10");
    const enemy = makeEnemy();
    const battle = new BattleManager([invoker, enemy]);
    battle.summonEon(invoker, "Phoenix");
    const eon = battle.combatState.units.find((u) => u instanceof Eon) as Eon;

    // L'Eon partage les PV de l'invocateur : s'il tombe à 0, l'invocation finit.
    eon.currentHp = 0;
    expect(eon.isDead()).toBe(true);

    (battle as any).cleanupFinishedInvocations();
    expect(battle.combatState.units.find((u) => u instanceof Eon)).toBeUndefined();
    expect(invoker.isReplaced).toBe(false);
  });

  test("Mode auto : un Invocateur invoque son Eon au début du combat", () => {
    const invoker = makeInvoker("e11");
    const enemy = makeEnemy();
    const battle = new BattleManager([invoker, enemy]);

    // On simule le tour de l'invocateur en mode auto (executeActorAction).
    (battle as any).executeActorAction(invoker);

    // L'invocateur a invoqué son Eon (masqué) et l'Eon est sur le plateau.
    expect(invoker.isReplaced).toBe(true);
    expect(battle.combatState.units.find((u) => u instanceof Eon)).toBeDefined();
  });

  test("Mode auto : l'Eon agit via une compétence (au moins 1 TP/tour)", () => {
    const invoker = makeInvoker("e12");
    const enemy = makeEnemy();
    const battle = new BattleManager([invoker, enemy]);
    battle.summonEon(invoker, "Phoenix");
    const eon = battle.combatState.units.find((u) => u instanceof Eon) as Eon;

    const tpBefore = eon.currentTransePoint;
    // On simule le tour de l'Eon en mode auto.
    (battle as any).executeActorAction(eon);

    // L'Eon a dépensé au moins 1 TP (règle "au moins 1 TP/tour").
    expect(eon.currentTransePoint).toBeLessThan(tpBefore);
  });
});
