// src/controllers/GameStateController.ts

import { Request, Response } from "express";
import { GameStateLoader } from "../services/game/GameStateLoader";

export class GameStateController {
    static async getFullState(req: Request, res: Response) {
        try {
            const playerId = req.params.playerId;
            const state = await GameStateLoader.loadFullState(playerId);
            if (!state) res.status(404).json({ error: "No game state found" });
            else res.json(state);
        } catch (err) {
            res.status(500).json({ error: "Failed to load game state" });
        }
    }

    static async getStateSummary(req: Request, res: Response) {
        try {
            const playerId = req.params.playerId;
            const summary = await GameStateLoader.loadSummary(playerId);
            if (!summary) res.status(404).json({ error: "No game state found" });
            else res.json(summary);
        } catch (err) {
            res.status(500).json({ error: "Failed to load game summary" });
        }
    }
}
