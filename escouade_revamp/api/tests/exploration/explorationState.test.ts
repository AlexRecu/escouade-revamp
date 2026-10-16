import { ExplorationState } from "../../src/classes/Exploration/ExplorationState";
import { Encounter } from "../../src/classes/Exploration/Encounter";
import { Zone, ZoneType } from "../../src/classes/World/Zone";
import { Party } from "../../src/classes/Exploration/Party";
import { Campfire } from "../../src/classes/Progression/Campfire";
import { Character } from "../../src/classes/UnitTypes/Character";
import { Warrior } from "../../src/classes/Jobs/Warrior";
import { MonsterSpawnRate, Position } from "../../src/classes/Types";

/** rand déterministe : renvoie les valeurs de la séquence en boucle. */
function seqRand(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

/** Fabrique une zone avec une ligne praticable (row 7, col 7..12). */
function makeZone(biome: ZoneType = "Forest", campfireAt?: Position): Zone {
  const tileMap: boolean[][] = Array.from({ length: 14 }, () => Array(14).fill(false));
  for (let c = 7; c <= 12; c++) tileMap[7][c] = true;

  const spawnRates: MonsterSpawnRate[] = [
    { monsterName: "Frelon", rate: 0.5 },
    { monsterName: "Gobelin", rate: 0.5 },
  ];

  const checkpoints: Campfire[] = campfireAt
    ? [new Campfire("Feu de camp", 0.5, 0.5, campfireAt)]
    : [];

  return new Zone(
    "zone_test", "Zone Test", biome, 1, spawnRates, 0.5,
    checkpoints, 12345, 1, tileMap,
    { row: 7, col: 7 }, { row: 7, col: 12 },
    campfireAt ? [campfireAt] : []
  );
}

function makeParty(n: number): Party {
  const members: Character[] = [];
  for (let i = 0; i < n; i++) {
    members.push(new Character(`c${i}`, `Héros ${i}`, "Hero", { row: 7, col: 7 }, 30, 30, [], 10, 10, 10, 10, new Warrior(), null, null));
  }
  return new Party("party_test", members, { row: 7, col: 7 });
}

describe("Boucle d'exploration (Phase 2)", () => {

  describe("rollSteps (dé de déplacement)", () => {
    test("Valeur bornée entre 1 et 6", () => {
      const state = new ExplorationState(makeParty(3), makeZone());
      expect(state.rollSteps(seqRand([0.0]))).toBe(1);
      expect(state.rollSteps(seqRand([0.99]))).toBe(6);
      expect(state.rollSteps(seqRand([0.5]))).toBe(4); // floor(0.5*6)+1 = 4
    });
  });

  describe("takeTurn (dé = nb pas, 1 tour = N pas)", () => {
    test("Déplacement valide : position mise à jour, pas comptés", () => {
      const state = new ExplorationState(makeParty(3), makeZone());
      state.activateRepousse(); // évite la rencontre
      const logs = state.takeTurn({ row: 7, col: 8 }, seqRand([0.5])); // 3 pas, dist 1
      expect(state.party.position).toEqual({ row: 7, col: 8 });
      expect(state.stepsTaken).toBe(1);
      expect(state.turnsTaken).toBe(1);
      expect(state.currentEncounter).toBeNull();
      expect(logs.some(l => l.includes("lance le dé"))).toBe(true);
    });

    test("Case trop loin → refus (distance > pas)", () => {
      const state = new ExplorationState(makeParty(3), makeZone());
      state.activateRepousse();
      const before = { ...state.party.position };
      // rand=0.0 → 1 pas, mais {7,12} est à 5 pas
      state.takeTurn({ row: 7, col: 12 }, seqRand([0.0]));
      expect(state.party.position).toEqual(before);
      expect(state.stepsTaken).toBe(0);
    });

    test("Case non praticable → refus", () => {
      const state = new ExplorationState(makeParty(3), makeZone());
      state.activateRepousse();
      const before = { ...state.party.position };
      state.takeTurn({ row: 0, col: 0 }, seqRand([0.5]));
      expect(state.party.position).toEqual(before);
    });

    test("Impossible de se déplacer pendant un combat", () => {
      const state = new ExplorationState(makeParty(3), makeZone());
      state.currentEncounter = new Encounter(state.zone);
      const before = { ...state.party.position };
      state.takeTurn({ row: 7, col: 8 }, seqRand([0.5]));
      expect(state.party.position).toEqual(before);
    });
  });

  describe("Rencontre (1 roll par pas)", () => {
    test("Rencontre se déclenche sans Repousse (roll < P)", () => {
      const state = new ExplorationState(makeParty(3), makeZone("Forest"));
      // rand=0.05 → 1 pas, et floor(0.05*100)=5 < 16 → rencontre
      state.takeTurn({ row: 7, col: 8 }, seqRand([0.05]));
      expect(state.currentEncounter).not.toBeNull();
      expect(state.currentEncounter!.enemies.length).toBeGreaterThanOrEqual(1);
    });

    test("Repousse actif → pas de rencontre", () => {
      const state = new ExplorationState(makeParty(3), makeZone("Forest"));
      state.activateRepousse();
      // Même rand qui déclencherait une rencontre sans Repousse
      state.takeTurn({ row: 7, col: 8 }, seqRand([0.05]));
      expect(state.currentEncounter).toBeNull();
    });
  });

  describe("Repousse (compteur par tour)", () => {
    test("activateRepousse met 3 tours", () => {
      const state = new ExplorationState(makeParty(3), makeZone());
      expect(state.repousseTurnsLeft).toBe(0);
      state.activateRepousse();
      expect(state.repousseTurnsLeft).toBe(3);
    });

    test("Le compteur se décrémente à la fin de chaque tour", () => {
      const state = new ExplorationState(makeParty(3), makeZone());
      state.activateRepousse();
      state.takeTurn({ row: 7, col: 8 }, seqRand([0.5]));
      expect(state.repousseTurnsLeft).toBe(2);
      state.takeTurn({ row: 7, col: 9 }, seqRand([0.5]));
      expect(state.repousseTurnsLeft).toBe(1);
    });
  });

  describe("Feu de camp (repos automatique)", () => {
    test("Arriver sur un feu de camp → repos, pas de rencontre", () => {
      const campfireAt = { row: 7, col: 9 };
      const state = new ExplorationState(makeParty(3), makeZone("Forest", campfireAt));
      state.activateRepousse();
      const hpBefore = state.party.members[0].currentHp;
      state.party.members[0].currentHp = 10; // blesser pour voir le soin
      state.takeTurn({ row: 7, col: 9 }, seqRand([0.5]));
      expect(state.activeCampfire).toBeDefined();
      expect(state.party.members[0].currentHp).toBeGreaterThan(10);
      expect(state.currentEncounter).toBeNull();
    });
  });

  describe("isExplorationComplete", () => {
    test("Vrai quand l'équipe atteint la case de fin", () => {
      const state = new ExplorationState(makeParty(3), makeZone());
      expect(state.isExplorationComplete()).toBe(false);
      state.party.moveTo({ row: 7, col: 12 });
      expect(state.isExplorationComplete()).toBe(true);
    });
  });
});
