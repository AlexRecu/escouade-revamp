// tests/progression/questService.test.ts
import { QuestSystem, Quest } from "../../src/classes/Progression/QuestSystem";
import { QuestFactory } from "../../src/services/factory/QuestFactory";
import { QuestService } from "../../src/services/Progression/QuestService";
import { QuestItemFactory } from "../../src/services/factory/QuestItemFactory";
import { Character } from "../../src/classes/UnitTypes/Character";
import { BlackMage } from "../../src/classes/Jobs/BlackMage";

/**
 * Tests du QuestService (Phase C2b) : détection automatique des étapes,
 * objets de quête, récompenses.
 */

function makeSystem(): QuestSystem {
  const system = new QuestSystem();
  for (const q of QuestFactory.createAll("fr")) system.addQuest(q);
  return system;
}

/** Un Démoniste (BlackMage évolué) pour accepter les quêtes qui l'exigent. */
function makeDemonist(): Character {
  const c = new Character(
    "d1", "Démoniste", "Hero", { row: 7, col: 7 },
    30, 30, [], 12, 12, 10, 10, new BlackMage(), null, null
  );
  c.job.jobLevel = 20;
  c.characterLevel = 20;
  c.evolveJob("Démoniste");
  return c;
}

describe("QuestService — détection des étapes", () => {
  test("onTalk complète l'étape talk correspondante", () => {
    const system = makeSystem();
    const demonist = makeDemonist();
    const quest = system.acceptQuest("quest_kidnappeur", [demonist]);
    expect(quest).not.toBeNull();

    const progress = QuestService.onTalk(system, "Franny");
    expect(progress.completedSteps).toEqual([
      { questId: "quest_kidnappeur", stepId: "s1" }
    ]);
    expect(quest!.steps[0].done).toBe(true);
  });

  test("onTalk ne complète rien si la cible ne correspond pas", () => {
    const system = makeSystem();
    const demonist = makeDemonist();
    system.acceptQuest("quest_kidnappeur", [demonist]);

    const progress = QuestService.onTalk(system, "Alfonso");
    expect(progress.completedSteps).toHaveLength(0);
  });

  test("onEnterZone complète l'étape goTo correspondante", () => {
    const system = makeSystem();
    const demonist = makeDemonist();
    const quest = system.acceptQuest("quest_kidnappeur", [demonist]);
    // On passe l'étape talk d'abord.
    QuestService.onTalk(system, "Franny");

    const progress = QuestService.onEnterZone(system, "Forêt des soupirs");
    expect(progress.completedSteps).toEqual([
      { questId: "quest_kidnappeur", stepId: "s2" }
    ]);
    expect(quest!.steps[1].done).toBe(true);
  });

  test("onDefeat complète l'étape defeat et termine la quête", () => {
    const system = makeSystem();
    const demonist = makeDemonist();
    const quest = system.acceptQuest("quest_kidnappeur", [demonist]);
    QuestService.onTalk(system, "Franny");
    QuestService.onEnterZone(system, "Forêt des soupirs");

    const progress = QuestService.onDefeat(system, "Adrammelech, le Grand Courroux");
    expect(progress.completedSteps).toEqual([
      { questId: "quest_kidnappeur", stepId: "s3" }
    ]);
    expect(quest!.completed).toBe(true);
    expect(progress.completedQuests.map((q) => q.id)).toContain("quest_kidnappeur");
  });

  test("onRecruit complète l'étape recruit", () => {
    const system = makeSystem();
    // Quête avec une étape recruit : on construit une quête ad hoc.
    const { Quest } = require("../../src/classes/Progression/QuestSystem");
    const q = new Quest(
      "q_recruit",
      "Quête de recrutement",
      [{ id: "s1", description: "Recruter Mateus", type: "recruit", target: "Mateus, le Corrompu", done: false }],
      { demon: "Mateus, le Corrompu", description: "Mateus rejoint l'équipe." }
    );
    q.accepted = true;
    system.addQuest(q);

    const progress = QuestService.onRecruit(system, "Mateus, le Corrompu");
    expect(progress.completedSteps).toEqual([{ questId: "q_recruit", stepId: "s1" }]);
    expect(q.completed).toBe(true);
  });

  test("les étapes non acceptées ne sont pas complétées", () => {
    const system = makeSystem();
    // Quête non acceptée.
    const progress = QuestService.onTalk(system, "Franny");
    expect(progress.completedSteps).toHaveLength(0);
  });
});

describe("QuestService — objets de quête", () => {
  test("retrieveQuestItem ajoute l'objet au sac et complète l'étape", () => {
    const system = makeSystem();
    const demonist = makeDemonist();
    const quest = system.acceptQuest("quest_peche_miraculeuse", [demonist]);
    QuestService.onTalk(system, "Qual-Chen");

    const { progress, item } = QuestService.retrieveQuestItem(system, demonist, "Embarcation");
    expect(item).not.toBeNull();
    expect(item!.type).toBe("quest");
    expect(demonist.bag.some((i) => i.name === "Embarcation")).toBe(true);
    expect(progress.completedSteps).toEqual([
      { questId: "quest_peche_miraculeuse", stepId: "s2" }
    ]);
    expect(quest!.steps[1].done).toBe(true);
  });

  test("retrieveQuestItem renvoie null pour un objet inconnu", () => {
    const system = makeSystem();
    const demonist = makeDemonist();
    const { item } = QuestService.retrieveQuestItem(system, demonist, "Objet inconnu");
    expect(item).toBeNull();
  });

  test("QuestItemFactory fabrique les objets du JSON", () => {
    expect(QuestItemFactory.names()).toContain("Embarcation");
    expect(QuestItemFactory.names()).toContain("Clef de voyance");
    const item = QuestItemFactory.create("Clef de voyance");
    expect(item).not.toBeNull();
    expect(item!.type).toBe("quest");
  });
});

describe("QuestService — récompenses", () => {
  test("applyReward distribue l'or et l'XP aux survivants", () => {
    const system = makeSystem();
    const demonist = makeDemonist();
    const { Quest } = require("../../src/classes/Progression/QuestSystem");
    const q = new Quest(
      "q_reward",
      "Quête récompensée",
      [{ id: "s1", description: "Étape", type: "talk", target: "X", done: true }],
      { gold: 100, xp: 50, description: "100 gold et 50 XP." }
    );
    q.accepted = true;
    q.completed = true;
    system.addQuest(q);

    const goldBefore = demonist.gold;
    const xpBefore = demonist.currentXp;
    const result = QuestService.applyReward(q, [demonist]);
    expect(result.gold).toBe(100);
    expect(result.xp).toBe(50);
    expect(demonist.gold).toBe(goldBefore + 100);
    expect(demonist.currentXp).toBe(xpBefore + 50);
  });

  test("applyReward sans or ni XP ne distribue rien", () => {
    const system = makeSystem();
    const demonist = makeDemonist();
    const { Quest } = require("../../src/classes/Progression/QuestSystem");
    const q = new Quest(
      "q_pacte",
      "Quête pacte",
      [{ id: "s1", description: "Étape", type: "recruit", target: "Mateus, le Corrompu", done: true }],
      { demon: "Mateus, le Corrompu", description: "Mateus rejoint l'équipe." }
    );
    q.accepted = true;
    q.completed = true;
    system.addQuest(q);

    const goldBefore = demonist.gold;
    const result = QuestService.applyReward(q, [demonist]);
    expect(result.gold).toBe(0);
    expect(result.xp).toBe(0);
    expect(demonist.gold).toBe(goldBefore);
  });
});
