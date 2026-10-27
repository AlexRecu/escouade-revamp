// src/services/dungeon/CampfireService.ts
import { Party } from "../../classes/Exploration/Party";
import { Campfire } from "../../classes/Progression/Campfire";

export class CampfireService {
  static useCampfire(campfire: Campfire, party: Party): string[] {
    const logs: string[] = [];

    if (campfire.isUsed) {
      logs.push(`Le feu de camp à ${campfire.locationName} a déjà été utilisé.`);
      return logs;
    }

    campfire.rest(party.members);

    logs.push(`Le groupe se repose près du feu de camp à ${campfire.locationName}.`);
    logs.push(`Tous les membres ont récupéré ${campfire.restoredHealthPercentage * 100}% HP et ${campfire.restoredManaPercentage * 100}% MP.`);

    return logs;
  }

  static getNearbyCampfire(party: Party, campfires: Campfire[]): Campfire | null {
    return campfires.find(c => 
      c.position?.row === party.position.row && 
      c.position?.col === party.position.col
    ) ?? null;
  }

   /**
   * Combinaison de détection et repos automatique si sur une tuile feu de camp
   */
   static restAtCampfire(party: Party, campfire: Campfire): string[] {
    if (!campfire) return [];
    return this.useCampfire(campfire, party);
  }

  
}