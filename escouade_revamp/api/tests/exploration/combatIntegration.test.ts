// tests/exploration/combatIntegration.test.ts
import { ExplorationState } from "../../src/classes/Exploration/ExplorationState";
import { Encounter } from "../../src/classes/Exploration/Encounter";
import { Zone, ZoneType } from "../../src/classes/World/Zone";
import { Party } from "../../src/classes/Exploration/Party";
import { Character } from "../../src/classes/UnitTypes/Character";
import { Warrior } from "../../src/classes/Jobs/Warrior";
import { MonsterSpawnRate, Position } from "../../src/classes/Types";
import { CombatService } from "../../src/services/Battle/CombatService";

/** rand déterministe : renvoie les valeurs de la séquence en boucle. */
function seqRand(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

/** Fabrique une zone avec une ligne praticable (row 7, col 7..12). */
function makeZone(biome: ZoneType = "Forest"): Zone {
  const tileMap: boolean[][] = Array.from({ length: 14 }, () => Array(14).fill(false));
  for (let c = 7; c <= 12; c++) tileMap[7][c] = true;

  const spawnRates: MonsterSpawnRate[] = [
    { monsterName: "Frelon", rate: 0.5 },
    { monsterName: "Gobelin", rate: 0.5 },
  ];

  return new Zone(
    "zone_test", "Zone Test", biome, 1, spawnRates, 0.5,
    [], 12345, 1, tileMap,
    { row: 7, col: 7 }, { row: 7, col: 12 }, []
  );
}

function makeParty(n: number): Party {
  const members: Character[] = [];
  for (let i = 0; i < n; i++) {
    members.push(new Character(`c${i}`, `Héros ${i}`, "Hero", { row: 7, col: 7 }, 30, 30, [], 10, 10, 10, 10, new Warrior(), null, null));
  }
  return new Party("party_test", members, { row: 7, col: 7 });
}

/** Crée un état avec une rencontre active (sans passer par takeTurn). */
function makeStateWithEncounter(nHeroes: number): ExplorationState {
  const state = new ExplorationState(makeParty(nHeroes), makeZone());
  state.currentEncounter = new Encounter(state.zone, ["Frelon", "Gobelin"], seqRand([0.1]));
  return state;
}

describe("Intégration exploration → combat (Phase 2)", () => {

  describe("startCombat (construction du BattleManager)", () => {
    test("Retourne null sans rencontre", () => {
      const state = new ExplorationState(makeParty(3), makeZone());
      expect(state.startCombat()).toBeNull();
    });

    test("Construit un combat avec héros + ennemis placés", () => {
      const state = makeStateWithEncounter(3);
      const battle = state.startCombat();
      expect(battle).not.toBeNull();
      expect(state.activeBattle).toBe(battle);

      const cs = battle!.combatState;
      expect(cs.heroes).toHaveLength(3);
      expect(cs.enemies).toHaveLength(2);
      // Héros en bas du plateau (rows 6-7).
      for (const h of cs.heroes) {
        expect(h.position.row).toBeGreaterThanOrEqual(6);
        expect(h.position.row).toBeLessThan(8);
      }
    });
  });

  describe("resolveCombat (résolution + conséquences)", () => {
    test("Lève une erreur sans combat actif", () => {
      const state = makeStateWithEncounter(3);
      expect(() => state.resolveCombat()).toThrow();
    });

    test("Victoire : butin distribué, rencontre terminée, ennemis comptés", () => {
      const state = makeStateWithEncounter(3);
      const battle = state.startCombat()!;

      // Force une victoire : tous les ennemis à 0 HP.
      for (const e of battle.combatState.enemies) e.currentHp = 0;
      battle.combatState.checkEnd();

      const { outcome, loot } = state.resolveCombat();
      expect(outcome.result).toBe("victory");
      expect(outcome.defeated).toHaveLength(2);
      expect(outcome.survivors).toHaveLength(3);
      expect(loot).toBeDefined();
      expect(loot!.gold).toBeGreaterThanOrEqual(0);
      expect(loot!.xp).toBeGreaterThanOrEqual(0);

      // Rencontre levée, compteur mis à jour.
      expect(state.currentEncounter).toBeNull();
      expect(state.activeBattle).toBeNull();
      expect(state.party.defeatedEnemies).toBe(2);
    });

    test("Défaite : pas de butin, rencontre levée", () => {
      const state = makeStateWithEncounter(3);
      const battle = state.startCombat()!;

      // Force une défaite : tous les héros à 0 HP.
      for (const h of battle.combatState.heroes) h.currentHp = 0;
      battle.combatState.checkEnd();

      const { outcome, loot } = state.resolveCombat();
      expect(outcome.result).toBe("defeat");
      expect(loot).toBeUndefined();
      expect(state.currentEncounter).toBeNull();
      expect(state.activeBattle).toBeNull();
      // Pas d'ennemis comptés en cas de défaite.
      expect(state.party.defeatedEnemies).toBe(0);
    });

    test("Fuite : pas de butin, rencontre levée", () => {
      const state = makeStateWithEncounter(3);
      const battle = state.startCombat()!;

      // Force une fuite.
      battle.combatState.result = "fled";

      const { outcome, loot } = state.resolveCombat();
      expect(outcome.result).toBe("fled");
      expect(loot).toBeUndefined();
      expect(state.currentEncounter).toBeNull();
    });
  });

  describe("Défaite : modes de difficulté", () => {
    test("easy : wipe → équipe soignée, renvoyée à la dernière ville", () => {
      const state = makeStateWithEncounter(3);
      state.difficulty = "easy";
      state.setLastHub("ville_test");
      const battle = state.startCombat()!;

      // Force une défaite.
      for (const h of battle.combatState.heroes) h.currentHp = 0;
      battle.combatState.checkEnd();

      const { outcome, defeat } = state.resolveCombat();
      expect(outcome.result).toBe("defeat");
      expect(defeat).toEqual({ mode: "wiped", hubId: "ville_test" });
      expect(state.returnToHubId).toBe("ville_test");
      expect(state.gameOver).toBe(false);

      // L'équipe est soignée et renvoyée au point de départ de la zone.
      for (const m of state.party.members) {
        expect(m.currentHp).toBe(m.maxHp);
        expect(m.currentMp).toBe(m.maxMp);
      }
      expect(state.party.position).toEqual(state.zone.startTile);
      // On peut continuer à explorer.
      expect(state.canMove()).toBe(true);
    });

    test("hard : game over → partie perdue, plus de déplacement", () => {
      const state = makeStateWithEncounter(3);
      state.difficulty = "hard";
      state.setLastHub("ville_test");
      const battle = state.startCombat()!;

      for (const h of battle.combatState.heroes) h.currentHp = 0;
      battle.combatState.checkEnd();

      const { outcome, defeat } = state.resolveCombat();
      expect(outcome.result).toBe("defeat");
      expect(defeat).toEqual({ mode: "gameOver" });
      expect(state.isGameOver()).toBe(true);
      expect(state.returnToHubId).toBeUndefined();

      // Plus aucun déplacement possible.
      const logs = state.takeTurn({ row: 7, col: 8 }, seqRand([0.5]));
      expect(logs.some((l) => l.includes("game over"))).toBe(true);
    });

    test("easy sans ville visitée : wipe sans cible de renvoi", () => {
      const state = makeStateWithEncounter(3);
      state.difficulty = "easy";
      const battle = state.startCombat()!;

      for (const h of battle.combatState.heroes) h.currentHp = 0;
      battle.combatState.checkEnd();

      const { defeat } = state.resolveCombat();
      expect(defeat).toEqual({ mode: "wiped", hubId: undefined });
      expect(state.party.position).toEqual(state.zone.startTile);
    });
  });

  describe("Boucle complète takeTurn → combat → reprise", () => {
    test("Rencontre via takeTurn, combat résolu, puis déplacement possible", () => {
      const state = makeStateWithEncounter(3);
      // On repart de zéro pour tester la vraie boucle.
      const fresh = new ExplorationState(makeParty(3), makeZone());

      // Force une rencontre en forçant le roll à réussir (rand < 0.5 → rencontre).
      const logs = fresh.takeTurn({ row: 7, col: 8 }, seqRand([0.1, 0.1, 0.1]));
      expect(fresh.currentEncounter).not.toBeNull();
      expect(logs.some((l) => l.includes("rencontre"))).toBe(true);

      // Déplacement bloqué pendant le combat.
      const blocked = fresh.takeTurn({ row: 7, col: 9 }, seqRand([0.5]));
      expect(blocked.some((l) => l.includes("pendant un combat"))).toBe(true);

      // Résout le combat (victoire forcée).
      const battle = fresh.startCombat()!;
      for (const e of battle.combatState.enemies) e.currentHp = 0;
      battle.combatState.checkEnd();
      const { outcome } = fresh.resolveCombat();
      expect(outcome.result).toBe("victory");

      // Le déplacement est de nouveau possible.
      expect(fresh.canMove()).toBe(true);
      const after = fresh.takeTurn({ row: 7, col: 9 }, seqRand([0.99]));
      expect(fresh.party.position.col).toBe(9);
      expect(after.some((l) => l.includes("pendant un combat"))).toBe(false);
    });
  });

  describe("CombatService (pont Encounter → BattleManager)", () => {
    test("buildBattle place les héros vivants uniquement", () => {
      const state = makeStateWithEncounter(3);
      // Un héros est KO.
      state.party.members[2].currentHp = 0;

      const battle = CombatService.buildBattle(state.currentEncounter!, state.party);
      expect(battle.combatState.heroes).toHaveLength(2);
      expect(battle.combatState.enemies).toHaveLength(2);
    });
  });
});
