// src/services/factory/QuestItemFactory.ts
import { Item } from "../../classes/Items/Item";
import { IdGenerator } from "../../utils/IdGeneratorUtils";
import questItemsData from "../../config/quest-items.json";

/**
 * Fabrique des **objets de quête** (à récupérer, non vendables) à partir de
 * `quest-items.json`.
 *
 * Un objet de quête est un `Item` de type `"quest"` : il ne s'achète pas, il
 * se récupère (étape `retrieve` d'une quête). Sa présence dans le sac de
 * l'équipe complète l'étape correspondante.
 */

interface RawQuestItem {
  name: string;
  description: string;
  quest?: string;
}

export class QuestItemFactory {
  /** Données brutes des objets de quête. */
  static readonly DATA: RawQuestItem[] = (questItemsData as { items: RawQuestItem[] }).items;

  /** Renvoie les données brutes d'un objet de quête par son nom. */
  static findData(name: string): RawQuestItem | undefined {
    return this.DATA.find((d) => d.name === name);
  }

  /** Renvoie les noms de tous les objets de quête. */
  static names(): string[] {
    return this.DATA.map((d) => d.name);
  }

  /**
   * Fabrique un objet de quête à partir de son nom.
   * @returns l'objet (type "quest"), ou null si inconnu.
   */
  static create(name: string): Item | null {
    const data = this.findData(name);
    if (!data) return null;
    return new Item(
      IdGenerator.generate(name),
      data.name,
      "quest",
      data.description,
      0,
      0
    );
  }
}
