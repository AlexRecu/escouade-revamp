// tests/progression/huntQuest.test.ts
import { HuntQuestService } from "../../src/services/Progression/HuntQuestService";
import { Party } from "../../src/classes/Exploration/Party";
import { Character } from "../../src/classes/UnitTypes/Character";
import { Monster } from "../../src/classes/UnitTypes/Monster";
import { Warrior } from "../../src/classes/Jobs/Warrior";
import { HuntQuest } from "../../src/classes/Types";

/** Un guerrier de test (pour la distribution d'XP). */
function makeWarrior(id: string, name: string): Character {
  return new Character(
    id, name, "Hero", { row: 7, col: 7 },
    30, 30, [], 12, 12, 10, 10, new Warrior(), null, null
  );
}

/** Fabrique un monstre de test (nom + rang + XP). */
function makeMonster(name: string, rank: number, xp: number): Monster {
  return new Monster(
    rank, name, "Enemy", 1, { row: 1, col: 1 }, [], [],
    [1, 2, 3, 4, 5, 6], [10, 20, 30, 40, 50, 60],
    [xp, xp, xp, xp, xp, xp], [0, 0, 0, 0, 0, 0], [], [], [], []
  );
}

/** Fabrique une quête de chasse de test. */
function makeHunt(partial: Partial<HuntQuest> & { family: string; rank: number }): HuntQuest {
  return {
    id: "hunt_test",
    monsters: [],
    totalKills: 50,
    kills: 0,
    xpPerKill: 10,
    milestonesReached: [],
    hubId: "Hub_Test",
    zoneId: "Dungeon_Test",
    completed: false,
    ...partial,
  };
}

describe("HuntQuestService — familles et helpers", () => {
  test("familyOf regroupe les Bombos sous une bannière", () => {
    expect(HuntQuestService.familyOf("Bombo Feu")).toBe("Bombo");
    expect(HuntQuestService.familyOf("Bombo Foudre")).toBe("Bombo");
    expect(HuntQuestService.familyOf("Cendre Bombo")).toBe("Bombo");
  });

  test("familyOf regroupe les Dragons sous une bannière", () => {
    expect(HuntQuestService.familyOf("Dragonnet")).toBe("Dragon");
    expect(HuntQuestService.familyOf("Dragon rouge")).toBe("Dragon");
    expect(HuntQuestService.familyOf("Dragon de glace")).toBe("Dragon");
  });

  test("familyOf : un monstre isolé est sa propre famille", () => {
    expect(HuntQuestService.familyOf("Frelon")).toBe("Frelon");
    expect(HuntQuestService.familyOf("Loup")).toBe("Loup");
  });

  test("rankOf lit le rang depuis le bestiaire", () => {
    expect(HuntQuestService.rankOf("Frelon")).toBe(1);
    expect(HuntQuestService.rankOf("Bombo Feu")).toBe(2);
    expect(HuntQuestService.rankOf("Dragon de glace")).toBe(6);
  });

  test("xpAtLevel lit l'XP du bestiaire selon le niveau", () => {
    // Frelon : xp = [15, 30, 45, 60, 75, 90].
    expect(HuntQuestService.xpAtLevel("Frelon", 1)).toBe(15);
    expect(HuntQuestService.xpAtLevel("Frelon", 3)).toBe(45);
    expect(HuntQuestService.xpAtLevel("Frelon", 6)).toBe(90);
    // Borné à [1, 6].
    expect(HuntQuestService.xpAtLevel("Frelon", 0)).toBe(15);
    expect(HuntQuestService.xpAtLevel("Frelon", 99)).toBe(90);
  });

  test("killsRequiredForRank : linéaire rang 1 → 50, rang 7 → 5", () => {
    expect(HuntQuestService.killsRequiredForRank(1)).toBe(50);
    expect(HuntQuestService.killsRequiredForRank(7)).toBe(5);
    // Borné à [1, 7].
    expect(HuntQuestService.killsRequiredForRank(0)).toBe(50);
    expect(HuntQuestService.killsRequiredForRank(99)).toBe(5);
  });
});

describe("HuntQuestService.recordKills — tracking + paliers", () => {
  test("un kill incrémente le compteur de la quête correspondante", () => {
    const party = new Party("p1", [makeWarrior("w1", "Guerrier")], { row: 7, col: 7 });
    party.huntQuests.push(makeHunt({ family: "Frelon", rank: 1, monsters: ["Frelon"] }));

    HuntQuestService.recordKills(party, [makeMonster("Frelon", 1, 15)]);
    expect(party.huntQuests[0].kills).toBe(1);
  });

  test("les monstres d'une même famille comptent tous (Bombo)", () => {
    const party = new Party("p1", [makeWarrior("w1", "Guerrier")], { row: 7, col: 7 });
    party.huntQuests.push(makeHunt({ family: "Bombo", rank: 2, monsters: ["Bombo Feu", "Bombo Glace"] }));

    HuntQuestService.recordKills(party, [makeMonster("Bombo Feu", 2, 15)]);
    HuntQuestService.recordKills(party, [makeMonster("Bombo Glace", 2, 15)]);
    expect(party.huntQuests[0].kills).toBe(2);
  });

  test("un palier (10%) distribue l'XP à tous les membres", () => {
    const w1 = makeWarrior("w1", "Guerrier");
    const w2 = makeWarrior("w2", "Guerrier2");
    const party = new Party("p1", [w1, w2], { row: 7, col: 7 });
    // totalKills 10 → palier 1 à 1 kill. xpPerKill 10 → 10 XP au palier.
    party.huntQuests.push(makeHunt({ family: "Frelon", rank: 1, monsters: ["Frelon"], totalKills: 10, xpPerKill: 10 }));

    const xpBefore = w1.currentXp;
    const logs = HuntQuestService.recordKills(party, [makeMonster("Frelon", 1, 15)]);
    expect(party.huntQuests[0].milestonesReached).toContain(1);
    expect(w1.currentXp - xpBefore).toBe(10);
    expect(w2.currentXp).toBe(10); // le 2e membre aussi
    expect(logs.some((l) => l.includes("palier 10%"))).toBe(true);
  });

  test("la quête est terminée et retirée quand totalKills est atteint", () => {
    const party = new Party("p1", [makeWarrior("w1", "Guerrier")], { row: 7, col: 7 });
    party.huntQuests.push(makeHunt({ family: "Frelon", rank: 1, monsters: ["Frelon"], totalKills: 2, xpPerKill: 10 }));

    HuntQuestService.recordKills(party, [makeMonster("Frelon", 1, 15)]);
    expect(party.huntQuests[0].completed).toBe(false);
    HuntQuestService.recordKills(party, [makeMonster("Frelon", 1, 15)]);
    // Terminée → retirée de la liste + famille marquée chassée.
    expect(party.huntQuests.length).toBe(0);
    expect(party.huntedFamilies.has("Frelon_1")).toBe(true);
  });

  test("les kills sont plafonnés au totalKills (pas de dépassement)", () => {
    const party = new Party("p1", [makeWarrior("w1", "Guerrier")], { row: 7, col: 7 });
    party.huntQuests.push(makeHunt({ family: "Frelon", rank: 1, monsters: ["Frelon"], totalKills: 2, xpPerKill: 10 }));

    HuntQuestService.recordKills(party, [makeMonster("Frelon", 1, 15), makeMonster("Frelon", 1, 15)]);
    // La quête est terminée (retirée) au 2e kill.
    expect(party.huntQuests.length).toBe(0);
  });
});
