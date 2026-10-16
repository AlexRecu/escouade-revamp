// tests/hub/hubService.test.ts
import { Hub } from "../../src/classes/World/Hub";
import { HubState } from "../../src/classes/World/HubState";
import { HubService } from "../../src/services/Hub/HubService";
import { ItemFactory } from "../../src/services/factory/ItemFactory";
import { Party } from "../../src/classes/Exploration/Party";
import { Character } from "../../src/classes/UnitTypes/Character";
import { Warrior } from "../../src/classes/Jobs/Warrior";
import { Consumable } from "../../src/classes/Items/Consumable";
import { createDefaultQuests, QuestSystem } from "../../src/classes/Progression/QuestSystem";

/** Fabrique un héros Guerrier avec un or donné. */
function makeHero(id: string, gold: number): Character {
  const c = new Character(id, `Héros ${id}`, "Hero", { row: 0, col: 0 }, 30, 30, [], 10, 10, 10, 10, new Warrior(), null, null);
  c.gold = gold;
  return c;
}

/** Fabrique une ville avec tous les services. L'or est dans le **pot commun** (`party.gold`). */
function makeHubState(gold: number, services?: Partial<Hub["services"]>): { hub: HubState; hero: Character } {
  const hero = makeHero("h1", 0);
  const party = new Party("party_hub", [hero], { row: 0, col: 0 });
  party.gold = gold; // pot commun
  const hub = new Hub("hub_test", "Ville Test", {
    shop: true,
    inn: true,
    church: true,
    questBoard: true,
    ...services,
  });
  return { hub: new HubState(hub, party), hero };
}

describe("ItemFactory (fabrication depuis all_items.json)", () => {
  test("Crée un consommable Potion (5 PV)", () => {
    const item = ItemFactory.create("Potion");
    expect(item).toBeInstanceOf(Consumable);
    expect((item as Consumable).hp).toBe(5);
    expect((item as Consumable).purchasePrice).toBe(60);
  });

  test("Crée Potion+ (moitié des PV max)", () => {
    const item = ItemFactory.create("Potion+") as Consumable;
    expect(item.hpPercent).toBe(0.5);
  });

  test("Crée Potion X (soin total)", () => {
    const item = ItemFactory.create("Potion X") as Consumable;
    expect(item.fullHeal).toBe(true);
  });

  test("Crée Éther (3 MP)", () => {
    const item = ItemFactory.create("Éther") as Consumable;
    expect(item.mp).toBe(3);
  });

  test("Crée Queue de phénix (ranime à moitié)", () => {
    const item = ItemFactory.create("Queue de phénix") as Consumable;
    expect(item.revive).toBe(true);
    expect(item.hpPercent).toBe(0.5);
  });

  test("Retourne null pour un nom inconnu", () => {
    expect(ItemFactory.create("Objet Inexistant")).toBeNull();
  });

  test("namesByType liste les consommables", () => {
    const names = ItemFactory.namesByType("Consommable");
    expect(names).toContain("Potion");
    expect(names).toContain("Élixir");
  });
});

describe("HubService — Marchand", () => {
  test("Achat réussi : or déduit du pot commun, objet au sac", () => {
    const { hub, hero } = makeHubState(100);
    const logs = HubService.buyConsumable(hub, hero, "Potion");
    expect(hub.party.gold).toBe(40);
    expect(hero.bag).toHaveLength(1);
    expect(hero.bag[0]).toBeInstanceOf(Consumable);
    expect(logs.some((l) => l.includes("achète"))).toBe(true);
  });

  test("Achat refusé : or insuffisant", () => {
    const { hub, hero } = makeHubState(10);
    HubService.buyConsumable(hub, hero, "Potion");
    expect(hub.party.gold).toBe(10);
    expect(hero.bag).toHaveLength(0);
  });

  test("Achat refusé : pas de marchand", () => {
    const { hub, hero } = makeHubState(100, { shop: false });
    const logs = HubService.buyConsumable(hub, hero, "Potion");
    expect(logs.some((l) => l.includes("pas de marchand"))).toBe(true);
    expect(hero.bag).toHaveLength(0);
  });

  test("Revente : prix/2 par défaut", () => {
    const { hub, hero } = makeHubState(0);
    hero.bag.push(ItemFactory.create("Potion")!);
    hero.stats.charisma = 1;
    const item = hero.bag[0];
    HubService.sellItem(hub, hero, item);
    expect(hero.bag).toHaveLength(0);
    expect(hub.party.gold).toBe(30); // 60/2
  });

  test("Revente : Charisme >= 6 → prix d'achat", () => {
    const { hub, hero } = makeHubState(0);
    hero.bag.push(ItemFactory.create("Potion")!);
    hero.stats.charisma = 6;
    HubService.sellItem(hub, hero, hero.bag[0]);
    expect(hub.party.gold).toBe(60);
  });

  test("Revente : Charisme = 10 → 1,5× le prix d'achat", () => {
    const { hub, hero } = makeHubState(0);
    hero.bag.push(ItemFactory.create("Potion")!);
    hero.stats.charisma = 10;
    HubService.sellItem(hub, hero, hero.bag[0]);
    expect(hub.party.gold).toBe(90); // 60 * 1.5
  });
});

