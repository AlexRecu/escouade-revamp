// tests/progression/questPlayable.test.ts
import { QuestSystem } from "../../src/classes/Progression/QuestSystem";
import { QuestFactory } from "../../src/services/factory/QuestFactory";
import { QuestService } from "../../src/services/Progression/QuestService";
import { NPCService } from "../../src/services/Hub/NPCService";
import { HubState } from "../../src/classes/World/HubState";
import { Hub } from "../../src/classes/World/Hub";
import { Party } from "../../src/classes/Exploration/Party";
import { Character } from "../../src/classes/UnitTypes/Character";
import { BlackMage } from "../../src/classes/Jobs/BlackMage";

/**
 * Tests des quêtes **jouables de bout en bout** : PNJ cliquables (talk +
 * retrieve) + récompenses (démon recruté) + étapes goTo (onEnterZone).
 */

function makeSystem(): QuestSystem {
  const system = new QuestSystem();
  for (const q of QuestFactory.createAll("fr")) system.addQuest(q);
  return system;
}

/** Un Démoniste (BlackMage évolué, niv 20 → 1 slot de pacte). */
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

/** Fabrique un HubState de test (ville + équipe + système de quêtes). */
function makeHubState(hubName: string, members: Character[], system: QuestSystem): HubState {
  const hub = new Hub(`Hub_${hubName}`, hubName, { shop: true, inn: true, church: true, questBoard: true });
  const party = new Party("p1", members, { row: 7, col: 7 });
  return new HubState(hub, party, system);
}

describe("NPCService.talkQuestNpc — étapes talk", () => {
  test("parler à un PNJ complète l'étape talk ciblée par son nom", () => {
    const system = makeSystem();
    const demonist = makeDemonist();
    const quest = system.acceptQuest("quest_kidnappeur", [demonist]);
    expect(quest).not.toBeNull();

    const hub = makeHubState("Qual-Mastrech", [demonist], system);
    const logs = NPCService.talkQuestNpc(hub, "Franny", "Ma sœur a disparu...");

    expect(quest!.steps[0].done).toBe(true);
    expect(logs.some((l) => l.includes("Franny"))).toBe(true);
  });

  test("parler à un PNJ complète l'étape talk ciblée par le nom de la ville", () => {
    const system = makeSystem();
    const demonist = makeDemonist();
    const quest = system.acceptQuest("quest_peche_miraculeuse", [demonist]);
    expect(quest).not.toBeNull();

    // L'étape s1 cible « Qual-Chen » (parler aux PNJ de la ville).
    const hub = makeHubState("Qual-Chen", [demonist], system);
    NPCService.talkQuestNpc(hub, "Pêcheur", "Le lac est hanté...");

    expect(quest!.steps[0].done).toBe(true);
  });
});

describe("NPCService.talkQuestNpc — objet de quête (retrieve)", () => {
  test("le PNJ remet l'objet de quête au sac commun et complète l'étape", () => {
    const system = makeSystem();
    const demonist = makeDemonist();
    const quest = system.acceptQuest("quest_peche_miraculeuse", [demonist]);
    const hub = makeHubState("Qual-Chen", [demonist], system);

    const logs = NPCService.talkQuestNpc(hub, "Pêcheur", "Prenez mon embarcation.", "Embarcation");

    // L'objet est dans le sac commun de l'équipe.
    expect(hub.party.bag.some((i) => i.name === "Embarcation")).toBe(true);
    // L'étape retrieve (s2) est complétée.
    expect(quest!.steps[1].done).toBe(true);
    expect(logs.some((l) => l.includes("Embarcation"))).toBe(true);
  });

  test("l'objet n'est remis qu'une seule fois (idempotent)", () => {
    const system = makeSystem();
    const demonist = makeDemonist();
    system.acceptQuest("quest_peche_miraculeuse", [demonist]);
    const hub = makeHubState("Qual-Chen", [demonist], system);

    NPCService.talkQuestNpc(hub, "Pêcheur", "Prenez mon embarcation.", "Embarcation");
    NPCService.talkQuestNpc(hub, "Pêcheur", "Prenez mon embarcation.", "Embarcation");

    const count = hub.party.bag.filter((i) => i.name === "Embarcation").length;
    expect(count).toBe(1);
  });
});

describe("NPCService.talkQuestNpc — récompense (démon recruté)", () => {
  test("compléter une quête recrute le démon de la récompense", () => {
    const system = makeSystem();
    const demonist = makeDemonist();
    const quest = system.acceptQuest("quest_peche_miraculeuse", [demonist]);
    const hub = makeHubState("Qual-Chen", [demonist], system);

    // Étapes 1 + 2 via le PNJ (talk ville + retrieve Embarcation).
    NPCService.talkQuestNpc(hub, "Pêcheur", "Le lac est hanté. Prenez mon embarcation.", "Embarcation");
    // Étape 3 (goTo Lac) : onEnterZone + distribution de la récompense
    // (c'est ce que fait buildSession à l'entrée en donjon).
    const enterProgress = QuestService.onEnterZone(system, "Lac de Qual-Chen");
    QuestService.distributeCompletedRewards(enterProgress, [demonist]);

    // La quête est terminée → la récompense (Mateus) est distribuée.
    expect(quest!.completed).toBe(true);
    const bm = demonist.job as BlackMage;
    expect(bm.recruitedDemons).toContain("Mateus, le Corrompu");
  });
});

describe("QuestService.distributeRewards", () => {
  test("recrute le démon de la récompense via un Démoniste avec slot libre", () => {
    const system = makeSystem();
    const demonist = makeDemonist();
    const quest = system.getQuest("quest_kidnappeur")!;
    quest.accepted = true;
    quest.completed = true;

    const logs = QuestService.distributeRewards(quest, [demonist]);
    const bm = demonist.job as BlackMage;
    expect(bm.recruitedDemons).toContain("Adrammelech, le Grand Courroux");
    expect(logs.some((l) => l.includes("Pacte scellé"))).toBe(true);
  });

  test("sans Démoniste, le pacte est perdu (log explicite)", () => {
    const system = makeSystem();
    const { Warrior } = require("../../src/classes/Jobs/Warrior");
    const warrior = new Character(
      "w1", "Guerrier", "Hero", { row: 7, col: 7 },
      30, 30, [], 12, 12, 10, 10, new Warrior(), null, null
    );
    const quest = system.getQuest("quest_kidnappeur")!;
    quest.accepted = true;
    quest.completed = true;

    const logs = QuestService.distributeRewards(quest, [warrior]);
    expect(logs.some((l) => l.includes("Aucun Démoniste"))).toBe(true);
  });
});

describe("onEnterZone — étape goTo + récompense", () => {
  test("entrer dans la zone complète l'étape goTo et distribue la récompense", () => {
    const system = makeSystem();
    const demonist = makeDemonist();
    const quest = system.acceptQuest("quest_peche_miraculeuse", [demonist]);
    // Étapes 1 + 2 faites.
    QuestService.onTalk(system, "Qual-Chen");
    QuestService.onRetrieve(system, "Embarcation");

    const progress = QuestService.onEnterZone(system, "Lac de Qual-Chen");
    expect(quest!.steps[2].done).toBe(true);
    expect(quest!.completed).toBe(true);
    expect(progress.completedQuests.map((q) => q.id)).toContain("quest_peche_miraculeuse");
  });
});
