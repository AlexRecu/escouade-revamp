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

  test("La case du démon ne bloque pas la sortie (combat optionnel)", async () => {
    // Garde-fou contre le bug "Bélias devant la sortie" : si le démon est sur
    // le seul chemin de la sortie, le combat devient obligatoire et un
    // one-shot (Combustion, 72 PV) est fatal. `blocksExit` doit renvoyer false.
    const session = await buildTowerSession();
    const levels = session.dungeon.levels;
    const last = levels[levels.length - 1];
    const se = last.specialEncounters.find((s: any) => s.demonName === "Bélias, le Titan")!;
    expect((ExplorationSessionService as any).blocksExit(last, se.position)).toBe(false);
  });

  test("blocksExit détecte une case qui coupe le chemin de la sortie", () => {
    // Grille 1x5 : start(0,0) — (0,1) — (0,2) — (0,3) — end(0,4).
    // La case (0,2) est le SEUL chemin → la supprimer bloque la sortie.
    const zone = {
      tileMap: [[true, true, true, true, true]],
      startTile: { row: 0, col: 0 },
      endTile: { row: 0, col: 4 },
    } as any;
    expect((ExplorationSessionService as any).blocksExit(zone, { row: 0, col: 2 })).toBe(true);
    // La case de départ / la sortie sont considérées comme bloquantes.
    expect((ExplorationSessionService as any).blocksExit(zone, { row: 0, col: 0 })).toBe(true);
    expect((ExplorationSessionService as any).blocksExit(zone, { row: 0, col: 4 })).toBe(true);
  });

  test("blocksExit est false si un chemin de contournement existe", () => {
    // Grille 2x3 : start(0,0) — (0,1) — (0,2) / (1,0) — (1,1) — (1,2)=end.
    // La case (0,1) n'est PAS le seul chemin (on peut passer par la ligne 1).
    const zone = {
      tileMap: [
        [true, true, true],
        [true, true, true],
      ],
      startTile: { row: 0, col: 0 },
      endTile: { row: 1, col: 2 },
    } as any;
    expect((ExplorationSessionService as any).blocksExit(zone, { row: 0, col: 1 })).toBe(false);
  });
});
