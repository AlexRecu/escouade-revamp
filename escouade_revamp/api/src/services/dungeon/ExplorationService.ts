import { ExplorationState } from "../../classes/Exploration/ExplorationState";
import { Party } from "../../classes/Exploration/Party";
import { Position } from "../../classes/Types";
import { Character } from "../../classes/UnitTypes/Character";
import { Zone } from "../../classes/World/Zone";
import { ExplorationStorage } from "../exploration/ExplorationStorage";
import { ExplorationSessionManager } from "../game/ExplorationSessionManager";
import { CampfireService } from "./CampfireService";
import fs from "fs";
import path from "path";

const SAVE_DIR = path.resolve("saves");

export class ExplorationService {
    private static sessionCache: Map<string, ExplorationState> = new Map();
  
    /**
     * Initialise une exploration avec une zone et une équipe
     */
    static startExploration(party: Party, zone: Zone): ExplorationState {
      const exploration = new ExplorationState(party, zone);
      this.sessionCache.set(party.id, exploration);
      return exploration;
    }
  
    /**
     * Déplace l’équipe vers une nouvelle tuile
     */
    static moveParty(partyId: string, position: Position): ExplorationState | null {
      const state = this.sessionCache.get(partyId);
      if (!state) return null;
  
      state.party.moveTo(position);
      state.savedAt = new Date();
  
      // Vérifie s’il y a un feu de camp à cette position
      const camp = state.zone.checkpoints.find(c => c.position?.row === position.row && c.position?.col === position.col);
      if (camp) {
        state.activeCampfire = camp;
      } else {
        state.activeCampfire = undefined;
      }
  
      return state;
    }
  
    /**
     * Utilise un feu de camp
     */
    static restAtCampfire(partyId: string): boolean {
      const state = this.sessionCache.get(partyId);
      if (!state || !state.activeCampfire) return false;
  
      CampfireService.restAtCampfire(state.party, state.activeCampfire);
      return true;
    }
  
    /**
     * Sauvegarde l’état d’exploration (en base ou fichier)
     */
    static async saveExplorationState(partyId: string): Promise<void> {
      const state = this.sessionCache.get(partyId);
      if (!state) return;
  
      state.savedAt = new Date();
      await ExplorationStorage.saveState(partyId, state); //partyId ou playerId ?
    }

    /**
   * Retourne la liste des fichiers de sauvegarde disponibles
   */
  static listAllSaves(): { partyId: string; savedAt: Date }[] {
    if (!fs.existsSync(SAVE_DIR)) return [];

    const files = fs.readdirSync(SAVE_DIR);
    return files
      .filter(file => file.endsWith(".json"))
      .map(file => {
        const filePath = path.join(SAVE_DIR, file);
        const raw = fs.readFileSync(filePath, "utf-8");
        const data = JSON.parse(raw) as ExplorationState;

        return {
          partyId: data.party.id,
          savedAt: data.savedAt ?? fs.statSync(filePath).mtime
        };
      });
  }
  
    /**
     * Charge un état d’exploration sauvegardé
     */
    static async loadExplorationState(partyId: string): Promise<ExplorationState | null> {
      const loadedState = await ExplorationStorage.loadState(partyId);
      if (loadedState) {
        this.sessionCache.set(partyId, loadedState);
      }
      return loadedState;
    }
  
    /**
     * Fournit un résumé JSON de l’exploration pour le frontend
     */
    static getExplorationSummary(partyId: string): any {
      const state = this.sessionCache.get(partyId);
      if (!state) return null;
  
      return {
        partyId: state.party.id,
        currentTile: state.party.position,
        zone: {
          name: state.zone.name,
          biome: state.zone.biome,
          level: state.zone.zoneLevel,
          encounterRate: state.zone.encounterRate
        },
        visited: Array.from(state.party.visitedTiles),
        campfire: state.activeCampfire?.getSummary(),
        savedAt: state.savedAt?.toISOString() ?? null
      };
    }
  }
