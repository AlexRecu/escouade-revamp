import { Character } from "../UnitTypes/Character";
import { Position } from "../Types";

export class Campfire {
  locationName: string;
  restoredHealthPercentage: number;
  restoredManaPercentage: number;
  isUsed: boolean;
  usedAt?: Date;
  position?: Position; // Tuile du feu de camp dans la zone (si en donjon)
  /**
   * true si ce feu a été **créé par l'objet « Bois »** (et non généré par la
   * grille). Un feu de bois est créé ET consommé en une seule action (il
   * laisse une bûche, `isUsed = true`). Persisté séparément dans le snapshot
   * (les feux de bois ne font pas partie de la grille régénérée).
   */
  createdByWood?: boolean;

  constructor(locationName: string, restoredHealth = 0.5, restoredMana = 0.5, position?: Position) {
    this.locationName = locationName;
    this.restoredHealthPercentage = restoredHealth;
    this.restoredManaPercentage = restoredMana;
    this.isUsed = false;
    this.position = position;
  }

  /**
   * Soigne les personnages et restaure leur mana.
   * Marque le feu de camp comme utilisé.
   */
  rest(characters: Character[]): void {
    if (this.isUsed) return;

    // Les morts ne sont PAS soignés : le feu de camp ne ressuscite pas
    // (la réanimation reste l'apanage du sanctuaire / d'un objet dédié).
    characters.forEach(character => {
      if (character.isDead()) return;
      character.currentHp = Math.min(
        character.maxHp,
        character.currentHp + character.maxHp * this.restoredHealthPercentage
      );

      character.currentMp = Math.min(
        character.maxMp,
        character.currentMp + character.maxMp * this.restoredManaPercentage
      );
    });

    this.isUsed = true;
    this.usedAt = new Date();
  }

  /**
   * Permet de sauvegarder la progression.
   * (à implémenter côté service ou controller)
   */
  canSave(): boolean {
    return this.isUsed;
  }

  getSummary() {
    return {
      location: this.locationName,
      used: this.isUsed,
      restoredHp: this.restoredHealthPercentage,
      restoredMp: this.restoredManaPercentage,
      usedAt: this.usedAt?.toISOString() ?? null,
    };
  }
}
