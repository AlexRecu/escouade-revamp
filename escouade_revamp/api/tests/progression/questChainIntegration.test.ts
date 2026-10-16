// tests/progression/questChainIntegration.test.ts
import { WorldLoader } from "../../src/services/factory/WorldLoader";
import { Dungeon } from "../../src/classes/World/Dungeon";
import { Zone } from "../../src/classes/World/Zone";
import { QuestSystem } from "../../src/classes/Progression/QuestSystem";
import { QuestFactory } from "../../src/services/factory/QuestFactory";
import { QuestService } from "../../src/services/Progression/QuestService";
import { ExplorationState } from "../../src/classes/Exploration/ExplorationState";
import { Party } from "../../src/classes/Exploration/Party";
import { Character } from "../../src/classes/UnitTypes/Character";
import { BlackMage } from "../../src/classes/Jobs/BlackMage";

/**
 * Test d'intégration anti-blocage (Phase C2b) : prouve que la chaîne de
 * quêtes est **jouable de bout en bout**.
 *
 * C'est le garde-fou contre le bug "chaîne bloquée" : si un démon requis par
 * la quête 3 devient inaccessible (rencontre non ancrée, quête conditionnelle
 * mal câblée, cible goTo/defeat inexistante), ce test échoue.
 */

/** rand déterministe (toujours 0.5 → 4 pas). */
function seqRand(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

/** Un Démoniste niveau 20 (1 slot de pacte, peut accepter les quêtes). */
function makeDemonist(): Character {
  const c = new Character(
    "d1", "Démoniste", "Hero", { row: 0, col: 0 },
    30, 30, [], 12, 12, 10, 10, new BlackMage(), null, null
  );
  c.job.jobLevel = 20;
  c.characterLevel = 20;
  c.evolveJob("Démoniste");
  return c;
}

/** Renvoie le donjon du biome donné (ou undefined). */
function dungeonOfBiome(world: Awaited<ReturnType<typeof WorldLoader.generate>>, biome: string): Dungeon | undefined {
  return world.nodes.find(
    (n): n is Dungeon => n instanceof Dungeon && n.biome === biome
  );
}

/** Renvoie le nom du démon ancré dans le 1er niveau du donjon (ou null). */
function anchoredDemon(world: Awaited<ReturnType<typeof WorldLoader.generate>>, biome: string): string | null {
  const d = dungeonOfBiome(world, biome);
  if (!d || d.levels.length === 0) return null;
  const se = d.levels[0].specialEncounters[0];
  return se ? se.demonName : null;
}

describe("Chaîne de quêtes — jouable de bout en bout (anti-blocage)", () => {
  let world: Awaited<ReturnType<typeof WorldLoader.generate>>;

  beforeAll(async () => {
    world = await WorldLoader.generate(12345);
  });

  test("Les 4 démons requis par la quête 3 sont accessibles dans le monde", () => {
    // Mateus : pêche au lac (toujours).
    const lake = dungeonOfBiome(world, "Lake");
    expect(lake).toBeDefined();
    expect(lake!.levels[0].fishingTiles.length).toBeGreaterThan(0);

    // Adrammelech : Forêt, conditionnel à la quête 2.
    expect(anchoredDemon(world, "Forest")).toBe("Adrammelech, le Grand Courroux");
    // Bélias : Grotte (toujours).
    expect(anchoredDemon(world, "Cave")).toBe("Bélias, le Titan");
    // Hashmal : Tour (toujours).
    expect(anchoredDemon(world, "Tower")).toBe("Hashmal, le Grand Ordonnateur");
  });

  test("Adrammelech est conditionnel : rencontre inactive sans la quête 2", () => {
    const forest = dungeonOfBiome(world, "Forest")!;
    const zone = forest.levels[0];
    const se = zone.specialEncounters[0];
    expect(se.requiresQuest).toBe("quest_kidnappeur");

    // Sans la quête acceptée : la rencontre n'est pas active.
    const demonist = makeDemonist();
    const system = new QuestSystem();
    QuestFactory.createAll("fr").forEach((q) => system.addQuest(q));
    const state = new ExplorationState(
      new Party("p", [demonist], se.position),
      zone,
      system
    );
    // On se place sur la case du démon et on joue un tour.
    state.party.moveTo(se.position);
    state.takeTurn(se.position, seqRand([0.5]));
    expect(state.activeDemon).toBeNull(); // pas de combat sans la quête
  });

  test("Adrammelech devient actif une fois la quête 2 acceptée", () => {
    const forest = dungeonOfBiome(world, "Forest")!;
    const zone = forest.levels[0];
    const se = zone.specialEncounters[0];

    const demonist = makeDemonist();
    const system = new QuestSystem();
    QuestFactory.createAll("fr").forEach((q) => system.addQuest(q));
    // Accepte la quête 2 (nécessite un Démoniste).
    const quest = system.acceptQuest("quest_kidnappeur", [demonist]);
    expect(quest).not.toBeNull();

    const state = new ExplorationState(
      new Party("p", [demonist], se.position),
      zone,
      system
    );
    state.party.moveTo(se.position);
    state.takeTurn(se.position, seqRand([0.5]));
    expect(state.activeDemon).not.toBeNull();
    expect(state.activeDemon!.name).toBe("Adrammelech, le Grand Courroux");
  });

  test("Parcours complet : les 3 quêtes se complètent et débloquent la quête 3", () => {
    const demonist = makeDemonist();
    const system = new QuestSystem();
    QuestFactory.createAll("fr").forEach((q) => system.addQuest(q));

    // --- Quête 1 : Une pêche miraculeuse (Mateus) ---
    const q1 = system.acceptQuest("quest_peche_miraculeuse", [demonist]);
    expect(q1).not.toBeNull();
    QuestService.onTalk(system, "Qual-Chen");
    QuestService.retrieveQuestItem(system, demonist, "Embarcation");
    QuestService.onEnterZone(system, "Lac de Qual-Chen");
    expect(q1!.completed).toBe(true);

    // --- Quête 2 : Trouvez le kidnappeur (Adrammelech) ---
    const q2 = system.acceptQuest("quest_kidnappeur", [demonist]);
    expect(q2).not.toBeNull();
    QuestService.onTalk(system, "Franny");
    QuestService.onEnterZone(system, "Forêt des soupirs");
    QuestService.onDefeat(system, "Adrammelech, le Grand Courroux");
    expect(q2!.completed).toBe(true);

    // --- Démons "libres" (Bélias, Hashmal) via rencontres spéciales ---
    QuestService.onRecruit(system, "Bélias, le Titan");
    QuestService.onRecruit(system, "Hashmal, le Grand Ordonnateur");

    // --- Quête 3 : disponible une fois les 4 démons "recrutés" ---
    // (Ici on simule le recrutement ; dans le jeu c'est resolveDemonCombat.)
    const recruited = [
      "Mateus, le Corrompu",
      "Bélias, le Titan",
      "Adrammelech, le Grand Courroux",
      "Hashmal, le Grand Ordonnateur",
    ];
    const q3 = system.acceptQuest("quest_voies_seigneur", [demonist], recruited);
    expect(q3).not.toBeNull(); // ← c'est ici que le blocage se manifestait
    QuestService.onTalk(system, "Voyante");
    QuestService.retrieveQuestItem(system, demonist, "Clef de voyance");
    QuestService.onEnterZone(system, "Château Déchu");
    expect(q3!.completed).toBe(true);
  });

  test("La quête 3 est refusée sans les 4 démons (garde-fou)", () => {
    const demonist = makeDemonist();
    const system = new QuestSystem();
    QuestFactory.createAll("fr").forEach((q) => system.addQuest(q));

    // Seulement 3 démons : refus.
    expect(
      system.acceptQuest("quest_voies_seigneur", [demonist], [
        "Mateus, le Corrompu",
        "Bélias, le Titan",
        "Adrammelech, le Grand Courroux",
      ])
    ).toBeNull();
  });
});
