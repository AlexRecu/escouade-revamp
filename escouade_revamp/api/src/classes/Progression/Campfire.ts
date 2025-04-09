import { Position } from "../Types";
import { Character } from "../UnitTypes/Character";

export class Campfire {
  id: string;
  locationName: string;
  position?: Position;
  restoredHealthPercentage: number;
  restoredManaPercentage: number;
  isUsed: boolean;
  usedAt?: Date;

  constructor(id: string, locationName: string, position?: Position, restoredHealth = 0.5, restoredMana = 0.5) {
    this.id = id;
    this.locationName = locationName;
    this.position = position;
    this.restoredHealthPercentage = restoredHealth;
    this.restoredManaPercentage = restoredMana;
    this.isUsed = false;
  }

  /**
   * Soigne les personnages et restaure leur mana.
   * Marque le feu de camp comme utilisé.
   */
  rest(characters: Character[]): void {
    if (this.isUsed) return;

    characters.forEach(character => {
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
   * TODO Ajouter un système de sauvegarde (à implémenter côté service ou controller)
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
