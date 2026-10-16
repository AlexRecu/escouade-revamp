import { EncounterEngine } from "../../src/classes/Exploration/EncounterEngine";
import { Zone, ZoneType } from "../../src/classes/World/Zone";
import { Party } from "../../src/classes/Exploration/Party";
import { Character } from "../../src/classes/UnitTypes/Character";
import { Warrior } from "../../src/classes/Jobs/Warrior";
import { MonsterSpawnRate } from "../../src/classes/Types";

/**
 * Fabrique une Zone minimale pour les tests.
 */
function makeZone(biome: ZoneType, zoneLevel = 1): Zone {
  const spawnRates: MonsterSpawnRate[] = [
    { monsterName: "Frelon", rate: 0.5 },
    { monsterName: "Gobelin", rate: 0.5 },
  ];
  const tileMap: boolean[][] = Array.from({ length: 14 }, () => Array(14).fill(false));
  return new Zone(
    "zone_test",
    "Zone Test",
    biome,
    zoneLevel,
    spawnRates,
    0.5,
    [],
    12345,
    1,
    tileMap,
    { row: 7, col: 7 },
    { row: 0, col: 0 },
    [],
    undefined
  );
}

/** Fabrique une Party de `n` personnages vivants. */
function makeParty(n: number): Party {
  const members: Character[] = [];
  for (let i = 0; i < n; i++) {
    members.push(
      new Character(`c${i}`, `Héros ${i}`, "Hero", { row: 0, col: 0 }, 30, 30, [], 10, 10, 10, 10, new Warrior(), null, null)
    );
  }
  return new Party("party_test", members, { row: 7, col: 7 });
}

/** rand déterministe : renvoie toujours la même valeur. */
const randAt = (v: number) => () => v;

describe("EncounterEngine (Phase 2)", () => {

  describe("getStepValue (P par biome)", () => {
    test("Herbes / plaines = 16", () => {
      expect(EncounterEngine.getStepValue(makeZone("Forest"))).toBe(16);
      expect(EncounterEngine.getStepValue(makeZone("Canyon"))).toBe(16);
      expect(EncounterEngine.getStepValue(makeZone("FrozenLand"))).toBe(16);
    });

    test("Grottes = 10", () => {
      expect(EncounterEngine.getStepValue(makeZone("Cave"))).toBe(10);
    });

    test("Bâtiments = 12", () => {
      expect(EncounterEngine.getStepValue(makeZone("Tower"))).toBe(12);
      expect(EncounterEngine.getStepValue(makeZone("Castle"))).toBe(12);
    });
  });

  describe("shouldTrigger (formule du livret)", () => {
    test("roll < P → rencontre (Forest P=16, roll=5)", () => {
      // rand=0.05 → roll = floor(0.05*100) = 5 < 16
      expect(EncounterEngine.shouldTrigger(makeZone("Forest"), false, randAt(0.05))).toBe(true);
    });

    test("roll >= P → pas de rencontre (Forest P=16, roll=20)", () => {
      // rand=0.20 → roll = 20 >= 16
      expect(EncounterEngine.shouldTrigger(makeZone("Forest"), false, randAt(0.20))).toBe(false);
    });

    test("Grottes P=10 : roll=9 → rencontre, roll=10 → pas de rencontre", () => {
      expect(EncounterEngine.shouldTrigger(makeZone("Cave"), false, randAt(0.09))).toBe(true);  // 9 < 10
      expect(EncounterEngine.shouldTrigger(makeZone("Cave"), false, randAt(0.10))).toBe(false); // 10 >= 10
    });

    test("Repousse actif → toujours pas de rencontre (même roll=0)", () => {
      expect(EncounterEngine.shouldTrigger(makeZone("Forest"), true, randAt(0.0))).toBe(false);
      expect(EncounterEngine.shouldTrigger(makeZone("Cave"), true, randAt(0.0))).toBe(false);
    });
  });

  describe("roll (création de la rencontre)", () => {
    test("Pas de rencontre → null", () => {
      const zone = makeZone("Forest");
      const party = makeParty(3);
      // roll=20 >= 16 → pas de rencontre
      expect(EncounterEngine.roll(zone, party, false, randAt(0.20))).toBeNull();
    });

    test("Rencontre → Encounter avec des ennemis", () => {
      const zone = makeZone("Forest");
      const party = makeParty(3);
      // roll=5 < 16 → rencontre
      const encounter = EncounterEngine.roll(zone, party, false, randAt(0.05));
      expect(encounter).not.toBeNull();
      expect(encounter!.enemies.length).toBeGreaterThanOrEqual(1);
      expect(encounter!.enemies.length).toBeLessThanOrEqual(6);
      // Les ennemis sont des monstres de la zone
      encounter!.enemies.forEach(m => {
        expect(["Frelon", "Gobelin"]).toContain(m.name);
      });
    });

    test("Repousse actif → null même si roll < P", () => {
      const zone = makeZone("Forest");
      const party = makeParty(3);
      expect(EncounterEngine.roll(zone, party, true, randAt(0.05))).toBeNull();
    });

    test("Le nombre d'ennemis est borné (gaussien clamp 1-6)", () => {
      const zone = makeZone("Forest");
      const party = makeParty(4);
      // On force une rencontre (roll = floor(0.005*100) = 0 < 16) et on vérifie le clamp.
      // NB : rand non nul pour éviter la boucle infinie de la gaussienne (u !== 0).
      for (let i = 0; i < 50; i++) {
        const encounter = EncounterEngine.roll(zone, party, false, randAt(0.005));
        expect(encounter!.enemies.length).toBeGreaterThanOrEqual(1);
        expect(encounter!.enemies.length).toBeLessThanOrEqual(6);
      }
    });
  });
});
