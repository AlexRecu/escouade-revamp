import { Item } from "../../classes/Items/Item";
import { ChestType } from "../../classes/Types";
import { ItemFactory } from "../factory/ItemFactory";

/**
 * Moteur de contenu des **coffres** d'exploration.
 *
 * Règles (par type de coffre, `zoneLevel` = niveau de la zone) :
 *
 *  - **Commun** : 75% consommable / 25% arme.
 *      - Consommable : `zoneThreshold ≤ zoneLevel - 1`
 *      - Arme        : `zoneThreshold ≤ zoneLevel - 1`
 *  - **Rare** : 50% consommable / 50% arme.
 *      - Consommable : `zoneThreshold ≤ zoneLevel`
 *      - Arme        : `zoneThreshold = zoneLevel` (exactement)
 *
 * Nombre d'objets par coffre : 1 à 3, avec une chance **décroissante**
 * (1 > 2 > 3). Appliquer la règle consommable/arme **par objet** reproduit
 * naturellement la composition voulue (1 objet → majoritairement consommable ;
 * 2 objets → souvent 2 consommables, parfois 1, rarement 2 armes ; idem 3).
 */
export class ChestService {
  /**
   * Objets de **classe** (liés à un job, pas des butins génériques) : ils ne
   * doivent **jamais** tomber dans les coffres. Ils sont obtenus par d'autres
   * moyens (recrutement, quêtes, équipement de départ).
   */
  private static readonly CLASS_ITEM_NAMES = new Set([
    "Bois",
    "Repousse",
    "Corde Sortie",
    "Monstronomicon",
    "Pièce marquée",
  ]);

  /**
   * Tire le contenu d'un coffre : une liste d'objets (1 à 3).
   *
   * @param chestType "common" ou "rare".
   * @param zoneLevel niveau de la zone (pour les seuils d'objets).
   * @param rand fonction aléatoire injectable (déterminisme des tests).
   */
  static rollChestContents(
    chestType: ChestType,
    zoneLevel: number,
    rand: () => number = Math.random
  ): Item[] {
    const count = this.rollCount(rand);
    const items: Item[] = [];
    for (let i = 0; i < count; i++) {
      const item = this.rollOneItem(chestType, zoneLevel, rand);
      if (item) items.push(item);
    }
    return items;
  }

  /** Nombre d'objets : 1 (50%), 2 (30%), 3 (20%) — chance décroissante. */
  private static rollCount(rand: () => number): number {
    const r = rand();
    if (r < 0.5) return 1;
    if (r < 0.8) return 2;
    return 3;
  }

  /** Tire un objet unique selon le type de coffre et le niveau de zone. */
  private static rollOneItem(
    chestType: ChestType,
    zoneLevel: number,
    rand: () => number
  ): Item | null {
    const consumableChance = chestType === "common" ? 0.75 : 0.5;
    const isConsumable = rand() < consumableChance;

    if (isConsumable) {
      // Consommable : seuil ≤ (zoneLevel - 1) en commun, ≤ zoneLevel en rare.
      const maxThreshold = chestType === "common" ? zoneLevel - 1 : zoneLevel;
      return this.pickFromPool("Consommable", (t) => t <= maxThreshold, rand);
    }
    // Arme : seuil ≤ (zoneLevel - 1) en commun, = zoneLevel (exact) en rare.
    if (chestType === "common") {
      const maxThreshold = zoneLevel - 1;
      return this.pickFromPool("Arme", (t) => t <= maxThreshold, rand);
    }
    return this.pickFromPool("Arme", (t) => t === zoneLevel, rand);
  }

  /**
   * Choisit aléatoirement un objet d'un type (JSON) dont le `zoneThreshold`
   * satisfait le prédicat. Fallback progressif si le pool est vide :
   *  1. élargir le seuil (prendre le plus proche disponible) ;
   *  2. n'importe quel objet du type ;
   *  3. null (rien à donner).
   */
  private static pickFromPool(
    type: string,
    thresholdOk: (threshold: number) => boolean,
    rand: () => number
  ): Item | null {
    const pool = ItemFactory.DATA.filter(
      (d) =>
        d.type === type &&
        !this.CLASS_ITEM_NAMES.has(d.name) &&
        thresholdOk(d.zoneThreshold ?? 0)
    );
    if (pool.length > 0) {
      return ItemFactory.fromData(pool[Math.floor(rand() * pool.length)]);
    }

    // Fallback 1 : le plus proche du seuil (le plus faible au-dessus, sinon le
    // plus élevé en dessous). Les objets de classe restent exclus.
    const ofType = ItemFactory.DATA.filter(
      (d) => d.type === type && !this.CLASS_ITEM_NAMES.has(d.name)
    );
    if (ofType.length === 0) return null;
    const sorted = [...ofType].sort(
      (a, b) => (a.zoneThreshold ?? 0) - (b.zoneThreshold ?? 0)
    );
    // Le plus faible seuil disponible (le plus "accessible").
    return ItemFactory.fromData(sorted[0]);
  }
}
