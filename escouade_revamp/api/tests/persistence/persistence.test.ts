// tests/persistence/persistence.test.ts
import { Character } from "../../src/classes/UnitTypes/Character";
import { BlackMage } from "../../src/classes/Jobs/BlackMage";
import { Warrior } from "../../src/classes/Jobs/Warrior";
import { CharacterFactory } from "../../src/services/factory/CharacterFactory";
import { QuestItemFactory } from "../../src/services/factory/QuestItemFactory";
import { Potion } from "../../src/classes/Items/Consumable";
import { Status } from "../../src/classes/Status";
import { Zone, ZoneType } from "../../src/classes/World/Zone";
import { Party } from "../../src/classes/Exploration/Party";
import { ExplorationState } from "../../src/classes/Exploration/ExplorationState";
import { QuestSystem } from "../../src/classes/Progression/QuestSystem";
import { QuestFactory } from "../../src/services/factory/QuestFactory";
import { QuestService } from "../../src/services/Progression/QuestService";
import { MonsterSpawnRate, Position } from "../../src/classes/Types";
import { ExplorationStorage } from "../../src/services/exploration/ExplorationStorage";

/**
 * Tests de persistance (Phase 4) : round-trip sérialisation / désérialisation.
 *
 * C'est le garde-fou contre le bug "round-trip cassé" : avant la Phase 4,
 * `saveToFile` écrivait un résumé réduit (`getSummary`) que `loadFromJSON`
 * ne pouvait pas recharger. Ces tests prouvent que l'état complet (équipe,
 * zone, quêtes, démons) survit à un aller-retour JSON.
 */

/** Fabrique un Démoniste niveau 20 avec un pacte, de l'or, de l'XP, un statut. */
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
  // Stats cohérentes avec les PV/PM max (formule : 2 PV/End + 10, 1 PM/Mana + 10)
  // pour que la migration de `fromSerialized` soit un no-op (maxHp 30, maxMp 12).
  // Défini **après** evolveJob/recruitDemon (qui modifient les stats).
  c.stats = { strength: 5, dexterity: 5, endurance: 10, mana: 2, intelligence: 5, perception: 5, charisma: 5 };
  c.maxHp = c.stats.endurance * 2 + 10;   // 30
  c.maxMp = c.stats.mana + 10;             // 12
  c.currentMp = c.maxMp;
  return c;
}

/** Fabrique une zone riche (case bloquée + rencontre spéciale + pêche). */
function makeRichZone(): Zone {
  const tileMap: boolean[][] = Array.from({ length: 14 }, () => Array(14).fill(false));
  for (let c = 7; c <= 12; c++) tileMap[7][c] = true;
  const spawnRates: MonsterSpawnRate[] = [{ monsterName: "Frelon", rate: 1 }];
  const door: Position = { row: 7, col: 10 };
  return new Zone(
    "zone_persist", "Grotte de l'Écho", "Cave", 1, spawnRates, 0.5,
    [], 999, 1, tileMap,
    { row: 7, col: 7 }, { row: 7, col: 12 }, [],
    "Grotte de l'Écho",
    [{ row: 7, col: 12 }],          // deadEnds
    [door],                          // blockedTiles (porte de sang)
    [{ demonName: "Zeromus, le Condamnateur", position: door }], // specialEncounters
    []                               // fishingTiles
  );
}

describe("Persistance — round-trip Character", () => {
  test("Un Démoniste riche survit au round-trip", () => {
    const original = makeRichDemonist();
    const data = CharacterFactory.toSerialized(original);
    const restored = CharacterFactory.fromSerialized(data);

    // Identité + PV/MP/AP.
    expect(restored.id).toBe(original.id);
    expect(restored.name).toBe(original.name);
    expect(restored.currentHp).toBe(25);
    expect(restored.maxHp).toBe(30);
    expect(restored.currentMp).toBe(12);

    // Progression.
    expect(restored.characterLevel).toBe(20);
    expect(restored.currentXp).toBe(120);
    expect(restored.gold).toBe(350);

    // Job : évolution + pacte.
    expect(restored.job.name).toBe("Démoniste");
    expect(restored.job.jobLevel).toBe(20);
    expect(restored.job.evolvedName).toBe("Démoniste");
    expect((restored.job as BlackMage).recruitedDemons).toContain("Mateus, le Corrompu");

    // Statut + sac.
    expect(restored.status.map((s) => s.name)).toContain("Poison");
    expect(restored.bag.some((i) => i.name === "Potion")).toBe(true);
    expect(restored.bag.some((i) => i.name === "Cœur de sang")).toBe(true);
  });

  test("Le nom de base du job est préservé (désérialisation d'un Démoniste)", () => {
    const original = makeRichDemonist();
    const data = CharacterFactory.toSerialized(original);
    // Le job sérialisé porte le nom de base "Mage Noir", pas "Démoniste".
    expect(data.classe.name).toBe("Mage Noir");
    expect(data.classe.evolvedName).toBe("Démoniste");
    const restored = CharacterFactory.fromSerialized(data);
    expect(restored.job.name).toBe("Démoniste"); // re-évolué à la restauration
  });
});

