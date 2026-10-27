// tests/combat/protection.test.ts
import { BattleManager } from "../../src/classes/Combat/BattleManager";
import { Character } from "../../src/classes/UnitTypes/Character";
import { Monster } from "../../src/classes/UnitTypes/Monster";
import { Warrior } from "../../src/classes/Jobs/Warrior";

/**
 * Tests de la **protection d'allié** (Guerrier / Paladin sous « Bouclier
 * Impénétrable »).
 *
 * Mécanique (livret) : quand un ennemi attaque un héros, un allié sous
 * « Bouclier Impénétrable » peut l'intercepter — il se place à la place de la
 * cible et encaisse l'attaque à sa place.
 *  - Guerrier : un roll, protège si roll >= 5.
 *  - Paladin : double roll, protège si roll + doubleRoll >= 6.
 *
 * Deux niveaux testés :
 *  - `Character.protectTarget` : la logique métier (roll + swap de position).
 *  - `AIService.tryProtect` : le câblage (l'IA détecte le protecteur et
 *    intercepte l'attaque).
 */

type Pos = { row: number; col: number };

function makeWarrior(id: string, pos: Pos): Character {
  return new Character(id, "Guerrier", "Hero", pos, 30, 30, [], 12, 12, 10, 10, new Warrior(), null, null);
}

function makeAlly(id: string, pos: Pos): Character {
  return new Character(id, "Allié", "Hero", pos, 30, 30, [], 12, 12, 10, 10, new Warrior(), null, null);
}

function makeEnemy(pos: Pos): Monster {
  return new Monster("Frelon", pos, "Enemy", 1);
}

/** Pose le statut « Bouclier Impénétrable » (casse exacte du skill Warrior). */
function giveShield(w: Character): void {
  w.status.push({ name: "Bouclier Impénétrable", statusType: "boon", nbTurnEffect: 4 });
}

describe("Character.protectTarget (logique métier)", () => {
  test("Guerrier roll >= 5 : protège et swap de position", () => {
    const warrior = makeWarrior("w1", { row: 6, col: 0 });
    const ally = makeAlly("a1", { row: 6, col: 2 });
    giveShield(warrior);
    const log: string[] = [];
    const protected_ = warrior.protectTarget(ally, 5, 0, log);
    expect(protected_).toBe(true);
    // Le protecteur a pris la place de la cible (swap).
    expect(warrior.position).toEqual({ row: 6, col: 2 });
    expect(ally.position).toEqual({ row: 6, col: 0 });
    expect(log.some((l) => l.includes("protège"))).toBe(true);
  });

  test("Guerrier roll < 5 : ne protège pas (pas de swap)", () => {
    const warrior = makeWarrior("w2", { row: 6, col: 0 });
    const ally = makeAlly("a2", { row: 6, col: 2 });
    giveShield(warrior);
    const log: string[] = [];
    const protected_ = warrior.protectTarget(ally, 4, 0, log);
    expect(protected_).toBe(false);
    expect(warrior.position).toEqual({ row: 6, col: 0 });
    expect(ally.position).toEqual({ row: 6, col: 2 });
  });

  test("Paladin double roll : roll + doubleRoll >= 6 protège", () => {
    const warrior = makeWarrior("w3", { row: 6, col: 0 });
    const ally = makeAlly("a3", { row: 6, col: 2 });
    giveShield(warrior);
    const log: string[] = [];
    const protected_ = warrior.protectTarget(ally, 3, 3, log); // 3 + 3 = 6
    expect(protected_).toBe(true);
  });

  test("Paladin double roll : roll + doubleRoll < 6 ne protège pas", () => {
    const warrior = makeWarrior("w4", { row: 6, col: 0 });
    const ally = makeAlly("a4", { row: 6, col: 2 });
    giveShield(warrior);
    const log: string[] = [];
    const protected_ = warrior.protectTarget(ally, 2, 3, log); // 2 + 3 = 5
    expect(protected_).toBe(false);
  });

  test("Sans le statut Bouclier Impénétrable : ne protège pas", () => {
    const warrior = makeWarrior("w5", { row: 6, col: 0 });
    const ally = makeAlly("a5", { row: 6, col: 2 });
    // pas de giveShield
    const log: string[] = [];
    const protected_ = warrior.protectTarget(ally, 6, 0, log);
    expect(protected_).toBe(false);
  });
});

describe("AIService.tryProtect (câblage IA)", () => {
  test("L'IA intercepte l'attaque via le protecteur sous bouclier", () => {
    const warrior = makeWarrior("w1", { row: 6, col: 0 });
    const ally = makeAlly("a1", { row: 6, col: 2 });
    const enemy = makeEnemy({ row: 0, col: 0 });
    giveShield(warrior);
    // Roller fixe à 6 : le roll de protection (>= 5) réussit.
    const battle = new BattleManager([warrior, ally, enemy], () => 6);
    const ai = (battle as any).ai;
    const intercepted = ai.tryProtect(ally);
    expect(intercepted).toBe(true);
    // Le guerrier a pris la place de l'allié (swap).
    expect(warrior.position).toEqual({ row: 6, col: 2 });
    expect(ally.position).toEqual({ row: 6, col: 0 });
  });

  test("Sans protecteur sous bouclier : l'IA n'intercepte pas", () => {
    const warrior = makeWarrior("w2", { row: 6, col: 0 });
    const ally = makeAlly("a2", { row: 6, col: 2 });
    const enemy = makeEnemy({ row: 0, col: 0 });
    // pas de bouclier
    const battle = new BattleManager([warrior, ally, enemy], () => 6);
    const ai = (battle as any).ai;
    const intercepted = ai.tryProtect(ally);
    expect(intercepted).toBe(false);
  });

  test("Le protecteur ciblé lui-même n'intercepte pas (self)", () => {
    const warrior = makeWarrior("w3", { row: 6, col: 0 });
    const ally = makeAlly("a3", { row: 6, col: 2 });
    const enemy = makeEnemy({ row: 0, col: 0 });
    giveShield(warrior);
    const battle = new BattleManager([warrior, ally, enemy], () => 6);
    const ai = (battle as any).ai;
    // warrior est la cible : il ne peut pas se protéger lui-même via tryProtect
    // (le protecteur doit être un héros **différent** de la cible).
    const intercepted = ai.tryProtect(warrior);
    expect(intercepted).toBe(false);
  });
});
