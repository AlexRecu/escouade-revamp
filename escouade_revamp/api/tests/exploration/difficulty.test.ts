// tests/exploration/difficulty.test.ts
import { EncounterEngine } from "../../src/classes/Exploration/EncounterEngine";
import { LootEngine } from "../../src/classes/Progression/LootEngine";
import { ExplorationState } from "../../src/classes/Exploration/ExplorationState";
import { Encounter } from "../../src/classes/Exploration/Encounter";
import { Zone, ZoneType } from "../../src/classes/World/Zone";
import { Party } from "../../src/classes/Exploration/Party";
import { Character } from "../../src/classes/UnitTypes/Character";
import { Monster } from "../../src/classes/UnitTypes/Monster";
import { Warrior } from "../../src/classes/Jobs/Warrior";
import { MonsterSpawnRate } from "../../src/classes/Types";

/**
 * Tests des différences easy/hard (Phase 4).
 *
 * Avant : la difficulté ne servait qu'à la défaite (easy = wipe, hard = game
 * over). Maintenant elle module aussi :
 *  - le **taux de rencontre** (EncounterEngine) : en hard, la valeur de pas P
 *    du biome est augmentée (×1.5) → rencontres plus fréquentes ;
 *  - le **butin** (LootEngine) : en hard, le gold et l'XP sont augmentés (×1.5)
 *    → récompense plus généreuse (cohérent avec le risque de game over).
 *
 * Les paramètres sont optionnels (défaut "easy") : les tests existants passent
 * sans changement.
 */

