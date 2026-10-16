// src/classes/Progression/LootEngine.ts
import { Character } from "../UnitTypes/Character";
import { Monster } from "../UnitTypes/Monster";
import { Statistics, Difficulty } from "../Types";
import levelData from "../../config/level_data.json";

/**
 * Résultat de la distribution d'un butin.
 */
export interface LootResult {
  gold: number;
  xp: number;
  logs: string[];
  /** Les montées de niveau obtenues (personnage + stat choisie). */
  levelUps: { character: Character; stat: keyof Statistics }[];
}

/**
 * Moteur de butin (Phase 2).
 *
 * Règle du livret : le butin d'un combat est **Gold + XP seulement** (pas
 * d'items). Il est distribué aux **survivants** de l'équipe.
 *
 * - Gold et XP sont partagés à parts égales entre les survivants (le reste
 *   revient au premier survivant).
 * - À chaque montée de niveau, le personnage gagne **+1 stat au choix**
 *   (le choix est fourni par le callback `statChoices`, qui représente la
 *   décision du joueur).
 */
/** Multiplicateur de butin en mode hard (récompense plus généreuse). */
const HARD_LOOT_MULTIPLIER = 1.5;

export class LootEngine {
  /**
   * Calcule le butin brut d'un combat (somme du gold et de l'XP des monstres vaincus),
   * ajusté à la difficulté. En mode hard, le butin est augmenté.
   */
  static computeLoot(defeated: Monster[], difficulty: Difficulty = "easy"): { gold: number; xp: number } {
    let gold = defeated.reduce((s, m) => s + (m.gold ?? 0), 0);
    let xp = defeated.reduce((s, m) => s + (m.xp ?? 0), 0);
    if (difficulty === "hard") {
      gold = Math.round(gold * HARD_LOOT_MULTIPLIER);
      xp = Math.round(xp * HARD_LOOT_MULTIPLIER);
    }
    return { gold, xp };
  }

  /**
   * Distribue le butin aux survivants et gère les montées de niveau.
   * @param survivors Les membres de l'équipe (les morts sont ignorés).
   * @param defeated Les monstres vaincus (source du gold et de l'XP).
   * @param statChoices Callback qui, pour chaque montée de niveau, retourne la
   *                    stat à augmenter (la décision du joueur).
   */
  static distributeLoot(
    survivors: Character[],
    defeated: Monster[],
    statChoices: (character: Character) => keyof Statistics,
    difficulty: Difficulty = "easy"
  ): LootResult {
    const logs: string[] = [];
    const levelUps: LootResult["levelUps"] = [];
    const alive = survivors.filter((c) => !c.isDead());

    if (alive.length === 0) {
      return { gold: 0, xp: 0, logs: ["Aucun survivant pour récupérer le butin."], levelUps };
    }

    const { gold, xp } = this.computeLoot(defeated, difficulty);
    const shareGold = Math.floor(gold / alive.length);
    const shareXp = Math.floor(xp / alive.length);
    const goldRemainder = gold - shareGold * alive.length;
    const xpRemainder = xp - shareXp * alive.length;

    alive.forEach((c, i) => {
      const g = shareGold + (i === 0 ? goldRemainder : 0);
      const x = shareXp + (i === 0 ? xpRemainder : 0);
      c.gold += g;
      logs.push(`${c.name} récupère ${g} gold et ${x} XP.`);
      this.applyXp(c, x, statChoices, logs, levelUps);
    });

    return { gold, xp, logs, levelUps };
  }

  /**
   * Applique l'XP à un personnage et gère les montées de niveau en cascade.
   * À chaque montée : +1 stat au choix (via `statChoices`).
   *
   * Publique : réutilisé par le moteur de loot (butin de combat) et par les
   * récompenses de quête (`QuestService.applyReward`).
   * @returns Le nombre de montées de niveau obtenues.
   */
  static applyXp(
    character: Character,
    xp: number,
    statChoices: (character: Character) => keyof Statistics,
    logs: string[],
    levelUps: LootResult["levelUps"]
  ): number {
    character.currentXp += xp;
    let count = 0;
    const maxLevel = levelData.length;

    while (character.characterLevel < maxLevel) {
      const needed = levelData[character.characterLevel - 1].xp;
      if (character.currentXp < needed) break;
      character.currentXp -= needed;
      character.characterLevel += 1;
      // Le niveau de classe suit le niveau du personnage : c'est lui qui
      // débloque les compétences/sorts/pactes et l'évolution (niveau 20).
      character.job.jobLevel += 1;
      count++;
      const stat = statChoices(character);
      character.stats[stat] += 1;
      levelUps.push({ character, stat });
      logs.push(`${character.name} monte au niveau ${character.characterLevel} et gagne +1 ${stat} !`);
    }

    return count;
  }
}
