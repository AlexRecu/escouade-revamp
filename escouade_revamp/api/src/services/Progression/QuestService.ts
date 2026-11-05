// src/services/Progression/QuestService.ts
import { QuestSystem, Quest } from "../../classes/Progression/QuestSystem";
import { Character } from "../../classes/UnitTypes/Character";
import { Statistics } from "../../classes/Types";
import { LootEngine } from "../../classes/Progression/LootEngine";
import { QuestItemFactory } from "../factory/QuestItemFactory";
import { BlackMage } from "../../classes/Jobs/BlackMage";

/**
 * Service de progression des quêtes (Phase C2b).
 *
 * Le moteur de jeu (exploration, ville, combat) signale des **événements**
 * (parler à un PNJ, entrer dans une zone, récupérer un objet, vaincre un
 * ennemi, recruter un démon). Le service parcourt les quêtes **acceptées** et
 * marque comme complétées les étapes correspondantes. Quand toutes les étapes
 * d'une quête sont faites, la quête est terminée et sa récompense peut être
 * distribuée.
 *
 * Le matching est par **nom exact** (cible de l'étape = nom du PNJ / de la
 * zone / de l'objet / de l'ennemi / du démon), ce qui repose sur le fait que
 * les cibles du JSON correspondent aux noms réels du monde (vérifié par le
 * test de matching).
 */

/** Ce qui s'est passé lors d'un événement de quête. */
export interface QuestProgress {
  /** Étapes complétées (questId + stepId). */
  completedSteps: { questId: string; stepId: string }[];
  /** Quêtes qui viennent de se terminer (toutes leurs étapes faites). */
  completedQuests: Quest[];
  /** Logs lisibles. */
  logs: string[];
}

export class QuestService {
  /**
   * Parcourt les quêtes acceptées et complète les étapes `talk` dont la cible
   * correspond au PNJ parlé.
   */
  static onTalk(questSystem: QuestSystem, npcName: string): QuestProgress {
    return this.completeSteps(questSystem, "talk", npcName);
  }

  /**
   * Complète les étapes `goTo` dont la cible correspond à la zone entrée.
   */
  static onEnterZone(questSystem: QuestSystem, zoneName: string): QuestProgress {
    return this.completeSteps(questSystem, "goTo", zoneName);
  }

  /**
   * Complète les étapes `retrieve` dont la cible correspond à l'objet récupéré.
   */
  static onRetrieve(questSystem: QuestSystem, itemName: string): QuestProgress {
    return this.completeSteps(questSystem, "retrieve", itemName);
  }

  /**
   * Complète les étapes `defeat` dont la cible correspond à l'ennemi vaincu.
   */
  static onDefeat(questSystem: QuestSystem, enemyName: string): QuestProgress {
    return this.completeSteps(questSystem, "defeat", enemyName);
  }

  /**
   * Complète les étapes `recruit` dont la cible correspond au démon recruté.
   */
  static onRecruit(questSystem: QuestSystem, demonName: string): QuestProgress {
    return this.completeSteps(questSystem, "recruit", demonName);
  }

  /**
   * Récupère un objet de quête : l'ajoute au sac du personnage et signale
   * l'étape `retrieve` correspondante.
   *
   * @param questSystem le système de quêtes.
   * @param character le personnage qui récupère l'objet.
   * @param itemName le nom de l'objet (doit correspondre à la cible de l'étape).
   * @returns la progression + l'objet récupéré (ou null si inconnu).
   */
  static retrieveQuestItem(
    questSystem: QuestSystem,
    character: Character,
    itemName: string
  ): { progress: QuestProgress; item: ReturnType<typeof QuestItemFactory.create> } {
    const item = QuestItemFactory.create(itemName);
    if (item) {
      character.bag.push(item);
    }
    const progress = this.onRetrieve(questSystem, itemName);
    return { progress, item };
  }

  /**
   * Cœur du matching : pour chaque quête acceptée (non terminée), complète les
   * étapes du type donné dont la cible correspond.
   */
  private static completeSteps(
    questSystem: QuestSystem,
    type: string,
    target: string
  ): QuestProgress {
    const progress: QuestProgress = { completedSteps: [], completedQuests: [], logs: [] };
    if (!target) return progress;

    for (const quest of questSystem.allQuests()) {
      if (!quest.accepted || quest.completed) continue;

      const matching = quest.steps.filter(
        (s) => !s.done && s.type === type && s.target === target
      );
      for (const step of matching) {
        const before = quest.completed;
        questSystem.completeStep(quest.id, step.id);
        progress.completedSteps.push({ questId: quest.id, stepId: step.id });
        progress.logs.push(`[${quest.name}] Objectif accompli : ${step.description}`);
        if (!before && quest.completed) {
          progress.completedQuests.push(quest);
          progress.logs.push(`🏆 Quête terminée : ${quest.name} !`);
        }
      }
    }
    return progress;
  }