describe("HubService — Auberge", () => {
  test("Nuit : soin complet, or déduit", () => {
    const { hub, hero } = makeHubState(50);
    hero.currentHp = 5;
    hero.currentMp = 2;
    HubService.restAtInn(hub, hero);
    expect(hero.currentHp).toBe(hero.maxHp);
    expect(hero.currentMp).toBe(hero.maxMp);
    expect(hub.party.gold).toBe(30);
    expect(hub.nightsStayed).toBe(1);
  });

  test("Nuit refusée : or insuffisant", () => {
    const { hub, hero } = makeHubState(10);
    HubService.restAtInn(hub, hero);
    expect(hub.party.gold).toBe(10);
    expect(hub.nightsStayed).toBe(0);
  });
});

describe("HubService — Sanctuaire", () => {
  test("Ranime un allié mort à la moitié des PV max", () => {
    const { hub, hero } = makeHubState(300);
    const dead = makeHero("h2", 0);
    dead.currentHp = 0;
    const logs = HubService.useSanctuary(hub, hero, dead);
    expect(dead.currentHp).toBe(Math.floor(dead.maxHp / 2));
    expect(hub.party.gold).toBe(100);
    expect(logs.some((l) => l.includes("ranime"))).toBe(true);
  });

  test("Refusé si la cible n'est pas morte", () => {
    const { hub, hero } = makeHubState(300);
    const alive = makeHero("h2", 0);
    const logs = HubService.useSanctuary(hub, hero, alive);
    expect(logs.some((l) => l.includes("pas mort"))).toBe(true);
    expect(hub.party.gold).toBe(300);
  });
});

describe("HubService — Tableau des quêtes", () => {
  test("Liste les quêtes disponibles (Démoniste requis)", () => {
    const hero = makeHero("h1", 0);
    hero.job.name = "Démoniste";
    const party = new Party("party_q", [hero], { row: 0, col: 0 });
    const qs = new QuestSystem();
    createDefaultQuests().forEach((q) => qs.addQuest(q));
    const hub = new HubState(new Hub("hub_q", "Ville", { shop: true, inn: true, church: true, questBoard: true }), party, qs);

    const available = HubService.questBoard(hub);
    // Les 2 quêtes Démoniste sont disponibles, pas celle qui exige les démons.
    expect(available.some((q) => q.id === "quest_peche_miraculeuse")).toBe(true);
    expect(available.some((q) => q.id === "quest_kidnappeur")).toBe(true);
    expect(available.some((q) => q.id === "quest_voies_seigneur")).toBe(false);
  });

  test("Accepte une quête disponible", () => {
    const hero = makeHero("h1", 0);
    hero.job.name = "Démoniste";
    const party = new Party("party_q2", [hero], { row: 0, col: 0 });
    const qs = new QuestSystem();
    createDefaultQuests().forEach((q) => qs.addQuest(q));
    const hub = new HubState(new Hub("hub_q2", "Ville", { shop: true, inn: true, church: true, questBoard: true }), party, qs);

    const quest = HubService.acceptQuest(hub, "quest_peche_miraculeuse");
    expect(quest).not.toBeNull();
    expect(quest!.accepted).toBe(true);
  });

  test("Aucune quête sans tableau", () => {
    const { hub } = makeHubState(0, { questBoard: false });
    expect(HubService.questBoard(hub)).toHaveLength(0);
  });
});
