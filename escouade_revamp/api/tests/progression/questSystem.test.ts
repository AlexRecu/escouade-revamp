import { QuestSystem, Quest, createDefaultQuests } from "../../src/classes/Progression/QuestSystem";
import { Character } from "../../src/classes/UnitTypes/Character";
import { BlackMage } from "../../src/classes/Jobs/BlackMage";
import { Warrior } from "../../src/classes/Jobs/Warrior";

/** Fabrique un Démoniste (BlackMage évolué). */
function makeDemonist(id: string): Character {
  const c = new Character(id, "Démoniste", "Hero", { row: 0, col: 0 }, 30, 30, [], 12, 12, 10, 10, new BlackMage(), null, null);
  c.job.jobLevel = 20;
  c.evolveJob("Démoniste");
  return c;
}

/** Fabrique un Guerrier (pas de Démoniste). */
function makeWarrior(id: string): Character {
  return new Character(id, "Guerrier", "Hero", { row: 0, col: 0 }, 30, 30, [], 10, 10, 10, 10, new Warrior(), null, null);
}

describe("QuestSystem (squelette Phase 2)", () => {

  describe("createDefaultQuests", () => {
    test("Retourne les 3 quêtes du livret", () => {
      const quests = createDefaultQuests();
      expect(quests.length).toBe(3);
      const names = quests.map((q) => q.name);
      expect(names).toContain("Une pêche miraculeuse");
      expect(names).toContain("Trouvez le kidnappeur");
      expect(names).toContain("Les voies du seigneur sont impénétrables");
    });
  });

  describe("Disponibilité", () => {
    test("Quête Démoniste : disponible avec un Démoniste, pas sans", () => {
      const system = new QuestSystem();
      createDefaultQuests().forEach((q) => system.addQuest(q));
      const peche = system.getQuest("quest_peche_miraculeuse")!;

      expect(system.isAvailable(peche, [makeDemonist("d1")])).toBe(true);
      expect(system.isAvailable(peche, [makeWarrior("w1")])).toBe(false);
    });

    test("Quête finale : exige les 4 démons recrutés", () => {
      const system = new QuestSystem();
      createDefaultQuests().forEach((q) => system.addQuest(q));
      const finale = system.getQuest("quest_voies_seigneur")!;
      const demonist = [makeDemonist("d1")];

      expect(system.isAvailable(finale, demonist, [])).toBe(false);
      expect(system.isAvailable(finale, demonist, ["Mateus, le Corrompu"])).toBe(false);
      expect(
        system.isAvailable(finale, demonist, ["Mateus, le Corrompu", "Adrammelech, le Grand Courroux"])
      ).toBe(false);
      expect(
        system.isAvailable(finale, demonist, [
          "Mateus, le Corrompu",
          "Bélias, le Titan",
          "Adrammelech, le Grand Courroux",
          "Hashmal, le Grand Ordonnateur",
        ])
      ).toBe(true);
    });
  });

  describe("acceptQuest + progression", () => {
    test("Accepter une quête disponible", () => {
      const system = new QuestSystem();
      createDefaultQuests().forEach((q) => system.addQuest(q));
      const quest = system.acceptQuest("quest_peche_miraculeuse", [makeDemonist("d1")]);
      expect(quest).not.toBeNull();
      expect(quest!.accepted).toBe(true);
    });

    test("Impossible d'accepter une quête non disponible", () => {
      const system = new QuestSystem();
      createDefaultQuests().forEach((q) => system.addQuest(q));
      const quest = system.acceptQuest("quest_peche_miraculeuse", [makeWarrior("w1")]);
      expect(quest).toBeNull();
    });

    test("Compléter les étapes → quête terminée", () => {
      const system = new QuestSystem();
      createDefaultQuests().forEach((q) => system.addQuest(q));
      system.acceptQuest("quest_peche_miraculeuse", [makeDemonist("d1")]);

      const q = system.getQuest("quest_peche_miraculeuse")!;
      expect(q.completed).toBe(false);
      expect(q.nextStep()!.id).toBe("s1");

      system.completeStep("quest_peche_miraculeuse", "s1");
      expect(q.nextStep()!.id).toBe("s2");
      system.completeStep("quest_peche_miraculeuse", "s2");
      system.completeStep("quest_peche_miraculeuse", "s3");
      expect(q.completed).toBe(true);
      expect(q.nextStep()).toBeNull();
    });

    test("La récompense est bien le démon attendu", () => {
      const system = new QuestSystem();
      createDefaultQuests().forEach((q) => system.addQuest(q));
      const q = system.getQuest("quest_peche_miraculeuse")!;
      expect(q.reward.demon).toBe("Mateus, le Corrompu");
    });
  });
});
