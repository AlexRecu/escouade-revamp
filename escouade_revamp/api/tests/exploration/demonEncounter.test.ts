// tests/exploration/demonEncounter.test.ts
import { Zone, ZoneType, SpecialEncounter } from "../../src/classes/World/Zone";
import { ExplorationState } from "../../src/classes/Exploration/ExplorationState";
import { Party } from "../../src/classes/Exploration/Party";
import { Character } from "../../src/classes/UnitTypes/Character";
import { BlackMage } from "../../src/classes/Jobs/BlackMage";
import { Warrior } from "../../src/classes/Jobs/Warrior";
import { MonsterSpawnRate, Position } from "../../src/classes/Types";
import { findDeadEnds } from "../../src/utils/TileMapGeneratorUtils";

/** rand déterministe. */
function seqRand(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

/** Fabrique une zone avec une ligne praticable (row 7, col 7..12). */
function makeZone(opts: {
  biome?: ZoneType;
  special?: SpecialEncounter[];
  blocked?: Position[];
  deadEnds?: Position[];
  fishing?: Position[];
} = {}): Zone {
  const tileMap: boolean[][] = Array.from({ length: 14 }, () => Array(14).fill(false));
  for (let c = 7; c <= 12; c++) tileMap[7][c] = true;
  const spawnRates: MonsterSpawnRate[] = [{ monsterName: "Frelon", rate: 1 }];
  return new Zone(
    "zone_demo", "Zone Démon", opts.biome ?? "Forest", 1, spawnRates, 0.5,
    [], 12345, 1, tileMap,
    { row: 7, col: 7 }, { row: 7, col: 12 }, [],
    undefined,
    opts.deadEnds ?? [],
    opts.blocked ?? [],
    opts.special ?? [],
    opts.fishing ?? []
  );
}

/** Fabrique un Démoniste (BlackMage évolué) au niveau donné. */
function makeDemonist(level: number): Character {
  const c = new Character("d1", "Démoniste", "Hero", { row: 7, col: 7 }, 30, 30, [], 12, 12, 10, 10, new BlackMage(), null, null);
  c.job.jobLevel = level;
  c.characterLevel = level;
  if (level >= 20) c.evolveJob("Démoniste");
  return c;
}

function makeWarrior(): Character {
  return new Character("w1", "Guerrier", "Hero", { row: 7, col: 7 }, 30, 30, [], 10, 10, 10, 10, new Warrior(), null, null);
}

describe("Phase B2 — Zone : impasses, rencontres spéciales, cases bloquées", () => {
  test("findDeadEnds détecte les culs-de-sac", () => {
    // Map manuelle : une ligne (row 7, col 7..11) + une branche (row 8, col 9).
    // Impasses attendues : (7,7), (7,11) [extrémités de la ligne] et (8,9) [bout de la branche].
    const tileMap: boolean[][] = Array.from({ length: 14 }, () => Array(14).fill(false));
    for (let c = 7; c <= 11; c++) tileMap[7][c] = true;
    tileMap[8][9] = true;

    const deadEnds = findDeadEnds(tileMap);
    const asSet = (arr: Position[]) => arr.map((p) => `${p.row},${p.col}`).sort();
    // Tri lexicographique : "7,11" < "7,7" < "8,9".
    expect(asSet(deadEnds)).toEqual(["7,11", "7,7", "8,9"]);
  });

  test("getSpecialEncounterAt renvoie la rencontre à la bonne case", () => {
    const special: SpecialEncounter = { demonName: "Mateus, le Corrompu", position: { row: 7, col: 10 } };
    const zone = makeZone({ special: [special] });
    expect(zone.getSpecialEncounterAt({ row: 7, col: 10 })).toBe(special);
    expect(zone.getSpecialEncounterAt({ row: 7, col: 8 })).toBeNull();
  });

  test("isBlocked / unblockTile (porte de sang)", () => {
    const zone = makeZone({ blocked: [{ row: 7, col: 11 }] });
    expect(zone.isBlocked({ row: 7, col: 11 })).toBe(true);
    expect(zone.isBlocked({ row: 7, col: 10 })).toBe(false);
    expect(zone.unblockTile({ row: 7, col: 11 })).toBe(true);
    expect(zone.isBlocked({ row: 7, col: 11 })).toBe(false);
    expect(zone.unblockTile({ row: 7, col: 11 })).toBe(false); // déjà débloquée
  });
});

describe("Phase B3 — Combat de démon en exploration", () => {
  test("takeTurn déclenche le combat de démon sur la case spéciale", () => {
    const special: SpecialEncounter = { demonName: "Mateus, le Corrompu", position: { row: 7, col: 8 } };
    const state = new ExplorationState(new Party("p", [makeWarrior()], { row: 7, col: 7 }), makeZone({ special: [special] }));

    const logs = state.takeTurn({ row: 7, col: 8 }, seqRand([0.5]));
    expect(state.activeDemon).not.toBeNull();
    expect(state.activeDemon!.name).toBe("Mateus, le Corrompu");
    expect(logs.some((l) => l.includes("démon"))).toBe(true);
    expect(state.canMove()).toBe(false);
  });

  test("Victoire : pacte récupéré par le Démoniste (slot libre)", () => {
    const demonist = makeDemonist(20); // 1 slot
    const special: SpecialEncounter = { demonName: "Mateus, le Corrompu", position: { row: 7, col: 8 } };
    const state = new ExplorationState(new Party("p", [demonist], { row: 7, col: 7 }), makeZone({ special: [special] }));

    state.takeTurn({ row: 7, col: 8 }, seqRand([0.5]));
    const battle = state.startDemonCombat();

    // Force la victoire : épuise l'endurance du démon.
    const demon = state.activeDemon!;
    const initEnd = demon.stats.endurance;
    for (let i = 0; i < initEnd; i++) demon.applyDamage(1, []);
    battle!.combatState.checkEnd();

    const { result, pacteRecupered, logs } = state.resolveDemonCombat();
    expect(result).toBe("victory");
    expect(pacteRecupered).toBe(true);
    expect((demonist.job as BlackMage).recruitedDemons).toContain("Mateus, le Corrompu");
    expect(state.defeatedDemonsThisZone).toContain("Mateus, le Corrompu");
    expect(logs.some((l) => l.includes("Pacte scellé"))).toBe(true);
  });

  test("Victoire sans slot libre : pacte perdu", () => {
    const demonist = makeDemonist(20); // 1 slot
    (demonist.job as BlackMage).recruitDemon("Mateus, le Corrompu"); // slot plein
    const special: SpecialEncounter = { demonName: "Bélias, le Titan", position: { row: 7, col: 8 } };
    const state = new ExplorationState(new Party("p", [demonist], { row: 7, col: 7 }), makeZone({ special: [special] }));

    state.takeTurn({ row: 7, col: 8 }, seqRand([0.5]));
    const battle = state.startDemonCombat();
    const demon = state.activeDemon!;
    const initEnd = demon.stats.endurance;
    for (let i = 0; i < initEnd; i++) demon.applyDamage(1, []);
    battle!.combatState.checkEnd();

    const { pacteRecupered, logs } = state.resolveDemonCombat();
    expect(pacteRecupered).toBe(false);
    expect(logs.some((l) => l.includes("pacte"))).toBe(true);
  });

  test("Victoire sans Démoniste : pacte perdu", () => {
    const special: SpecialEncounter = { demonName: "Mateus, le Corrompu", position: { row: 7, col: 8 } };
    const state = new ExplorationState(new Party("p", [makeWarrior()], { row: 7, col: 7 }), makeZone({ special: [special] }));

    state.takeTurn({ row: 7, col: 8 }, seqRand([0.5]));
    const battle = state.startDemonCombat();
    const demon = state.activeDemon!;
    const initEnd = demon.stats.endurance;
    for (let i = 0; i < initEnd; i++) demon.applyDamage(1, []);
    battle!.combatState.checkEnd();

    const { pacteRecupered, logs } = state.resolveDemonCombat();
    expect(pacteRecupered).toBe(false);
    expect(logs.some((l) => l.includes("Aucun Démoniste"))).toBe(true);
  });

  test("Défaite : gérée selon le mode de difficulté", () => {
    const special: SpecialEncounter = { demonName: "Mateus, le Corrompu", position: { row: 7, col: 8 } };
    const state = new ExplorationState(new Party("p", [makeWarrior()], { row: 7, col: 7 }), makeZone({ special: [special] }));
    state.difficulty = "hard";

    state.takeTurn({ row: 7, col: 8 }, seqRand([0.5]));
    const battle = state.startDemonCombat();
    // Force la défaite : tous les héros à 0 PV.
    for (const h of battle!.combatState.heroes) h.currentHp = 0;
    battle!.combatState.checkEnd();

    const { result } = state.resolveDemonCombat();
    expect(result).toBe("defeat");
    expect(state.isGameOver()).toBe(true);
  });

  test("resetZoneDemons réinitialise les démons vaincus", () => {
    const special: SpecialEncounter = { demonName: "Mateus, le Corrompu", position: { row: 7, col: 8 } };
    const state = new ExplorationState(new Party("p", [makeWarrior()], { row: 7, col: 7 }), makeZone({ special: [special] }));

    state.takeTurn({ row: 7, col: 8 }, seqRand([0.5]));
    const battle = state.startDemonCombat();
    const demon = state.activeDemon!;
    const initEnd = demon.stats.endurance;
    for (let i = 0; i < initEnd; i++) demon.applyDamage(1, []);
    battle!.combatState.checkEnd();
    state.resolveDemonCombat();
    expect(state.defeatedDemonsThisZone).toHaveLength(1);

    state.resetZoneDemons();
    expect(state.defeatedDemonsThisZone).toHaveLength(0);
  });

  test("Démon déjà vaincu cette session : pas de re-combat", () => {
    const special: SpecialEncounter = { demonName: "Mateus, le Corrompu", position: { row: 7, col: 8 } };
    const state = new ExplorationState(new Party("p", [makeWarrior()], { row: 7, col: 7 }), makeZone({ special: [special] }));
    state.defeatedDemonsThisZone.push("Mateus, le Corrompu");

    // Retour sur la case : pas de nouveau combat.
    state.party.moveTo({ row: 7, col: 8 });
    const logs = state.takeTurn({ row: 7, col: 8 }, seqRand([0.5]));
    expect(state.activeDemon).toBeNull();
    expect(logs.some((l) => l.includes("démon"))).toBe(false);
  });

  test("Pêche (lac) : Mateus apparaît sur une tuile de pêche", () => {
    const fishing: Position[] = [{ row: 7, col: 8 }];
    const state = new ExplorationState(
      new Party("p", [makeWarrior()], { row: 7, col: 7 }),
      makeZone({ biome: "Lake", fishing })
    );

    const logs = state.takeTurn({ row: 7, col: 8 }, seqRand([0.5]));
    expect(state.activeDemon).not.toBeNull();
    expect(state.activeDemon!.name).toBe("Mateus, le Corrompu");
    expect(logs.some((l) => l.includes("mord"))).toBe(true);
  });

  test("Pêche : pas de re-combat si Mateus déjà vaincu", () => {
    const fishing: Position[] = [{ row: 7, col: 8 }];
    const state = new ExplorationState(
      new Party("p", [makeWarrior()], { row: 7, col: 7 }),
      makeZone({ biome: "Lake", fishing })
    );
    state.defeatedDemonsThisZone.push("Mateus, le Corrompu");

    const logs = state.takeTurn({ row: 7, col: 8 }, seqRand([0.5]));
    expect(state.activeDemon).toBeNull();
    expect(logs.some((l) => l.includes("mord"))).toBe(false);
  });
});