/** Fabrique une Zone minimale. */
function makeZone(biome: ZoneType, zoneLevel = 1): Zone {
  const spawnRates: MonsterSpawnRate[] = [
    { monsterName: "Frelon", rate: 0.5 },
    { monsterName: "Gobelin", rate: 0.5 },
  ];
  const tileMap: boolean[][] = Array.from({ length: 14 }, () => Array(14).fill(false));
  return new Zone(
    "zone_diff", "Zone Diff", biome, zoneLevel, spawnRates, 0.5,
    [], 12345, 1, tileMap, { row: 7, col: 7 }, { row: 0, col: 0 }, [], undefined
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
  return new Party("party_diff", members, { row: 7, col: 7 });
}

/** rand déterministe. */
const randAt = (v: number) => () => v;

/** Fabrique un monstre Frelon (niveau 1 : xp=15, gold=5). */
function makeFrelon(id: string): Monster {
  return new Monster("Frelon", { row: 0, col: 0 }, "Enemy", 1);
}

describe("Difficulté — taux de rencontre (EncounterEngine)", () => {
  test("getStepValue : easy = valeur de base du biome", () => {
    expect(EncounterEngine.getStepValue(makeZone("Forest"), "easy")).toBe(16);
    expect(EncounterEngine.getStepValue(makeZone("Cave"), "easy")).toBe(10);
    expect(EncounterEngine.getStepValue(makeZone("Tower"), "easy")).toBe(12);
  });

  test("getStepValue : hard = base × 1.5 (arrondi)", () => {
    // Forest 16 → 24, Cave 10 → 15, Tower 12 → 18.
    expect(EncounterEngine.getStepValue(makeZone("Forest"), "hard")).toBe(24);
    expect(EncounterEngine.getStepValue(makeZone("Cave"), "hard")).toBe(15);
    expect(EncounterEngine.getStepValue(makeZone("Tower"), "hard")).toBe(18);
  });

  test("shouldTrigger : hard déclenche plus facilement (même roll)", () => {
    // Forest easy P=16 : roll=20 → pas de rencontre.
    expect(EncounterEngine.shouldTrigger(makeZone("Forest"), false, randAt(0.20), "easy")).toBe(false);
    // Forest hard P=24 : roll=20 → rencontre (20 < 24).
    expect(EncounterEngine.shouldTrigger(makeZone("Forest"), false, randAt(0.20), "hard")).toBe(true);
  });

  test("roll : hard produit une rencontre là où easy n'en produit pas", () => {
    const zone = makeZone("Forest");
    const party = makeParty(3);
    // roll=20 : easy (P=16) → null ; hard (P=24) → rencontre.
    expect(EncounterEngine.roll(zone, party, false, randAt(0.20), "easy")).toBeNull();
    expect(EncounterEngine.roll(zone, party, false, randAt(0.20), "hard")).not.toBeNull();
  });

  test("Le défaut (sans paramètre) reste easy (rétrocompatibilité)", () => {
    expect(EncounterEngine.getStepValue(makeZone("Forest"))).toBe(16);
    expect(EncounterEngine.shouldTrigger(makeZone("Forest"), false, randAt(0.20))).toBe(false);
  });
});

describe("Difficulté — butin (LootEngine)", () => {
  test("computeLoot : easy = somme brute", () => {
    const loot = LootEngine.computeLoot([makeFrelon("f1"), makeFrelon("f2")], "easy");
    expect(loot.gold).toBe(10); // 5 + 5
    expect(loot.xp).toBe(30);   // 15 + 15
  });

  test("computeLoot : hard = somme × 1.5 (arrondi)", () => {
    const loot = LootEngine.computeLoot([makeFrelon("f1"), makeFrelon("f2")], "hard");
    expect(loot.gold).toBe(15); // 10 × 1.5
    expect(loot.xp).toBe(45);   // 30 × 1.5
  });

  test("distributeLoot : hard distribue un butin augmenté", () => {
    const a = new Character("a", "Alice", "Hero", { row: 0, col: 0 }, 30, 30, [], 10, 10, 10, 10, new Warrior(), null, null);
    const b = new Character("b", "Bob", "Hero", { row: 0, col: 0 }, 30, 30, [], 10, 10, 10, 10, new Warrior(), null, null);
    const defeated = [makeFrelon("f1"), makeFrelon("f2")]; // gold=10, xp=30

    const easy = LootEngine.distributeLoot([a, b], defeated, () => "strength", "easy");
    expect(easy.gold).toBe(10);
    expect(easy.xp).toBe(30);

    // Réinitialise les personnages pour le test hard.
    const a2 = new Character("a2", "Alice", "Hero", { row: 0, col: 0 }, 30, 30, [], 10, 10, 10, 10, new Warrior(), null, null);
    const b2 = new Character("b2", "Bob", "Hero", { row: 0, col: 0 }, 30, 30, [], 10, 10, 10, 10, new Warrior(), null, null);
    const hard = LootEngine.distributeLoot([a2, b2], defeated, () => "strength", "hard");
    expect(hard.gold).toBe(15); // 10 × 1.5
    expect(hard.xp).toBe(45);   // 30 × 1.5
    // 15 gold / 2 = 7 chacun + reste 1 pour Alice → Alice=8, Bob=7.
    expect(a2.gold).toBe(8);
    expect(b2.gold).toBe(7);
  });

  test("Le défaut (sans paramètre) reste easy (rétrocompatibilité)", () => {
    const loot = LootEngine.computeLoot([makeFrelon("f1")]);
    expect(loot.gold).toBe(5);
    expect(loot.xp).toBe(15);
  });
});

describe("Difficulté — câblage via ExplorationState", () => {
  /** rand déterministe (séquence en boucle). */
  function seqRand(values: number[]): () => number {
    let i = 0;
    return () => values[i++ % values.length];
  }

  /** Fabrique une zone avec une ligne praticable. */
  function makeZone(biome: ZoneType = "Forest"): Zone {
    const tileMap: boolean[][] = Array.from({ length: 14 }, () => Array(14).fill(false));
    for (let c = 7; c <= 12; c++) tileMap[7][c] = true;
    const spawnRates: MonsterSpawnRate[] = [
      { monsterName: "Frelon", rate: 0.5 },
      { monsterName: "Gobelin", rate: 0.5 },
    ];
    return new Zone(
      "zone_diff", "Zone Diff", biome, 1, spawnRates, 0.5,
      [], 12345, 1, tileMap, { row: 7, col: 7 }, { row: 7, col: 12 }, []
    );
  }

  /** Crée un état avec une rencontre active (sans passer par takeTurn). */
  function makeStateWithEncounter(nHeroes: number): ExplorationState {
    const members: Character[] = [];
    for (let i = 0; i < nHeroes; i++) {
      members.push(new Character(`c${i}`, `Héros ${i}`, "Hero", { row: 7, col: 7 }, 30, 30, [], 10, 10, 10, 10, new Warrior(), null, null));
    }
    const state = new ExplorationState(new Party("party_diff", members, { row: 7, col: 7 }), makeZone());
    state.currentEncounter = new Encounter(state.zone, ["Frelon", "Gobelin"], seqRand([0.1]));
    return state;
  }

  test("resolveCombat : le butin reflète la difficulté de l'état", () => {
    // easy : butin de base (Frelon + Gobelin).
    const easyState = makeStateWithEncounter(3);
    easyState.difficulty = "easy";
    const easyBattle = easyState.startCombat()!;
    for (const e of easyBattle.combatState.enemies) e.currentHp = 0;
    easyBattle.combatState.checkEnd();
    const easyResult = easyState.resolveCombat();

    // hard : même combat, butin ×1.5.
    const hardState = makeStateWithEncounter(3);
    hardState.difficulty = "hard";
    const hardBattle = hardState.startCombat()!;
    for (const e of hardBattle.combatState.enemies) e.currentHp = 0;
    hardBattle.combatState.checkEnd();
    const hardResult = hardState.resolveCombat();

    expect(easyResult.loot).toBeDefined();
    expect(hardResult.loot).toBeDefined();
    // Le butin hard est strictement supérieur (×1.5).
    expect(hardResult.loot!.gold).toBe(Math.round(easyResult.loot!.gold * 1.5));
    expect(hardResult.loot!.xp).toBe(Math.round(easyResult.loot!.xp * 1.5));
  });
});
