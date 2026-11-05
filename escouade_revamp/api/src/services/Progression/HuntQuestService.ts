// src/services/Progression/HuntQuestService.ts
import { Party } from "../../classes/Exploration/Party";
import { Monster } from "../../classes/UnitTypes/Monster";
import { HuntQuest } from "../../classes/Types";
import { LootEngine } from "../../classes/Progression/LootEngine";
import { WorldService } from "../World/WorldService";
import { Dungeon } from "../../classes/World/Dungeon";
import { getSpawnRatesForZoneType } from "../../utils/RandomUtils";
import { IdGenerator } from "../../utils/IdGeneratorUtils";
import bestiary from "../../config/bestiary_data.json";

/**
 * Quêtes de chasse : chasser un certain nombre de monstres d'une **famille**
 * (monstres de même rang regroupés sous une bannière, ex. tous les Bombos).
 *
 * - Générées à la **découverte d'une ville** : 1 quête par donjon adjacent,
 *   pour un monstre aléatoire dont le rang est dans `[worldLevel, worldLevel+1]`.
 * - Les **kills** sont trackés au fil des combats ; des **paliers** (tous les
 *   10%) distribuent de l'XP à tous les membres.
 * - Une famille (famille + rang) ne peut être chassée qu'**une fois** (toutes
 *   villes confondues) : une fois la quête terminée, aucune autre quête sur
 *   cette famille ne sera proposée.
 */

/**
 * Familles de monstres (groupement par bannière). Les monstres d'une même
 * famille ET d'un même rang sont regroupés sous une seule quête. Les autres
 * monstres sont leur propre famille.
 */
const FAMILIES: Record<string, string[]> = {
  Bombo: ["Bombo Feu", "Bombo Glace", "Bombo Terre", "Bombo Air", "Bombo Foudre", "Cendre Bombo"],
  Dragon: ["Dragonnet", "Dragon squelette", "Dragon rouge", "Dragon bleu", "Dragon de glace"],
};

export class HuntQuestService {
  /** Famille d'un monstre (groupement par bannière). */
  static familyOf(name: string): string {
    for (const [fam, names] of Object.entries(FAMILIES)) {
      if (names.includes(name)) return fam;
    }
    return name;
  }

  /** Rang d'un monstre (depuis le bestiaire). */
  static rankOf(name: string): number {
    return bestiary.find((m) => m.name === name)?.rank ?? 1;
  }

  /** XP d'un monstre à un niveau donné (tableau de 6 valeurs, index 0-5). */
  static xpAtLevel(name: string, level: number): number {
    const m = bestiary.find((b) => b.name === name);
    if (!m) return 0;
    const idx = Math.min(5, Math.max(0, level - 1));
    return m.xp[idx] ?? 0;
  }

  /**
   * Nombre de kills requis selon le rang (linéaire : rang 1 → 50, rang 7 → 5).
   */
  static killsRequiredForRank(rank: number): number {
    const r = Math.min(7, Math.max(1, rank));
    return Math.round(50 - (r - 1) * 7.5);
  }

