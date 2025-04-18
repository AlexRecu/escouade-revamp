// src/controllers/exploration.controller.ts
import { Request, Response } from "express";
import { ExplorationStorage } from "../services/exploration/ExplorationStorage";
import { CampfireService } from "../services/dungeon/CampfireService";
import { ExplorationSessionManager } from "../services/game/ExplorationSessionManager";
import { ExplorationService } from "../services/dungeon/ExplorationService";

export class ExplorationController {
  /**
   * Sauvegarde l’état d’exploration au feu de camp
   */
  static saveExploration (req: Request, res: Response){
    try {
      const data = req.body; // Reçoit JSON contenant l’ExplorationState
      const partyId = data.party?.id;

      if (!partyId) res.status(400).json({ error: "Missing party ID" });
      else {
        ExplorationStorage.saveToFile(partyId, data);
        res.status(200).json({ message: "Exploration saved successfully." });
      }
    } catch (err) {
      res.status(500).json({ error: "Failed to save exploration", details: err });
    }
  }

  /**
   * Recharge la dernière sauvegarde disponible
   */
  static loadExploration (req: Request, res: Response){
    const partyId = req.params.partyId;

    const state = CampfireService.loadExploration(partyId);

    if (!state) {
      res.status(404).json({ error: "No saved exploration found for this party." });
    }
    else {
      ExplorationSessionManager.save(partyId, state);
      res.status(200).json(state.getSummary());
    }
  }

  static listSaves(req: Request, res: Response){
    try {
      const saves = ExplorationService.listAllSaves();
      res.json({ saves });
    } catch (e) {
      console.error("Erreur listSaves:", e);
      res.status(500).json({ error: "Impossible de lister les sauvegardes" });
    }
  }
}