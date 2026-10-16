// src/services/factory/QuestFactory.ts
import {
  Quest,
  QuestStep,
  QuestReward,
  QuestAvailability,
  QuestGiver,
  ObjectiveType,
} from "../../classes/Progression/QuestSystem";
import questsData from "../../config/quests_data.json";

/**
 * Fabrique des quêtes à partir des données de `quests_data.json`.
 *
 * Permet d'ajouter / modifier des quêtes sans toucher au code : on édite le
 * JSON, la factory l'interprète. Prévoit le multilangue : chaque champ texte
 * accepte soit une string (mono), soit un objet `{ "fr": "...", "en": "..." }`
 * (résolu selon la langue courante, fallback sur `fr`).
 */

/** Un champ texte : soit une string, soit un objet par langue. */
type LocalizedText = string | Record<string, string>;

/** Langue par défaut (fallback si la langue demandée est absente). */
const DEFAULT_LANG = "fr";

/**
 * Résout un champ texte localisé en une string.
 * - string → renvoyée telle quelle.
 * - objet → `obj[lang]` si présent, sinon `obj[DEFAULT_LANG]`, sinon la 1re valeur.
 */
function resolveText(value: LocalizedText | undefined, lang: string = DEFAULT_LANG): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    if (value[lang]) return value[lang];
    if (value[DEFAULT_LANG]) return value[DEFAULT_LANG];
    const keys = Object.keys(value);
    return keys.length > 0 ? value[keys[0]] : "";
  }
  return "";
}

/** Forme brute d'une entrée du JSON (types souples, validés à la construction). */
interface RawQuest {
  id: string;
  name: LocalizedText;
  giver?: { npc: string; hub: string; dialogue: LocalizedText };
  steps: { id: string; type: ObjectiveType; target?: string; text: LocalizedText }[];
  reward: { demon?: string; gold?: number; xp?: number; text: LocalizedText };
  availability?: QuestAvailability;
}

export class QuestFactory {
  /** Données brutes des quêtes (chargées depuis le JSON). */
  static readonly DATA: RawQuest[] = (questsData as { quests: RawQuest[] }).quests;

  /** Renvoie les données brutes d'une quête par son id. */
  static findData(id: string): RawQuest | undefined {
    return this.DATA.find((q) => q.id === id);
  }

  /**
   * Fabrique une quête à partir de son id (recherche dans le JSON).
   * @param lang langue pour les champs texte localisés (défaut "fr").
   * @returns la quête, ou null si introuvable.
   */
  static create(id: string, lang: string = DEFAULT_LANG): Quest | null {
    const data = this.findData(id);
    if (!data) return null;
    return this.fromData(data, lang);
  }

  /** Fabrique une quête à partir d'une entrée du JSON. */
  static fromData(data: RawQuest, lang: string = DEFAULT_LANG): Quest {
    const steps: QuestStep[] = data.steps.map((s) => ({
      id: s.id,
      type: s.type,
      target: s.target,
      description: resolveText(s.text, lang),
      done: false,
    }));

    const reward: QuestReward = {
      demon: data.reward.demon,
      gold: data.reward.gold,
      xp: data.reward.xp,
      description: resolveText(data.reward.text, lang),
    };

    const giver: QuestGiver | null = data.giver
      ? {
          npc: data.giver.npc,
          hub: data.giver.hub,
          dialogue: resolveText(data.giver.dialogue, lang),
        }
      : null;

    return new Quest(
      data.id,
      resolveText(data.name, lang),
      steps,
      reward,
      data.availability ?? {},
      giver
    );
  }

  /** Fabrique toutes les quêtes du JSON. */
  static createAll(lang: string = DEFAULT_LANG): Quest[] {
    return this.DATA.map((d) => this.fromData(d, lang));
  }
}
