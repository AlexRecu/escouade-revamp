// src/services/CampfireService.ts
import fs from "fs";
import path from "path";
import { ExplorationState } from "../../classes/Exploration/ExplorationState";
import { Party } from "../../classes/Exploration/Party";
import { Campfire } from "../../classes/Progression/Campfire";
import { Character } from "../../classes/UnitTypes/Character";
import { SaveModel } from "../exploration/ExplorationStorage";
import { ExplorationSessionManager } from "../game/ExplorationSessionManager";

const SAVE_DIR = path.resolve("saves");

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

  /**
   * Vérifie si le feu de camp utilisé est un point de sauvegarde valide
   */
  static canSaveAt(campfire: Campfire): boolean {
    return campfire.canSave();
  }

  /**
   * Sauvegarde de la progression
   */
  static saveExploration(state: ExplorationState): string {
    const currentCampfire = this.getNearbyCampfire(state.party, state.zone.checkpoints);
    if (!currentCampfire || !currentCampfire.isUsed) {
      return "Aucune sauvegarde possible ici.";
    }

    state.savedAt = new Date();
    ExplorationSessionManager.save(state.party.id, state); // met à jour le cache
    SaveModel.saveToFile(state.party.id, state);
    return `Partie sauvegardée avec succès à ${currentCampfire.locationName}.`;
  }

  static loadExploration(partyId: string): ExplorationState | null {
    const saved = SaveModel.loadFromFile(partyId);
    if (!saved) return null;
    return ExplorationState.loadFromJSON(saved);
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

