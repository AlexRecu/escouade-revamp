// tests/hub/hubCity.test.ts
import { Hub } from "../../src/classes/World/Hub";
import { HubState } from "../../src/classes/World/HubState";
import { HubService } from "../../src/services/Hub/HubService";
import { NPCService } from "../../src/services/Hub/NPCService";
import { Party } from "../../src/classes/Exploration/Party";
import { Character } from "../../src/classes/UnitTypes/Character";
import { BlackMage } from "../../src/classes/Jobs/BlackMage";
import { Thief } from "../../src/classes/Jobs/Thief";
import { Warrior } from "../../src/classes/Jobs/Warrior";
import { Item } from "../../src/classes/Items/Item";
import { createDefaultQuests, QuestSystem } from "../../src/classes/Progression/QuestSystem";

/** Fabrique un héros avec un job et un or donnés. */
function makeHero(id: string, job: any, gold: number): Character {
  const c = new Character(id, `Héros ${id}`, "Hero", { row: 0, col: 0 }, 30, 30, [], 10, 10, 10, 10, job, null, null);
  c.gold = gold;
  return c;
}

/** Fabrique une ville avec tous les services + un QuestSystem peuplé.
 *  L'or des membres est migré vers le **pot commun** (`party.gold`). */
function makeHubState(members: Character[]): HubState {
  const party = new Party("party_city", members, { row: 0, col: 0 });
  party.consolidateGold(); // migre l'or par membre vers le pot commun
  const qs = new QuestSystem();
  createDefaultQuests().forEach((q) => qs.addQuest(q));
  const hub = new Hub("hub_city", "Ville Test", { shop: true, inn: true, church: true, questBoard: true });
  return new HubState(hub, party, qs);
}

describe("Évolution Mage Noir → Démoniste (disponibilité des quêtes)", () => {
  test("Un BlackMage niveau 20 évolué en Démoniste débloque les quêtes", () => {
    const bm = new BlackMage();
    const hero = makeHero("h1", bm, 0);
    hero.job.jobLevel = 20;
    hero.characterLevel = 20;

    // Avant évolution : job "Mage Noir", quêtes Démoniste indisponibles.
    expect(hero.job.name).toBe("Mage Noir");
    const hub = makeHubState([hero]);
    expect(HubService.questBoard(hub).some((q) => q.id === "quest_peche_miraculeuse")).toBe(false);

    // Évolution en Démoniste.
    hero.evolveJob("Démoniste");
    expect(hero.job.name).toBe("Démoniste");

    // Après évolution : les quêtes Démoniste sont disponibles.
    const available = HubService.questBoard(hub);
    expect(available.some((q) => q.id === "quest_peche_miraculeuse")).toBe(true);
    expect(available.some((q) => q.id === "quest_kidnappeur")).toBe(true);
  });

  test("Évolution refusée si niveau insuffisant", () => {
    const bm = new BlackMage();
    const hero = makeHero("h1", bm, 0);
    hero.job.jobLevel = 10;
    expect(() => hero.evolveJob("Démoniste")).toThrow(/niveau requis/);
  });

  test("Double évolution refusée", () => {
    const bm = new BlackMage();
    const hero = makeHero("h1", bm, 0);
    hero.job.jobLevel = 20;
    hero.evolveJob("Démoniste");
    expect(() => hero.evolveJob("Sage Noir")).toThrow(/déjà évolué/);
  });
});

describe("NPCService — Résidences PNJ", () => {
  test("Alfonso donne des infos sur les classes hautes", () => {
    const hub = makeHubState([makeHero("h1", new Warrior(), 0)]);
    const logs = NPCService.talkToResident(hub, "Alfonso");
    expect(logs[0]).toContain("classes hautes");
  });

  test("Franny parle de sa sœur (Adrammelech)", () => {
    const hub = makeHubState([makeHero("h1", new Warrior(), 0)]);
    const logs = NPCService.talkToResident(hub, "Franny");
    expect(logs[0]).toContain("sœur");
  });

  test("Résident inconnu → message d'erreur", () => {
    const hub = makeHubState([makeHero("h1", new Warrior(), 0)]);
    const logs = NPCService.talkToResident(hub, "Inconnu");
    expect(logs[0]).toContain("pas un résident");
  });
});

describe("NPCService — Guilde des voleurs", () => {
  test("Accès avec Voleur + pièce marquée + roll ≥ 11", () => {
    const thief = makeHero("t1", new Thief(), 0);
    thief.bag.push(new Item("piece", "Pièce marquée", "consumable", "", 0, 0));
    const hub = makeHubState([thief]);
    const { granted } = NPCService.thievesGuildAccess(hub, 12);
    expect(granted).toBe(true);
  });

  test("Accès refusé sans pièce ni charisme", () => {
    const thief = makeHero("t1", new Thief(), 0);
    const hub = makeHubState([thief]);
    const { granted } = NPCService.thievesGuildAccess(hub, 12);
    expect(granted).toBe(false);
  });

  test("Accès refusé si roll < 11 (même avec pièce)", () => {
    const thief = makeHero("t1", new Thief(), 0);
    thief.bag.push(new Item("piece", "Pièce marquée", "consumable", "", 0, 0));
    const hub = makeHubState([thief]);
    const { granted } = NPCService.thievesGuildAccess(hub, 5);
    expect(granted).toBe(false);
  });

  test("Accès avec Charisme ≥ 5 + roll ≥ 11", () => {
    const hero = makeHero("h1", new Warrior(), 0);
    hero.stats.charisma = 5;
    const hub = makeHubState([hero]);
    const { granted } = NPCService.thievesGuildAccess(hub, 11);
    expect(granted).toBe(true);
  });
});

