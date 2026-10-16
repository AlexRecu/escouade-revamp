// tests/persistence/saveService.test.ts
import { Character } from "../../src/classes/UnitTypes/Character";
import { BlackMage } from "../../src/classes/Jobs/BlackMage";
import { QuestItemFactory } from "../../src/services/factory/QuestItemFactory";
import { Potion } from "../../src/classes/Items/Consumable";
import { Status } from "../../src/classes/Status";
import { Zone } from "../../src/classes/World/Zone";
import { Party } from "../../src/classes/Exploration/Party";
import { ExplorationState } from "../../src/classes/Exploration/ExplorationState";
import { MonsterSpawnRate, Position } from "../../src/classes/Types";
import { SaveService } from "../../src/services/Progression/SaveService";

/**
 * Tests du SaveService (Phase 4 — couche Mongoose).
 *
 * La base MongoDB n'est pas disponible en test : on **mocke le modèle**
 * (`SaveService.model`) avec un store in-memory qui implémente les 4 méthodes
 * utilisées (`findOneAndUpdate`, `findOne`, `deleteOne`, `find`). On vérifie
 * ainsi la logique du service (pont ExplorationState ↔ document) et le
 * round-trip complet via le service, sans MongoDB.
 */

/** Fabrique un Démoniste riche (pacte, or, XP, statut, sac). */
function makeRichDemonist(): Character {
  const c = new Character(
    "d1", "Démoniste", "Hero", { row: 7, col: 7 },
    25, 30, [], 12, 12, 10, 10, new BlackMage(), null, null
  );
  c.job.jobLevel = 20;
  c.characterLevel = 20;
  c.evolveJob("Démoniste");
  (c.job as BlackMage).recruitDemon("Mateus, le Corrompu");
  c.gold = 350;
  c.currentXp = 120;
  c.currentHp = 25;
  const poison = new Status();
  poison.name = "Poison";
  poison.statusType = "curse";
  poison.nbTurnEffect = 3;
  c.status.push(poison);
  c.bag.push(new Potion());
  c.bag.push(QuestItemFactory.create("Cœur de sang")!);
  return c;
}

/** Fabrique une zone riche (case bloquée + rencontre spéciale). */
function makeRichZone(): Zone {
  const tileMap: boolean[][] = Array.from({ length: 14 }, () => Array(14).fill(false));
  for (let c = 7; c <= 12; c++) tileMap[7][c] = true;
  const spawnRates: MonsterSpawnRate[] = [{ monsterName: "Frelon", rate: 1 }];
  const door: Position = { row: 7, col: 10 };
  return new Zone(
    "zone_save", "Grotte de l'Écho", "Cave", 1, spawnRates, 0.5,
    [], 999, 1, tileMap,
    { row: 7, col: 7 }, { row: 7, col: 12 }, [],
    "Grotte de l'Écho",
    [{ row: 7, col: 12 }],
    [door],
    [{ demonName: "Zeromus, le Condamnateur", position: door }],
    []
  );
}

/** Fabrique un ExplorationState riche. */
function makeRichState(): ExplorationState {
  const party = new Party("party_save", [makeRichDemonist()], { row: 7, col: 7 });
  return new ExplorationState(party, makeRichZone());
}

/**
 * Mock in-memory du modèle GameSave. Implémente les 4 méthodes utilisées par
 * le SaveService. Chaque "document" est un objet simple.
 */
function makeMockModel() {
  const store = new Map<string, any>();
  return {
    store,
    async findOneAndUpdate(filter: any, update: any, _opts: any) {
      const key = String(filter.player);
      const existing = store.get(key);
      const doc = {
        player: filter.player,
        ...(existing ?? {}),
        ...(update.$set ?? {}),
      };
      store.set(key, doc);
      return doc;
    },
    async findOne(filter: any) {
      return store.get(String(filter.player)) ?? null;
    },
    async deleteOne(filter: any) {
      const existed = store.delete(String(filter.player));
      return { deletedCount: existed ? 1 : 0 };
    },
    async find() {
      return Array.from(store.values());
    },
  };
}

describe("SaveService (mock du modèle Mongoose)", () => {
  let mock: ReturnType<typeof makeMockModel>;

  beforeEach(() => {
    mock = makeMockModel();
    // @ts-expect-error — on injecte le mock à la place du vrai modèle.
    SaveService.model = mock;
  });

  test("saveGame stocke l'état + champs dénormalisés", async () => {
    const state = makeRichState();
    const summary = await SaveService.saveGame("player_1", state);

    expect(summary.playerId).toBe("player_1");
    expect(summary.zoneName).toBe("Grotte de l'Écho");
    expect(summary.difficulty).toBe("easy");
    expect(summary.partySize).toBe(1);
    expect(summary.savedAt).toBeInstanceOf(Date);

    const doc = mock.store.get("player_1");
    expect(doc).toBeDefined();
    expect(doc.state).toEqual(state.toJSON());
  });

  test("saveGame est un upsert (1 sauvegarde par joueur)", async () => {
    const state = makeRichState();
    await SaveService.saveGame("player_1", state);
    await SaveService.saveGame("player_1", state);
    expect(mock.store.size).toBe(1);
  });

  test("loadGame reconstitue un état complet (round-trip via service)", async () => {
    const original = makeRichState();
    await SaveService.saveGame("player_1", original);

    const loaded = await SaveService.loadGame("player_1");
    expect(loaded).not.toBeNull();

    const hero = loaded!.party.members[0];
    expect(hero.id).toBe("d1");
    expect(hero.characterLevel).toBe(20);
    expect(hero.gold).toBe(350);
    expect(hero.job.name).toBe("Démoniste");
    expect((hero.job as BlackMage).recruitedDemons).toContain("Mateus, le Corrompu");
    expect(loaded!.zone.name).toBe("Grotte de l'Écho");
    expect(loaded!.zone.blockedTiles).toHaveLength(1);
    expect(loaded!.zone.specialEncounters[0].demonName).toBe("Zeromus, le Condamnateur");
  });

  test("loadGame renvoie null si aucune sauvegarde", async () => {
    const loaded = await SaveService.loadGame("inconnu");
    expect(loaded).toBeNull();
  });

  test("deleteGame supprime la sauvegarde", async () => {
    await SaveService.saveGame("player_1", makeRichState());
    expect(await SaveService.deleteGame("player_1")).toBe(true);
    expect(mock.store.size).toBe(0);
    // Supprimer à nouveau → false.
    expect(await SaveService.deleteGame("player_1")).toBe(false);
  });

  test("listSaves retourne les résumés (sans l'état complet)", async () => {
    await SaveService.saveGame("player_1", makeRichState());
    const saves = await SaveService.listSaves();
    expect(saves).toHaveLength(1);
    expect(saves[0].playerId).toBe("player_1");
    expect(saves[0].zoneName).toBe("Grotte de l'Écho");
    expect(saves[0]).not.toHaveProperty("state");
  });
});
