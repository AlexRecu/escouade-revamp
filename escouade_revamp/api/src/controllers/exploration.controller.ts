// src/controllers/exploration.controller.ts
import { Request, Response } from "express";
import { SaveModel } from "../models/save.model";
import { CampfireService } from "../services/dungeon/CampfireService";
import { ExplorationSessionManager } from "../services/progression/ExplorationSessionManager";
import { ExplorationService } from "../services/dungeon/ExplorationService";

/**
 * Sauvegarde l’état d’exploration au feu de camp
 */
export const saveExploration = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = req.body; // Reçoit JSON contenant l’ExplorationState
    const partyId = data.party?.id;

    if (!partyId) res.status(400).json({ error: "Missing party ID" });
    else {
      SaveModel.saveToFile(partyId, data);
      res.status(200).json({ message: "Exploration saved successfully." });
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to save exploration", details: err });
  }
};

/**
 * Recharge la dernière sauvegarde disponible
 */
export const loadExploration = async (req: Request, res: Response): Promise<void> => {
  const partyId = req.params.partyId;

  const state = CampfireService.loadExploration(partyId);
  
  if (!state) {
    res.status(404).json({ error: "No saved exploration found for this party." });
  }
  else { 
    ExplorationSessionManager.save(partyId, state);
    res.status(200).json(state.getSummary()); }
};

export const listSaves = async (req: Request, res: Response): Promise<void> => {
  try {
    const saves = ExplorationService.listAllSaves();
    res.json({ saves });
  } catch (e) {
    console.error("Erreur listSaves:", e);
    res.status(500).json({ error: "Impossible de lister les sauvegardes" });
  }
}
