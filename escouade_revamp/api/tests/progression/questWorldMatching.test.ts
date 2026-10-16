// tests/progression/questWorldMatching.test.ts
import { WorldLoader } from "../../src/services/factory/WorldLoader";
import { QuestFactory } from "../../src/services/factory/QuestFactory";
import { Hub } from "../../src/classes/World/Hub";
import { Dungeon } from "../../src/classes/World/Dungeon";

/**
 * Vérifie que les lieux cités par les quêtes (giver.hub + cibles goTo)
 * correspondent à de vrais lieux du monde (hubs + zones de donjon).
 *
 * C'est le garde-fou "matching" demandé avant la Phase C2 : si une quête
 * pointe vers un lieu inexistant, ce test échoue.
 */
describe("Matching quêtes ↔ monde", () => {
  let hubNames: Set<string>;
  let zoneNames: Set<string>;

  beforeAll(async () => {
    const world = await WorldLoader.generate(12345);
    hubNames = new Set<string>();
    zoneNames = new Set<string>();
    for (const node of world.nodes) {
      if (node instanceof Hub) {
        hubNames.add(node.name);
      } else if (node instanceof Dungeon) {
        // Le nom du donjon + le nom de chaque niveau (zone).
        zoneNames.add(node.name);
        node.levels.forEach((z) => zoneNames.add(z.name));
      }
    }
  });

  test("Le monde contient les hubs attendus", () => {
    expect(hubNames).toContain("Qual-Chen");
    expect(hubNames).toContain("Qual-Mastrech");
  });

  test("Le monde contient le lac (zone dédiée)", () => {
    expect(zoneNames).toContain("Lac de Qual-Chen");
  });

  test("Chaque giver.hub des quêtes est une vraie ville", () => {
    for (const quest of QuestFactory.createAll()) {
      if (quest.giver) {
        expect(hubNames.has(quest.giver.hub)).toBe(true);
      }
    }
  });

  test("Chaque cible goTo des quêtes est une vraie zone", () => {
    for (const quest of QuestFactory.createAll()) {
      for (const step of quest.steps) {
        if (step.type === "goTo" && step.target) {
          expect(zoneNames.has(step.target)).toBe(true);
        }
      }
    }
  });

  test("Le lac a 5 tuiles de pêche en croix", async () => {
    const w = await WorldLoader.generate(12345);
    const lake = w.nodes.find(
      (n) => n instanceof Dungeon && n.name === "Lac de Qual-Chen"
    ) as Dungeon | undefined;
    expect(lake).toBeDefined();
    const zone = lake!.levels[0];
    expect(zone.fishingTiles).toHaveLength(5);
    // Les 5 tuiles forment une croix : une centrale + 4 orthogonales.
    const center = zone.fishingTiles[0];
    const others = zone.fishingTiles.slice(1);
    const deltas = others.map((t) => ({ dr: t.row - center.row, dc: t.col - center.col }));
    expect(deltas).toEqual(
      expect.arrayContaining([
        { dr: -1, dc: 0 },
        { dr: 1, dc: 0 },
        { dr: 0, dc: -1 },
        { dr: 0, dc: 1 },
      ])
    );
  });
});