describe("Persistance — round-trip ExplorationState", () => {
  function makeState(): ExplorationState {
    const demonist = makeRichDemonist();
    const warrior = new Character(
      "w1", "Guerrier", "Hero", { row: 7, col: 7 },
      30, 30, [], 10, 10, 10, 10, new Warrior(), null, null
    );
    // Stats cohérentes avec les PV/PM (2 PV/End + 10, 1 PM/Mana + 10) pour que
    // la migration de `fromSerialized` soit un no-op (maxHp 30, maxMp 10).
    warrior.stats = { strength: 5, dexterity: 5, endurance: 10, mana: 0, intelligence: 5, perception: 5, charisma: 5 };
    const party = new Party("p1", [demonist, warrior], { row: 7, col: 8 });
    party.visitedTiles.add("7,8");
    party.defeatedEnemies = 5;

    const zone = makeRichZone();
    const state = new ExplorationState(party, zone);
    state.stepsTaken = 42;
    state.turnsTaken = 7;
    state.difficulty = "hard";
    state.lastHubId = "hub_qualchen";
    state.defeatedDemonsThisZone.push("Bélias, le Titan");

    // Quête acceptée + une étape faite.
    const system = state.questSystem;
    QuestFactory.createAll("fr").forEach((q) => system.addQuest(q));
    system.acceptQuest("quest_kidnappeur", [demonist]);
    QuestService.onTalk(system, "Franny");
    return state;
  }

  test("L'état complet survit au round-trip toJSON/loadFromJSON", () => {
    const original = makeState();
    const data = original.toJSON();
    const restored = ExplorationState.loadFromJSON(data);

    // Équipe.
    expect(restored.party.id).toBe("p1");
    expect(restored.party.members).toHaveLength(2);
    expect(restored.party.position).toEqual({ row: 7, col: 8 });
    expect(restored.party.visitedTiles.has("7,8")).toBe(true);
    expect(restored.party.defeatedEnemies).toBe(5);

    // Le Démoniste est restauré (pacte + or).
    const demonist = restored.party.members.find((c) => c.id === "d1")!;
    expect((demonist.job as BlackMage).recruitedDemons).toContain("Mateus, le Corrompu");
    expect(demonist.gold).toBe(350);

    // Zone : tuiles, case bloquée, rencontre spéciale.
    expect(restored.zone.name).toBe("Grotte de l'Écho");
    expect(restored.zone.isBlocked({ row: 7, col: 10 })).toBe(true);
    expect(restored.zone.getSpecialEncounterAt({ row: 7, col: 10 })?.demonName)
      .toBe("Zeromus, le Condamnateur");
    expect(restored.zone.deadEnds).toHaveLength(1);

    // Compteurs + difficulté.
    expect(restored.stepsTaken).toBe(42);
    expect(restored.turnsTaken).toBe(7);
    expect(restored.difficulty).toBe("hard");
    expect(restored.lastHubId).toBe("hub_qualchen");
    expect(restored.defeatedDemonsThisZone).toContain("Bélias, le Titan");

    // Quêtes : la quête 2 est acceptée, l'étape talk est faite.
    const quest = restored.questSystem.getQuest("quest_kidnappeur")!;
    expect(quest.accepted).toBe(true);
    expect(quest.steps.find((s) => s.id === "s1")?.done).toBe(true);
    expect(quest.steps.find((s) => s.id === "s2")?.done).toBe(false);
  });

  test("Le round-trip est stable (double sérialisation identique)", () => {
    const original = makeState();
    const once = JSON.stringify(original.toJSON());
    const twice = JSON.stringify(ExplorationState.loadFromJSON(original.toJSON()).toJSON());
    expect(twice).toBe(once);
  });
});

describe("Persistance — disque (ExplorationStorage)", () => {
  const playerId = `test_persist_${Date.now()}`;

  afterAll(() => {
    ExplorationStorage.clear(playerId);
  });

  test("saveToFile/loadFromFile : round-trip sur disque", () => {
    const demonist = makeRichDemonist();
    const party = new Party("p_disk", [demonist], { row: 7, col: 8 });
    const zone = makeRichZone();
    const state = new ExplorationState(party, zone);
    state.defeatedDemonsThisZone.push("Hashmal, le Grand Ordonnateur");

    ExplorationStorage.saveState(playerId, state);

    // On purge le cache mémoire pour forcer la lecture depuis le disque.
    const loaded = ExplorationStorage.loadFromFile(playerId);
    expect(loaded).not.toBeNull();
    expect(loaded!.party.id).toBe("p_disk");
    expect(loaded!.defeatedDemonsThisZone).toContain("Hashmal, le Grand Ordonnateur");
    expect(loaded!.zone.isBlocked({ row: 7, col: 10 })).toBe(true);
    const d = loaded!.party.members.find((c) => c.id === "d1")!;
    expect((d.job as BlackMage).recruitedDemons).toContain("Mateus, le Corrompu");
  });
});
