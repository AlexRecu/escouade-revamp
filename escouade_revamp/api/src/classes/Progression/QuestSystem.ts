// src/classes/Progression/QuestSystem.ts
import { Character } from "../UnitTypes/Character";
import { QuestFactory } from "../../services/factory/QuestFactory";

/**
 * Squelette du système de quêtes (Phase 2).
 *
 * Modèle : une quête est une suite d'**étapes** (objectifs). Chaque étape a un
 * type d'objectif et une condition de complétion. Quand toutes les étapes sont
 * faites, la quête est terminée et sa récompense est débloquée.
 *
 * NB : le contenu détaillé des étapes (dialogues, objets, positions) sera
 * affiné en Phase 3. Ici on pose la structure et les 3 quêtes du livret.
 */

/** Type d'objectif d'une étape. */
export type ObjectiveType =
  | "talk"        // parler à un PNJ
  | "retrieve"    // récupérer un objet
  | "goTo"        // se rendre à un lieu
  | "defeat"      // vaincre un ennemi
  | "recruit";    // recruter un démon / allié

/** Une étape (objectif) d'une quête. */
export interface QuestStep {
  id: string;
  description: string;
  type: ObjectiveType;
  /** Cible de l'objectif (nom du PNJ, de l'objet, du lieu, de l'ennemi...). */
  target?: string;
  /** true si l'étape est complétée. */
  done: boolean;
}

/** Récompense d'une quête. */
export interface QuestReward {
  /** Nom du démon / allié débloqué (ex. "Mateus, le Corrompu"). */
  demon?: string;
  gold?: number;
  xp?: number;
  description: string;
}

/** Condition de disponibilité d'une quête. */
export interface QuestAvailability {
  /** Exige un membre de l'équipe ayant cette classe (ex. "Démoniste"). */
  requiresJob?: string;
  /** Exige que ces démons soient déjà recrutés. */
  requiresDemons?: string[];
  /** Exige que ces quêtes soient terminées. */
  requiresQuests?: string[];
}

/**
 * Le donneur de quête : le PNJ, la ville où il se trouve et le dialogue qui
 * donne la quête. (Ajout Phase C — permet de lier PNJ/ville/dialogue.)
 */
export interface QuestGiver {
  /** Nom du PNJ qui donne la quête. */
  npc: string;
  /** Ville (hub) où se trouve le PNJ. */
  hub: string;
  /** Dialogue du PNJ qui donne la quête. */
  dialogue: string;
}

/** Une quête. */
export class Quest {
  id: string;
  name: string;
  steps: QuestStep[];
  reward: QuestReward;
  availability: QuestAvailability;
  /** Le PNJ / la ville / le dialogue qui donnent la quête. */
  giver: QuestGiver | null;
  /** true si la quête a été acceptée. */
  accepted: boolean = false;
  /** true si la quête est terminée. */
  completed: boolean = false;

  constructor(
    id: string,
    name: string,
    steps: QuestStep[],
    reward: QuestReward,
    availability: QuestAvailability = {},
    giver: QuestGiver | null = null
  ) {
    this.id = id;
    this.name = name;
    this.steps = steps;
    this.reward = reward;
    this.availability = availability;
    this.giver = giver;
  }

  /** true si toutes les étapes sont complétées. */
  isComplete(): boolean {
    return this.steps.every((s) => s.done);
  }

  /** Marque une étape comme complétée (par son id). */
  completeStep(stepId: string): boolean {
    const step = this.steps.find((s) => s.id === stepId);
    if (!step) return false;
    step.done = true;
    if (this.isComplete()) this.completed = true;
    return true;
  }

  /** Prochaine étape non complétée (ou null si terminée). */
  nextStep(): QuestStep | null {
    return this.steps.find((s) => !s.done) ?? null;
  }
}

/**
 * Système de quêtes : gère la liste des quêtes, leur disponibilité et leur
 * progression.
 */
export class QuestSystem {
  private quests: Quest[] = [];

  /** Ajoute une quête au système. */
  addQuest(quest: Quest): void {
    this.quests.push(quest);
  }

  /** Renvoie toutes les quêtes. */
  allQuests(): Quest[] {
    return this.quests;
  }