  /**
   * Distribue la récompense d'une quête terminée (or + XP) aux survivants.
   *
   * Le démon (pacte) est déjà géré par le combat (recrutement) ; ici on ne
   * distribue que l'or et l'XP. Si la récompense n'a ni or ni XP, rien n'est
   * distribué (le pacte est la récompense).
   *
   * @param survivors les membres vivants de l'équipe.
   * @param statChoices choix de stat à la montée de niveau (défaut : force).
   */
  static applyReward(
    quest: Quest,
    survivors: Character[],
    statChoices: (char: Character) => keyof Statistics = () => "strength"
  ): { gold: number; xp: number; logs: string[] } {
    const logs: string[] = [];
    const gold = quest.reward.gold ?? 0;
    const xp = quest.reward.xp ?? 0;

    if (gold === 0 && xp === 0) {
      logs.push(`Récompense : ${quest.reward.description}`);
      return { gold: 0, xp: 0, logs };
    }

    // On réutilise la distribution du butin (partage égal + montée de niveau).
    // `defeated` vide → pas de butin de combat, on injecte or/XP manuellement.
    const alive = survivors.filter((c) => !c.isDead());
    if (alive.length === 0) {
      logs.push("Aucun survivant pour récupérer la récompense.");
      return { gold, xp, logs };
    }

    const shareGold = Math.floor(gold / alive.length);
    const shareXp = Math.floor(xp / alive.length);
    const goldRemainder = gold - shareGold * alive.length;
    const xpRemainder = xp - shareXp * alive.length;

    alive.forEach((c, i) => {
      const g = shareGold + (i === 0 ? goldRemainder : 0);
      const x = shareXp + (i === 0 ? xpRemainder : 0);
      c.gold += g;
      logs.push(`${c.name} reçoit ${g} gold et ${x} XP.`);
      // XP + montée de niveau (cascade) via le moteur de loot.
      if (x > 0) {
        LootEngine.applyXp(c, x, statChoices, logs, []);
      }
    });

    logs.push(`Récompense : ${quest.reward.description}`);
    return { gold, xp, logs };
  }

  /**
   * Distribue la récompense **complète** d'une quête terminée :
   *  - le **démon** (pacte) : un Démoniste de l'équipe avec un slot libre le
   *    recrute (c'est la récompense principale des 3 quêtes du livret) ;
   *  - l'**or + XP** (si la récompense en a) via `applyReward`.
   *
   * Contrairement au recrutement en combat (démon **vaincu**), ici le démon est
   * la **récompense** de la quête (ex. Mateus pour « Une pêche miraculeuse ») :
   * il n'a pas été affronté, il rejoint l'équipe en remerciement.
   *
   * @param quest la quête terminée.
   * @param party les membres de l'équipe (pour trouver le Démoniste + distribuer l'or/XP).
   * @param statChoices choix de stat à la montée de niveau (défaut : force).
   */
  static distributeRewards(
    quest: Quest,
    party: Character[],
    statChoices: (char: Character) => keyof Statistics = () => "strength"
  ): string[] {
    const logs: string[] = [];

    // 1. Le démon (pacte) — recruté par un Démoniste avec un slot libre.
    if (quest.reward.demon) {
      const demonist = party.find(
        (c) => c.job instanceof BlackMage && c.job.name === "Démoniste"
      );
      if (demonist) {
        const bm = demonist.job as BlackMage;
        if (bm.canRecruit()) {
          logs.push(...bm.recruitDemon(quest.reward.demon));
        } else {
          logs.push(`Aucun pacte libre : le pacte de ${quest.reward.demon} est perdu.`);
        }
      } else {
        logs.push(`Aucun Démoniste dans l'équipe : le pacte de ${quest.reward.demon} est perdu.`);
      }
    }

    // 2. L'or + XP (si la récompense en a).
    const { logs: rewardLogs } = this.applyReward(quest, party, statChoices);
    logs.push(...rewardLogs);

    return logs;
  }

  /**
   * Distribue la récompense de **toutes** les quêtes terminées dans une
   * progression (les `completedQuests` renvoyés par `onTalk` / `onEnterZone` /
   * `onRetrieve` / …). C'est le point d'appel unique des call-sites qui
   * déclenchent un événement de quête (parler à un PNJ, entrer dans une zone).
   *
   * NB : le recrutement d'un démon **vaincu en combat** est géré séparément
   * (CombatSessionService) ; ici on ne traite que les récompenses de quête.
   */
  static distributeCompletedRewards(
    progress: QuestProgress,
    party: Character[],
    statChoices: (char: Character) => keyof Statistics = () => "strength"
  ): string[] {
    const logs: string[] = [];
    for (const quest of progress.completedQuests) {
      logs.push(...this.distributeRewards(quest, party, statChoices));
    }
    return logs;
  }
}