describe("NPCService — Voyante", () => {
  test("Consultation : déduit l'or et donne une indication", () => {
    const hero = makeHero("h1", new Warrior(), 50);
    const hub = makeHubState([hero]);
    const logs = NPCService.consultSeer(hub, hero);
    expect(hub.party.gold).toBe(40);
    expect(logs[0]).toContain("voyante");
  });

  test("Refusée si or insuffisant", () => {
    const hero = makeHero("h1", new Warrior(), 5);
    const hub = makeHubState([hero]);
    const logs = NPCService.consultSeer(hub, hero);
    expect(hub.party.gold).toBe(5);
    expect(logs[0]).toContain("pas assez d'or");
  });
});

describe("HubService — Location de PNJ", () => {
  test("Location classe basse : PNJ rejoint l'équipe", () => {
    const hero = makeHero("h1", new Warrior(), 200);
    const hub = makeHubState([hero]);
    const before = hub.party.members.length;
    const { npc, logs } = HubService.hireNPC(hub, hero, "low", "Guerrier");
    expect(npc).not.toBeNull();
    expect(hub.party.members.length).toBe(before + 1);
    expect(hub.party.gold).toBe(100);
    expect(logs.some((l) => l.includes("rejoint"))).toBe(true);
  });

  test("Location haute classe : coût 200 gold", () => {
    const hero = makeHero("h1", new Warrior(), 300);
    const hub = makeHubState([hero]);
    const { npc } = HubService.hireNPC(hub, hero, "high", "Mage blanc");
    expect(npc).not.toBeNull();
    expect(hub.party.gold).toBe(100);
  });

  test("Job non disponible pour le tier → refus", () => {
    const hero = makeHero("h1", new Warrior(), 300);
    const hub = makeHubState([hero]);
    const { npc } = HubService.hireNPC(hub, hero, "low", "Mage blanc");
    expect(npc).toBeNull();
    expect(hub.party.gold).toBe(300);
  });
});

describe("HubService — Vol aux marchands", () => {
  test("Vol réussi (Voleur, roll ≥ 11) : or gagné", () => {
    const thief = makeHero("t1", new Thief(), 0);
    const hub = makeHubState([thief]);
    const logs = HubService.attemptSteal(hub, thief, 12);
    expect(hub.party.gold).toBe(50);
    expect(logs.some((l) => l.includes("vole"))).toBe(true);
  });

  test("Vol échoué (roll < 11) : rien", () => {
    const thief = makeHero("t1", new Thief(), 0);
    const hub = makeHubState([thief]);
    HubService.attemptSteal(hub, thief, 3);
    expect(hub.party.gold).toBe(0);
  });

  test("Vol refusé si pas un Voleur", () => {
    const hero = makeHero("h1", new Warrior(), 0);
    const hub = makeHubState([hero]);
    const logs = HubService.attemptSteal(hub, hero, 12);
    expect(logs.some((l) => l.includes("pas un Voleur"))).toBe(true);
  });
});

describe("HubService — Caravane", () => {
  test("Voyage tranquille (roll 5-6)", () => {
    const hero = makeHero("h1", new Warrior(), 100);
    const hub = makeHubState([hero]);
    const { success, threat } = HubService.takeCaravan(hub, hero, "ville_dest", 6);
    expect(success).toBe(true);
    expect(threat).toBe("none");
    expect(hub.party.gold).toBe(80);
  });

  test("Attaque de gobelins (roll 2-3)", () => {
    const hero = makeHero("h1", new Warrior(), 100);
    const hub = makeHubState([hero]);
    const { threat } = HubService.takeCaravan(hub, hero, "ville_dest", 2);
    expect(threat).toBe("goblins");
  });

  test("Attaque de brûleur (roll 1)", () => {
    const hero = makeHero("h1", new Warrior(), 100);
    const hub = makeHubState([hero]);
    const { threat } = HubService.takeCaravan(hub, hero, "ville_dest", 1);
    expect(threat).toBe("burner");
  });

  test("Refusée si or insuffisant", () => {
    const hero = makeHero("h1", new Warrior(), 10);
    const hub = makeHubState([hero]);
    const { success } = HubService.takeCaravan(hub, hero, "ville_dest", 6);
    expect(success).toBe(false);
    expect(hub.party.gold).toBe(10);
  });
});
