// tests/progression/questFactory.test.ts
import { QuestFactory } from "../../src/services/factory/QuestFactory";
import { createDefaultQuests } from "../../src/classes/Progression/QuestSystem";

describe("QuestFactory — interprétation de quests_data.json", () => {
  test("createAll retourne les 3 quêtes du livret", () => {
    const quests = QuestFactory.createAll();
    expect(quests).toHaveLength(3);
    const ids = quests.map((q) => q.id);
    expect(ids).toEqual([
      "quest_peche_miraculeuse",
      "quest_kidnappeur",
      "quest_voies_seigneur",
    ]);
  });

  test("create(id) fabrique une quête par son id", () => {
    const q = QuestFactory.create("quest_kidnappeur");
    expect(q).not.toBeNull();
    expect(q!.name).toBe("Trouvez le kidnappeur");
    expect(QuestFactory.create("inconnue")).toBeNull();
  });

  test("Le champ giver est interprété (PNJ + ville + dialogue)", () => {
    const q = QuestFactory.create("quest_peche_miraculeuse")!;
    expect(q.giver).not.toBeNull();
    expect(q.giver!.npc).toBe("Pêcheur");
    expect(q.giver!.hub).toBe("Qual-Chen");
    expect(q.giver!.dialogue).toContain("lac");
  });

  test("Les étapes conservent id/type/target et le texte", () => {
    const q = QuestFactory.create("quest_peche_miraculeuse")!;
    expect(q.steps).toHaveLength(3);
    expect(q.steps[0]).toMatchObject({ id: "s1", type: "talk", target: "Qual-Chen", done: false });
    expect(q.steps[2].type).toBe("goTo");
  });

  test("La récompense et la disponibilité sont interprétées", () => {
    const finale = QuestFactory.create("quest_voies_seigneur")!;
    expect(finale.reward.demon).toBe("Ultima, le Grand Séraphin");
    expect(finale.availability.requiresDemons).toEqual([
      "Mateus, le Corrompu",
      "Bélias, le Titan",
      "Adrammelech, le Grand Courroux",
      "Hashmal, le Grand Ordonnateur",
    ]);
  });

  test("createDefaultQuests délègue à la factory (rétro-compatible)", () => {
    const viaFactory = QuestFactory.createAll();
    const viaDefault = createDefaultQuests();
    expect(viaDefault.map((q) => q.id)).toEqual(viaFactory.map((q) => q.id));
    expect(viaDefault[0].name).toBe(viaFactory[0].name);
  });

  describe("Multilangue (champ texte {fr,en})", () => {
    test("Une string est renvoyée telle quelle", () => {
      const q = QuestFactory.create("quest_peche_miraculeuse")!;
      expect(q.name).toBe("Une pêche miraculeuse");
    });

    test("Un objet {fr,en} est résolu selon la langue demandée", () => {
      // fromData accepte une entrée brute : on teste la résolution directement.
      const raw = {
        id: "q_test",
        name: { fr: "Quête FR", en: "Quest EN" },
        giver: { npc: "X", hub: "Y", dialogue: { fr: "Bonjour", en: "Hello" } },
        steps: [{ id: "s1", type: "talk" as const, target: "T", text: { fr: "Parler FR", en: "Talk EN" } }],
        reward: { demon: "D", gold: 0, xp: 0, text: { fr: "Récompense FR", en: "Reward EN" } },
        availability: {},
      };
      const fr = QuestFactory.fromData(raw as any, "fr");
      const en = QuestFactory.fromData(raw as any, "en");
      expect(fr.name).toBe("Quête FR");
      expect(fr.giver!.dialogue).toBe("Bonjour");
      expect(fr.steps[0].description).toBe("Parler FR");
      expect(fr.reward.description).toBe("Récompense FR");

      expect(en.name).toBe("Quest EN");
      expect(en.giver!.dialogue).toBe("Hello");
      expect(en.steps[0].description).toBe("Talk EN");
      expect(en.reward.description).toBe("Reward EN");
    });

    test("Fallback sur fr si la langue demandée est absente", () => {
      const raw = {
        id: "q_test2",
        name: { fr: "Nom FR", de: "Name DE" },
        giver: undefined,
        steps: [{ id: "s1", type: "talk" as const, target: "T", text: "texte simple" }],
        reward: { text: "récompense simple" },
        availability: {},
      };
      const en = QuestFactory.fromData(raw as any, "en"); // "en" absent → fallback fr
      expect(en.name).toBe("Nom FR");
      expect(en.steps[0].description).toBe("texte simple");
      expect(en.reward.description).toBe("récompense simple");
    });
  });
});
