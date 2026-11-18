// tests/exploration/bloodDoor.test.ts
import { Zone, ZoneType, SpecialEncounter } from "../../src/classes/World/Zone";
import { ExplorationState } from "../../src/classes/Exploration/ExplorationState";
import { Party } from "../../src/classes/Exploration/Party";
import { Character } from "../../src/classes/UnitTypes/Character";
import { Warrior } from "../../src/classes/Jobs/Warrior";
import { QuestSystem } from "../../src/classes/Progression/QuestSystem";
import { MonsterSpawnRate, Position } from "../../src/classes/Types";
import { QuestItemFactory } from "../../src/services/factory/QuestItemFactory";
import { WorldLoader } from "../../src/services/factory/WorldLoader";
import { Dungeon } from "../../src/classes/World/Dungeon";
import { ExplorationSessionService } from "../../src/services/dungeon/ExplorationSessionService";

/**
 * Tests de la porte de sang & rituel Zeromus (Phase D).
 *
 *  - La porte est une case **bloquante** dans la caverne, sur laquelle est
 *    ancré Zeromus.
 *  - Le rituel (objet "Cœur de sang") débloque la case et révèle Zeromus.
 *  - L'affrontement de Zeromus est un **défi optionnel** (on y marche ou non).
 */

/** rand déterministe (toujours 0.5 → 4 pas). */
function seqRand(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

function makeWarrior(): Character {
  return new Character("w1", "Guerrier", "Hero", { row: 7, col: 7 }, 30, 30, [], 10, 10, 10, 10, new Warrior(), null, null);
}

/**
 * Fabrique une zone avec une ligne praticable (row 7, col 7..12), une porte de
 * sang bloquante à (7,10) et Zeromus ancré dessus.
 */
function makeBloodDoorZone(): Zone {
  const tileMap: boolean[][] = Array.from({ length: 14 }, () => Array(14).fill(false));
  for (let c = 7; c <= 12; c++) tileMap[7][c] = true;
  const spawnRates: MonsterSpawnRate[] = [{ monsterName: "Frelon", rate: 1 }];
  const door: Position = { row: 7, col: 10 };
  const special: SpecialEncounter = { demonName: "Zeromus, le Condamnateur", position: door };
  return new Zone(
    "zone_door", "Grotte de l'Écho", "Cave", 1, spawnRates, 0.5,
    [], 12345, 1, tileMap,
    { row: 7, col: 7 }, { row: 7, col: 12 }, [],
    undefined,
    [],            // deadEnds
    [door],        // blockedTiles (la porte)
    [special],     // specialEncounters (Zeromus sur la porte)
    []             // fishingTiles
  );
}

describe("Phase D — Porte de sang & rituel Zeromus", () => {
  test("La porte est une case bloquante : on ne peut pas y marcher", () => {
    const zone = makeBloodDoorZone();
    const state = new ExplorationState(new Party("p", [makeWarrior()], { row: 7, col: 9 }), zone);

    // La porte (7,10) est bloquée → non praticable.
    expect(zone.isBlocked({ row: 7, col: 10 })).toBe(true);
    expect(state.isWalkable({ row: 7, col: 10 })).toBe(false);

    // Tentative de marche sur la porte : refusée.
    const logs = state.takeTurn({ row: 7, col: 10 }, seqRand([0.5]));
    expect(state.party.position).toEqual({ row: 7, col: 9 }); // n'a pas bougé
    expect(logs.some((l) => l.includes("praticable"))).toBe(true);
  });

  test("Le rituel échoue sans le Cœur de sang", () => {
    const zone = makeBloodDoorZone();
    const state = new ExplorationState(new Party("p", [makeWarrior()], { row: 7, col: 9 }), zone);

    const logs = state.performBloodRitual();
    expect(logs.some((l) => l.includes("Cœur de sang"))).toBe(true);
    expect(zone.isBlocked({ row: 7, col: 10 })).toBe(true); // toujours bloquée
  });

  test("Le rituel échoue si on n'est pas adjacent à la porte", () => {
    const zone = makeBloodDoorZone();
    const warrior = makeWarrior();
    warrior.bag.push(QuestItemFactory.create("Cœur de sang")!);
    // Le groupe est loin de la porte (7,7), pas adjacent.
    const state = new ExplorationState(new Party("p", [warrior], { row: 7, col: 7 }), zone);

    const logs = state.performBloodRitual();
    expect(logs.some((l) => l.includes("proximité"))).toBe(true);
    expect(zone.isBlocked({ row: 7, col: 10 })).toBe(true);
  });

  test("Le rituel réussit : case débloquée, objet consommé, Zeromus révélé", () => {
    const zone = makeBloodDoorZone();
    const warrior = makeWarrior();
    warrior.bag.push(QuestItemFactory.create("Cœur de sang")!);
    const state = new ExplorationState(new Party("p", [warrior], { row: 7, col: 9 }), zone);

    const logs = state.performBloodRitual();

    // La porte est débloquée.
    expect(zone.isBlocked({ row: 7, col: 10 })).toBe(false);
    expect(state.isWalkable({ row: 7, col: 10 })).toBe(true);
    // L'objet est consommé.
    expect(warrior.bag.some((i) => i.name === "Cœur de sang")).toBe(false);
    // Zeromus est révélé (message).
    expect(logs.some((l) => l.includes("Zeromus"))).toBe(true);
    expect(logs.some((l) => l.includes("optionnel"))).toBe(true);
  });

  test("Zeromus est un défi optionnel : on peut y marcher après ouverture", () => {
    const zone = makeBloodDoorZone();
    const warrior = makeWarrior();
    warrior.bag.push(QuestItemFactory.create("Cœur de sang")!);
    const state = new ExplorationState(new Party("p", [warrior], { row: 7, col: 9 }), zone);

    state.performBloodRitual();

    // Le joueur CHOISIT d'avancer sur la case → combat contre Zeromus.
    const logs = state.takeTurn({ row: 7, col: 10 }, seqRand([0.5]));
    expect(state.activeDemon).not.toBeNull();
    expect(state.activeDemon!.name).toBe("Zeromus, le Condamnateur");
    expect(logs.some((l) => l.includes("démon"))).toBe(true);
  });

  test("Le rituel est idempotent : une porte déjà ouverte ne se referme pas", () => {
    const zone = makeBloodDoorZone();
    const warrior = makeWarrior();
    warrior.bag.push(QuestItemFactory.create("Cœur de sang")!);
    const state = new ExplorationState(new Party("p", [warrior], { row: 7, col: 9 }), zone);

    state.performBloodRitual();
    // Deuxième rituel : plus de porte à proximité (déjà débloquée).
    const logs = state.performBloodRitual();
    expect(logs.some((l) => l.includes("proximité"))).toBe(true);
  });
});

describe("Phase D — Ancrage de la porte de sang dans le monde", () => {
  test("La Grotte contient une case bloquante avec Zeromus ancré", async () => {
    const world = await WorldLoader.generate(12345);
    const cave = world.nodes.find(
      (n): n is Dungeon => n instanceof Dungeon && n.biome === "Cave"
    );
    expect(cave).toBeDefined();
    const zone = cave!.levels[0];

    // Il y a au moins une case bloquée.
    expect(zone.blockedTiles.length).toBeGreaterThan(0);
    // La case bloquée a Zeromus ancré dessus.
    const door = zone.blockedTiles[0];
    const se = zone.getSpecialEncounterAt(door);
    expect(se).not.toBeNull();
    expect(se!.demonName).toBe("Zeromus, le Condamnateur");
  });

  test("La porte de sang (Zeromus) est le seul démon ancré dans la Grotte", async () => {
    const world = await WorldLoader.generate(12345);
    const cave = world.nodes.find(
      (n): n is Dungeon => n instanceof Dungeon && n.biome === "Cave"
    )!;
    const zone = cave.levels[0];

    // La Grotte ne contient que Zeromus (la porte de sang) — Bélias a été
    // déplacé dans la Tour du serment, Hashmal dans la Vallée des cendres.
    const demons = zone.specialEncounters.map((se) => se.demonName);
    expect(demons).toContain("Zeromus, le Condamnateur");
    expect(demons).not.toContain("Bélias, le Titan");
    expect(demons).not.toContain("Hashmal, le Grand Ordonnateur");

    // La case de Zeromus est bloquée (porte de sang).
    const zeromusPos = zone.specialEncounters.find((s) => s.demonName === "Zeromus, le Condamnateur")!.position;
    expect(zone.isBlocked(zeromusPos)).toBe(true);
  });

  test("Bélias est ancré dans la Tour du serment, Hashmal dans la Vallée des cendres", async () => {
    const world = await WorldLoader.generate(12345);
    const tower = world.nodes.find(
      (n): n is Dungeon => n instanceof Dungeon && n.biome === "Tower"
    )!;
    const canyon = world.nodes.find(
      (n): n is Dungeon => n instanceof Dungeon && n.biome === "Canyon"
    )!;

    const towerDemons = tower.levels[0].specialEncounters.map((se) => se.demonName);
    const canyonDemons = canyon.levels[0].specialEncounters.map((se) => se.demonName);
    expect(towerDemons).toContain("Bélias, le Titan");
    expect(canyonDemons).toContain("Hashmal, le Grand Ordonnateur");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Flux LIVE (ExplorationSessionService) — la porte de sang dans le donjon généré
// ─────────────────────────────────────────────────────────────────────────────

/** Construit une session de caverne via la méthode privée (flux live). */
async function buildCaveSession(): Promise<any> {
  const party = new Party("p", [makeWarrior()], { row: 7, col: 7 });
  const questSystem = new QuestSystem();
  return (ExplorationSessionService as any).buildSession(party, questSystem, "Dungeon_Cave");
}

/** Construit une session de tour (biome sans porte de sang). */
async function buildTowerSession(): Promise<any> {
  const party = new Party("p", [makeWarrior()], { row: 7, col: 7 });
  const questSystem = new QuestSystem();
  return (ExplorationSessionService as any).buildSession(party, questSystem, "Dungeon_Tower");
}

/** Trouve la porte de sang (case bloquée avec un démon ancré) sur l'étage. */
function findBloodDoor(zone: any): { row: number; col: number } | null {
  const door = zone.blockedTiles.find((b: any) => zone.getSpecialEncounterAt(b));
  return door ? { row: door.row, col: door.col } : null;
}

describe("Phase D — Porte de sang : ancrage (flux live)", () => {
  test("La porte est ancrée sur le dernier étage de la caverne, avec Zeromus", async () => {
    const session = await buildCaveSession();
    const levels = session.dungeon.levels;
    expect(levels.length).toBeGreaterThan(1);

    // Pas de porte sur le 1er étage.
    expect(findBloodDoor(levels[0])).toBeNull();

    // La porte est sur le dernier étage, avec Zeromus ancré.
    const last = levels[levels.length - 1];
    const door = findBloodDoor(last);
    expect(door).not.toBeNull();
    const se = last.specialEncounters.find(
      (s: any) => s.position.row === door!.row && s.position.col === door!.col
    );
    expect(se).toBeDefined();
    expect(se.demonName).toBe("Zeromus, le Condamnateur");
  });

  test("La case de la porte est praticable, ni au départ ni à la sortie, et ne bloque pas la sortie", async () => {
    const session = await buildCaveSession();
    const last = session.dungeon.levels[session.dungeon.levels.length - 1];
    const door = findBloodDoor(last)!;

    expect(last.tileMap[door.row][door.col]).toBe(true);
    expect(`${door.row},${door.col}`).not.toEqual(`${last.startTile.row},${last.startTile.col}`);
    expect(`${door.row},${door.col}`).not.toEqual(`${last.endTile.row},${last.endTile.col}`);
    // Le rituel + le combat restent optionnels : la porte ne coupe pas la sortie.
    expect((ExplorationSessionService as any).blocksExit(last, door)).toBe(false);
  });

  test("Pas de porte de sang dans un autre biome (Tour)", async () => {
    const session = await buildTowerSession();
    for (const zone of session.dungeon.levels) {
      expect(findBloodDoor(zone)).toBeNull();
    }
  });

  test("La case de la porte est non praticable tant qu'elle est bloquée", async () => {
    const session = await buildCaveSession();
    const last = session.dungeon.levels[session.dungeon.levels.length - 1];
    const door = findBloodDoor(last)!;
    expect((ExplorationSessionService as any).isWalkable(last, door)).toBe(false);
  });
});

describe("Phase D — Rituel de la porte de sang (flux live)", () => {
  // `performBloodRitual` appelle `persistAll` (DB) : on le neutralise pour
  // tester la logique pure (consommation + déblocage + révélation).
  beforeEach(() => {
    (ExplorationSessionService as any).persistAll = async () => {};
  });

  /** Session de caverne + équipe positionnée sur une case adjacente à la porte. */
  async function setupRitual(): Promise<{ session: any; door: { row: number; col: number } }> {
    const session = await buildCaveSession();
    const last = session.dungeon.levels[session.dungeon.levels.length - 1];
    const door = findBloodDoor(last)!;
    const neighbors = [
      { row: door.row - 1, col: door.col },
      { row: door.row + 1, col: door.col },
      { row: door.row, col: door.col - 1 },
      { row: door.row, col: door.col + 1 },
    ];
    const spot = neighbors.find((n) => last.tileMap[n.row]?.[n.col] === true && !last.isBlocked(n));
    expect(spot).toBeDefined(); // il doit toujours y avoir une case adjacente praticable
    session.party.moveTo(spot);
    session.currentFloor = session.dungeon.levels.length - 1;
    (ExplorationSessionService as any).sessions.set("test-key", session);
    return { session, door };
  }

  test("Le rituel consomme le Cœur de sang, débloque la porte et révèle Zeromus", async () => {
    const { session, door } = await setupRitual();
    session.party.bag.push(QuestItemFactory.create("Cœur de sang")!);

    const result = await ExplorationSessionService.performBloodRitual("test-key");
    const last = session.dungeon.levels[session.dungeon.levels.length - 1];

    // Le Cœur de sang est consommé.
    expect(session.party.bag.some((i: any) => i.name === "Cœur de sang")).toBe(false);
    // La porte est débloquée et praticable.
    expect(last.isBlocked(door)).toBe(false);
    expect((ExplorationSessionService as any).isWalkable(last, door)).toBe(true);
    // Le log mentionne l'ouverture.
    expect(result.logs.join(" ")).toMatch(/porte de sang s'ouvre/i);
    // Zeromus est révélé (champ `demon` de la sérialisation).
    expect(result.state.demon).not.toBeNull();
    expect(result.state.demon.name).toBe("Zeromus, le Condamnateur");
    // La porte n'est plus affichée (débloquée).
    expect(result.state.bloodDoor).toBeNull();
  });

  test("Le rituel échoue sans le Cœur de sang (la porte reste fermée)", async () => {
    const { session, door } = await setupRitual();

    const result = await ExplorationSessionService.performBloodRitual("test-key");
    const last = session.dungeon.levels[session.dungeon.levels.length - 1];

    expect(result.logs.join(" ")).toMatch(/Cœur de sang/i);
    expect(last.isBlocked(door)).toBe(true);
    // Zeromus reste invisible (derrière la porte fermée).
    expect(result.state.demon).toBeNull();
    expect(result.state.bloodDoor).not.toBeNull();
  });

  test("Le rituel échoue si l'équipe n'est pas adjacente à la porte", async () => {
    const session = await buildCaveSession();
    const last = session.dungeon.levels[session.dungeon.levels.length - 1];
    const door = findBloodDoor(last)!;
    session.party.moveTo({ ...last.startTile });
    session.currentFloor = session.dungeon.levels.length - 1;
    session.party.bag.push(QuestItemFactory.create("Cœur de sang")!);
    (ExplorationSessionService as any).sessions.set("test-key", session);

    const result = await ExplorationSessionService.performBloodRitual("test-key");
    expect(result.logs.join(" ")).toMatch(/pas de porte de sang à proximité/i);
    // La porte reste bloquée, le Cœur de sang n'est pas consommé.
    expect(last.isBlocked(door)).toBe(true);
    expect(session.party.bag.some((i: any) => i.name === "Cœur de sang")).toBe(true);
  });
});