  /**
   * Génère les quêtes de chasse d'une ville (1 par donjon adjacent).
   *
   * **Idempotent** : ne génère que si la ville n'a pas encore de quêtes de
   * chasse. Appelé à la découverte de la ville (arrivée en ville).
   *
   * @returns Les quêtes générées (vides si aucune famille éligible).
   */
  static async generateForHub(party: Party, hubId: string, worldSeed?: number): Promise<HuntQuest[]> {
    // Idempotent : la ville a déjà des quêtes de chasse.
    if (party.huntQuests.some((q) => q.hubId === hubId)) return [];

    const world = await WorldService.getWorld(worldSeed);
    const adjacent = await WorldService.getAdjacentNodeIds(hubId, worldSeed);
    const dungeons = adjacent
      .map((id) => world.nodes.find((n) => n.id === id))
      .filter((n): n is Dungeon => n instanceof Dungeon && n.biome !== "Lake");

    // Familles déjà proposées (actives ou terminées) : on ne re-propose pas.
    const taken = new Set<string>([
      ...party.huntQuests.map((q) => `${q.family}_${q.rank}`),
      ...party.huntedFamilies,
    ]);

    const minRank = Math.max(1, party.worldLevel);
    const maxRank = party.worldLevel + 1;
    const proposed: HuntQuest[] = [];

    for (const dungeon of dungeons) {
      // Monstres éligibles du biome (rang dans [worldLevel, worldLevel+1]).
      const rates = getSpawnRatesForZoneType(dungeon.biome);
      const eligible = rates
        .map((r) => ({ name: r.monsterName, rank: this.rankOf(r.monsterName) }))
        .filter((m) => m.rank >= minRank && m.rank <= maxRank);
      if (eligible.length === 0) continue;

      // Regrouper par famille (+ rang), en excluant les familles déjà prises.
      const byFamily = new Map<string, { rank: number; names: string[] }>();
      for (const m of eligible) {
        const key = `${this.familyOf(m.name)}_${m.rank}`;
        if (taken.has(key)) continue;
        if (!byFamily.has(key)) byFamily.set(key, { rank: m.rank, names: [] });
        byFamily.get(key)!.names.push(m.name);
      }
      if (byFamily.size === 0) continue;

      // Tirer une famille aléatoire pour ce donjon.
      const keys = Array.from(byFamily.keys());
      const chosenKey = keys[Math.floor(Math.random() * keys.length)];
      const { rank, names } = byFamily.get(chosenKey)!;
      const family = chosenKey.split("_")[0];

      proposed.push({
        id: IdGenerator.generate("Hunt"),
        family,
        rank,
        monsters: names,
        totalKills: this.killsRequiredForRank(rank),
        kills: 0,
        xpPerKill: this.xpAtLevel(names[0], Math.max(1, party.worldLevel)),
        milestonesReached: [],
        hubId,
        zoneId: dungeon.id,
        completed: false,
      });
      taken.add(chosenKey);
    }

    party.huntQuests.push(...proposed);
    return proposed;
  }

  /**
   * Tracke les kills de monstres vaincus et distribue les récompenses de
   * paliers. Appelé à la fin d'un combat (victoire).
   *
   * @param party L'équipe (les kills sont trackés, l'XP distribuée à tous).
   * @param defeated Les monstres vaincus (les démons ne comptent pas).
   * @returns Les logs (paliers atteints, XP distribuée, quête terminée).
   */
  static recordKills(party: Party, defeated: Monster[]): string[] {
    const logs: string[] = [];
    for (const monster of defeated) {
      const fam = this.familyOf(monster.name);
      const rank = this.rankOf(monster.name);
      const quests = party.huntQuests.filter(
        (q) => !q.completed && q.family === fam && q.rank === rank
      );
      for (const quest of quests) {
        quest.kills = Math.min(quest.totalKills, quest.kills + 1);

        // Paliers atteints (tous les 10%).
        for (let i = 1; i <= 10; i++) {
          if (quest.milestonesReached.includes(i)) continue;
          const threshold = Math.ceil((quest.totalKills * i) / 10);
          if (quest.kills < threshold) continue;
          quest.milestonesReached.push(i);
          const prevThreshold = i === 1 ? 0 : Math.ceil((quest.totalKills * (i - 1)) / 10);
          const xp = (threshold - prevThreshold) * quest.xpPerKill;
          logs.push(`🏹 Chasse « ${quest.family} » : palier ${i * 10}% atteint (+${xp} XP).`);
          // L'XP est distribuée à **tous** les membres (vivants et morts).
          for (const member of party.members) {
            LootEngine.applyXp(member, xp, () => "endurance", logs, []);
          }
        }

        // Quête terminée ?
        if (quest.kills >= quest.totalKills && !quest.completed) {
          quest.completed = true;
          party.huntedFamilies.add(`${quest.family}_${quest.rank}`);
          const idx = party.huntQuests.indexOf(quest);
          if (idx !== -1) party.huntQuests.splice(idx, 1);
          logs.push(`🏆 Chasse « ${quest.family} » terminée !`);
        }
      }
    }
    return logs;
  }
}
