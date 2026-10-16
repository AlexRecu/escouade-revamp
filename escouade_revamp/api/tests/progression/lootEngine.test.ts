import { LootEngine } from "../../src/classes/Progression/LootEngine";
import { Character } from "../../src/classes/UnitTypes/Character";
import { Monster } from "../../src/classes/UnitTypes/Monster";
import { Warrior } from "../../src/classes/Jobs/Warrior";
import { Statistics } from "../../src/classes/Types";

/** Fabrique un personnage vivant (niveau 1, stats de base). */
function makeChar(id: string, name: string): Character {
  return new Character(id, name, "Hero", { row: 0, col: 0 }, 30, 30, [], 10, 10, 10, 10, new Warrior(), null, null);
}

/** Fabrique un monstre Frelon (niveau 1 : xp=15, gold=5). */
function makeFrelon(id: string): Monster {
  return new Monster("Frelon", { row: 0, col: 0 }, "Enemy", 1);
}

describe("LootEngine (Phase 2)", () => {

  describe("computeLoot", () => {
    test("Somme du gold et de l'XP des monstres vaincus", () => {
      const defeated = [makeFrelon("f1"), makeFrelon("f2")];
      const loot = LootEngine.computeLoot(defeated);
      expect(loot.gold).toBe(10); // 5 + 5
      expect(loot.xp).toBe(30);   // 15 + 15
    });

    test("Aucun monstre → 0", () => {
      const loot = LootEngine.computeLoot([]);
      expect(loot.gold).toBe(0);
      expect(loot.xp).toBe(0);
    });
  });

  describe("distributeLoot", () => {
    test("Partage égal du gold et de l'XP entre les survivants", () => {
      const a = makeChar("a", "Alice");
      const b = makeChar("b", "Bob");
      const defeated = [makeFrelon("f1"), makeFrelon("f2")]; // gold=10, xp=30
      const result = LootEngine.distributeLoot([a, b], defeated, () => "strength");

      expect(result.gold).toBe(10);
      expect(result.xp).toBe(30);
      // 10 gold / 2 = 5 chacun, 30 xp / 2 = 15 chacun
      expect(a.gold).toBe(5);
      expect(b.gold).toBe(5);
      expect(a.currentXp).toBe(15);
      expect(b.currentXp).toBe(15);
    });

    test("Le reste revient au premier survivant", () => {
      const a = makeChar("a", "Alice");
      const b = makeChar("b", "Bob");
      const c = makeChar("c", "Chloé");
      const defeated = [makeFrelon("f1")]; // gold=5, xp=15
      LootEngine.distributeLoot([a, b, c], defeated, () => "strength");
      // 5 gold / 3 = 1 chacun + reste 2 pour Alice → Alice=3, Bob=1, Chloé=1
      expect(a.gold).toBe(3);
      expect(b.gold).toBe(1);
      expect(c.gold).toBe(1);
      // 15 xp / 3 = 5 chacun, reste 0
      expect(a.currentXp).toBe(5);
      expect(b.currentXp).toBe(5);
      expect(c.currentXp).toBe(5);
    });

    test("Les morts ne reçoivent rien", () => {
      const a = makeChar("a", "Alice");
      const dead = makeChar("d", "Dead");
      dead.currentHp = 0; // KO
      const defeated = [makeFrelon("f1")]; // gold=5, xp=15
      const result = LootEngine.distributeLoot([a, dead], defeated, () => "strength");
      expect(a.gold).toBe(5);
      expect(dead.gold).toBe(0);
      expect(result.levelUps.length).toBe(0);
    });

    test("Aucun survivant → butin perdu", () => {
      const dead = makeChar("d", "Dead");
      dead.currentHp = 0;
      const result = LootEngine.distributeLoot([dead], [makeFrelon("f1")], () => "strength");
      expect(result.gold).toBe(0);
      expect(result.xp).toBe(0);
      expect(result.logs[0]).toContain("Aucun survivant");
    });
  });

  describe("Montée de niveau (+1 stat au choix)", () => {
    test("Une montée de niveau donne +1 à la stat choisie", () => {
      const a = makeChar("a", "Alice");
      const strengthBefore = a.stats.strength;
      // 100 XP → niveau 2 (besoin 100)
      const defeated: Monster[] = [];
      // On simule 100 XP via un monstre custom : on utilise directement applyXp via distributeLoot
      // en créant un monstre avec xp=100. Le Frelon n'a que 15 XP, donc on force via un monstre de niveau supérieur.
      // Plus simple : créer un monstre et surcharger xp.
      const big = new Monster("Frelon", { row: 0, col: 0 }, "Enemy", 1);
      (big as any).xp = 100;
      (big as any).gold = 0;
      const result = LootEngine.distributeLoot([a], [big], () => "strength");
      expect(a.characterLevel).toBe(2);
      expect(a.stats.strength).toBe(strengthBefore + 1);
      expect(result.levelUps.length).toBe(1);
      expect(result.levelUps[0].stat).toBe("strength");
    });

    test("Montées de niveau en cascade", () => {
      const a = makeChar("a", "Alice");
      const dexBefore = a.stats.dexterity;
      // 300 XP → niveau 1→2 (100) → 3→? : 100 (niv2) + 200 (niv3) = 300 → niveau 3
      const big = new Monster("Frelon", { row: 0, col: 0 }, "Enemy", 1);
      (big as any).xp = 300;
      (big as any).gold = 0;
      const result = LootEngine.distributeLoot([a], [big], () => "dexterity");
      expect(a.characterLevel).toBe(3);
      expect(a.stats.dexterity).toBe(dexBefore + 2); // +1 par montée
      expect(result.levelUps.length).toBe(2);
    });

    test("Le choix de stat peut varier par montée (callback)", () => {
      const a = makeChar("a", "Alice");
      const strBefore = a.stats.strength;
      const intBefore = a.stats.intelligence;
      const big = new Monster("Frelon", { row: 0, col: 0 }, "Enemy", 1);
      (big as any).xp = 300;
      (big as any).gold = 0;
      let call = 0;
      LootEngine.distributeLoot([a], [big], () => (call++ === 0 ? "strength" : "intelligence"));
      expect(a.stats.strength).toBe(strBefore + 1);
      expect(a.stats.intelligence).toBe(intBefore + 1);
    });
  });
});