  /** Renvoie une quête par son id. */
  getQuest(id: string): Quest | undefined {
    return this.quests.find((q) => q.id === id);
  }

  /**
   * Vérifie si une quête est disponible pour l'équipe courante.
   * @param party Les membres de l'équipe.
   * @param recruitedDemons Les noms des démons déjà recrutés.
   */
  isAvailable(quest: Quest, party: Character[], recruitedDemons: string[] = []): boolean {
    const { requiresJob, requiresDemons, requiresQuests } = quest.availability;

    if (requiresJob) {
      const hasJob = party.some((c) => c.job.name === requiresJob);
      if (!hasJob) return false;
    }

    if (requiresDemons && requiresDemons.length > 0) {
      const allRecruited = requiresDemons.every((d) => recruitedDemons.includes(d));
      if (!allRecruited) return false;
    }

    if (requiresQuests && requiresQuests.length > 0) {
      const allDone = requiresQuests.every((qid) => {
        const q = this.getQuest(qid);
        return q?.completed ?? false;
      });
      if (!allDone) return false;
    }

    return true;
  }

  /** Renvoie les quêtes disponibles (non acceptées) pour l'équipe. */
  availableQuests(party: Character[], recruitedDemons: string[] = []): Quest[] {
    return this.quests.filter(
      (q) => !q.accepted && !q.completed && this.isAvailable(q, party, recruitedDemons)
    );
  }

  /** Accepte une quête (si disponible). */
  acceptQuest(questId: string, party: Character[], recruitedDemons: string[] = []): Quest | null {
    const quest = this.getQuest(questId);
    if (!quest || quest.accepted || quest.completed) return null;
    if (!this.isAvailable(quest, party, recruitedDemons)) return null;
    quest.accepted = true;
    return quest;
  }

  /**
   * Marque une étape comme complétée.
   * @returns La quête (pour vérifier si elle est terminée), ou null.
   */
  completeStep(questId: string, stepId: string): Quest | null {
    const quest = this.getQuest(questId);
    if (!quest || !quest.accepted) return null;
    quest.completeStep(stepId);
    return quest;
  }

  /**
   * Sérialise l'**état** du système de quêtes (round-trip avec `fromSerialized`).
   *
   * On ne sérialise que l'état de progression (acceptée ? terminée ? étapes
   * faites ?) par id de quête : le contenu (nom, PNJ, étapes, récompense,
   * conditions) est statique et reconstruit depuis `quests_data.json` via
   * `createDefaultQuests`.
   */
  toSerialized(): any {
    return {
      quests: this.quests.map((q) => ({
        id: q.id,
        accepted: q.accepted,
        completed: q.completed,
        steps: q.steps.map((s) => ({ id: s.id, done: s.done })),
      })),
    };
  }

  /**
   * Restaure un système de quêtes depuis ses données sérialisées.
   *
   * Recrée les quêtes du livret (`createDefaultQuests`) puis applique l'état
   * sérialisé (acceptée/terminée/étapes). Les quêtes dont l'id est inconnu
   * (ex. quête retirée du JSON) sont ignorées.
   */
  static fromSerialized(data: any, lang: string = "fr"): QuestSystem {
    const system = new QuestSystem();
    for (const quest of createDefaultQuests(lang)) system.addQuest(quest);

    const saved = data?.quests ?? [];
    for (const savedQuest of saved) {
      const quest = system.getQuest(savedQuest.id);
      if (!quest) continue;
      quest.accepted = savedQuest.accepted ?? false;
      quest.completed = savedQuest.completed ?? false;
      for (const savedStep of savedQuest.steps ?? []) {
        const step = quest.steps.find((s) => s.id === savedStep.id);
        if (step) step.done = savedStep.done ?? false;
      }
    }
    return system;
  }
}

/**
 * Fabrique les quêtes du livret depuis `quests_data.json` (via `QuestFactory`).
 *
 * Le contenu (noms, PNJ/ville/dialogue, étapes, récompenses, conditions) vit
 * dans le JSON : on ajoute / modifie une quête en éditant le fichier, sans
 * toucher au code. `lang` permet de résoudre les champs texte localisés
 * (`{fr,en}`), défaut "fr".
 */
export function createDefaultQuests(lang: string = "fr"): Quest[] {
  return QuestFactory.createAll(lang);
}
