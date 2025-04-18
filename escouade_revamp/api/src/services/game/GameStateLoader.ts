// src/services/game/GameStateLoader.ts

import { PlayerService } from "../player/PlayerService";
import { PartyService } from "../player/PartyService";
import { ExplorationState } from "../../classes/Exploration/ExplorationState";
import { ExplorationStorage } from "../exploration/ExplorationStorage";

export class GameStateLoader {
  static async loadFullState(playerId: string): Promise<ExplorationState | null> {
    const player = await PlayerService.getById(playerId);
    if (!player) throw new Error("Player not found");

    // 🔄 1. Récupération de la Party
    const parties = await new PartyService().getPartiesByPlayer(playerId);
    const party = parties[0]; // Par défaut, on prend la première Party

    if (!party) throw new Error("No party found for player");

    // 🔄 2. Récupération de la dernière sauvegarde d'exploration
    const exploration = await ExplorationStorage.loadState(playerId);

    if (!exploration) {
      // TODO: générer une ExplorationState par défaut ?
      return null;
    }

    return exploration;
  }

  static async loadSummary(playerId: string): Promise<any> {
    const fullState = await this.loadFullState(playerId);
    if (!fullState) return null;
    return fullState.getSummary();
  }
}
