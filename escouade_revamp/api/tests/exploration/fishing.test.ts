// tests/exploration/fishing.test.ts
import { Party } from "../../src/classes/Exploration/Party";
import { Character } from "../../src/classes/UnitTypes/Character";
import { Warrior } from "../../src/classes/Jobs/Warrior";
import { QuestSystem } from "../../src/classes/Progression/QuestSystem";
import { ExplorationSessionService } from "../../src/services/dungeon/ExplorationSessionService";
import { HubSerializer } from "../../src/services/Hub/HubSerializer";

/**
 * Tests de la pêche au Lac de Qual-Chen.
 *
 *  - `fish` : roll déterministe (Math.random mocké) → poisson / Mateus / rien.
 *  - `fishMateus` : démarre le combat contre Mateus (une seule fois).
 *  - Le Poisson est un butin (non achetable) : exclu de l'inventaire boutique.
 */

function makeWarrior(): Character {
  return new Character("w1", "Guerrier", "Hero", { row: 7, col: 7 }, 30, 30, [], 10, 10, 10, 10, new Warrior(), null, null);
}

/** Construit une session de lac (buildSession privée → cast). */
async function buildLakeSession(): Promise<any> {
  const party = new Party("p", [makeWarrior()], { row: 7, col: 7 });
  const questSystem = new QuestSystem();
  const session = await (ExplorationSessionService as any).buildSession(party, questSystem, "Dungeon_Lake");
  return session;
}

/** Enregistre la session sous `key` et neutralise la persistance (pas de DB). */
function registerSession(session: any, key: string): void {
  (ExplorationSessionService as any).sessions.set(key, session);
  (ExplorationSessionService as any).persist = async () => {};
}

/** Mocke Math.random pour un roll déterministe. */
function mockRandom(value: number): void {
  jest.spyOn(Math, "random").mockReturnValue(value);
}

afterEach(() => {
  jest.restoreAllMocks();
  (ExplorationSessionService as any).sessions.clear();
});

describe("Pêche au Lac de Qual-Chen", () => {
  test("On ne peut pêcher que sur le lac", async () => {
    // Session de tour (biome Tower) → la pêche est refusée.
    const party = new Party("p", [makeWarrior()], { row: 7, col: 7 });
    const session = await (ExplorationSessionService as any).buildSession(party, new QuestSystem(), "Dungeon_Tower");
    registerSession(session, "k_tower");

    const result = await ExplorationSessionService.fish("k_tower");
    expect(result.outcome).toBeUndefined();
    expect(result.logs.some((l: string) => l.includes("lac"))).toBe(true);
  });

  test("Aucune prise → outcome 'nothing' à la 10e seconde", async () => {
    const session = await buildLakeSession();
    registerSession(session, "k_nothing");
    // Math.random = 0.9 → jamais < 0.25 → aucune prise.
    mockRandom(0.9);

    const result = await ExplorationSessionService.fish("k_nothing");
    expect(result.outcome).toBe("nothing");
    expect(result.atSecond).toBe(10);
    // La position de départ (port 12,7) n'est pas sur la croix de Mateus.
    expect(result.onMateusTile).toBe(false);
  });

  test("Prise sur case normale → Poisson ajouté au sac", async () => {
    const session = await buildLakeSession();
    registerSession(session, "k_fish");
    // Position hors croix (port 12,7). Math.random = 0.1 → prise à la 1re s.
    mockRandom(0.1);

    const before = session.party.bag.length;
    const result = await ExplorationSessionService.fish("k_fish");
    expect(result.outcome).toBe("fish");
    expect(result.atSecond).toBe(1);
    expect(result.onMateusTile).toBe(false);
    expect(session.party.bag.length).toBe(before + 1);
    expect(session.party.bag.some((i: any) => i.name === "Poisson")).toBe(true);
  });

  test("Prise sur la croix → outcome 'mateus' (combat non démarré)", async () => {
    const session = await buildLakeSession();
    registerSession(session, "k_mateus");
    // Position sur une case de la croix (7,7).
    session.party.position = { row: 7, col: 7 };
    mockRandom(0.1); // prise à la 1re s.

    const result = await ExplorationSessionService.fish("k_mateus");
    expect(result.outcome).toBe("mateus");
    expect(result.atSecond).toBe(1);
    expect(result.onMateusTile).toBe(true);
    // Le combat n'est PAS démarré ici (le front appelle fishMateus ensuite).
    expect(result.combat).toBeUndefined();
    // Pas de Poisson ajouté (la prise est Mateus).
    expect(session.party.bag.some((i: any) => i.name === "Poisson")).toBe(false);
  });

  test("Mateus déjà vaincu → la prise sur la croix donne un Poisson", async () => {
    const session = await buildLakeSession();
    registerSession(session, "k_mateus_done");
    session.party.position = { row: 7, col: 7 };
    session.defeatedDemonsThisZone = ["Mateus, le Corrompu"];
    mockRandom(0.1);

    const result = await ExplorationSessionService.fish("k_mateus_done");
    expect(result.outcome).toBe("fish");
    expect(result.onMateusTile).toBe(true);
    expect(session.party.bag.some((i: any) => i.name === "Poisson")).toBe(true);
  });

  test("fishMateus démarre le combat contre Mateus", async () => {
    const session = await buildLakeSession();
    registerSession(session, "k_combat");

    const result = await ExplorationSessionService.fishMateus("k_combat");
    expect(result.logs.some((l: string) => l.includes("Mateus"))).toBe(true);
    expect(result.combat).toBeDefined();
    // Le combat contient bien le démon Mateus.
    const demon = result.combat.units?.find((u: any) => u.name === "Mateus, le Corrompu");
    expect(demon).toBeDefined();
  });

  test("fishMateus refuse si Mateus est déjà vaincu", async () => {
    const session = await buildLakeSession();
    registerSession(session, "k_combat_done");
    session.defeatedDemonsThisZone = ["Mateus, le Corrompu"];

    const result = await ExplorationSessionService.fishMateus("k_combat_done");
    expect(result.combat).toBeUndefined();
    expect(result.logs.some((l: string) => l.includes("déjà été vaincu"))).toBe(true);
  });

  test("Le Poisson est exclu de l'inventaire boutique", () => {
    const inventory = HubSerializer.shopInventory(1);
    expect(inventory.some((i: any) => i.name === "Poisson")).toBe(false);
  });
});
