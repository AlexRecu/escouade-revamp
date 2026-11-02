// tests/exploration/demonFloor.test.ts
import { Party } from "../../src/classes/Exploration/Party";
import { Character } from "../../src/classes/UnitTypes/Character";
import { Warrior } from "../../src/classes/Jobs/Warrior";
import { QuestSystem } from "../../src/classes/Progression/QuestSystem";
import { ExplorationSessionService } from "../../src/services/dungeon/ExplorationSessionService";

/**
 * Test de régression : le **démon de zone** doit être ancré sur le **dernier
 * étage** du donjon (le défi se joue en fin de donjon, pas à l'entrée), sur une
 * case **praticable** qui n'est ni le point de départ ni la sortie (le combat
 * doit rester optionnel et ne jamais bloquer la sortie).
 *
 * C'est le garde-fou contre le bug "Bélias rencontré dès le 1er étage" : avant
 * le fix, `anchorZoneDemons(levels[0])` plaçait le démon sur le 1er étage.
 */

function makeWarrior(): Character {
  return new Character("w1", "Guerrier", "Hero", { row: 7, col: 7 }, 30, 30, [], 10, 10, 10, 10, new Warrior(), null, null);
}

/** Construit une session de donjon via la méthode privée (flux live). */
async function buildTowerSession(): Promise<any> {
  const party = new Party("p", [makeWarrior()], { row: 7, col: 7 });
  const questSystem = new QuestSystem();
  // `buildSession` est privée : on y accède via un cast pour tester le flux live.
  return (ExplorationSessionService as any).buildSession(party, questSystem, "Dungeon_Tower");
}

describe("Démon de zone — ancrage sur le dernier étage (flux live)", () => {
  test("Bélias est sur le dernier étage, pas sur le 1er", async () => {
    const session = await buildTowerSession();
    const levels = session.dungeon.levels;
    expect(levels.length).toBeGreaterThan(1); // la Tour a plusieurs étages

    // Aucun démon sur le 1er étage.
    expect(levels[0].specialEncounters).toHaveLength(0);

    // Bélias est ancré sur le dernier étage.
    const last = levels[levels.length - 1];
    const se = last.specialEncounters.find((s: any) => s.demonName === "Bélias, le Titan");
    expect(se).toBeDefined();
  });

  test("La case du démon est praticable, ni au départ ni à la sortie", async () => {
    const session = await buildTowerSession();
    const levels = session.dungeon.levels;
    const last = levels[levels.length - 1];
    const se = last.specialEncounters.find((s: any) => s.demonName === "Bélias, le Titan")!;

    const { row, col } = se.position;
    // Praticable.
    expect(last.tileMap[row][col]).toBe(true);
    // Ni point de départ, ni sortie.
    expect(`${row},${col}`).not.toEqual(`${last.startTile.row},${last.startTile.col}`);
    expect(`${row},${col}`).not.toEqual(`${last.endTile.row},${last.endTile.col}`);
  });
});
