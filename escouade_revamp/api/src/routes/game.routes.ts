// src/routes/game.routes.ts

import { Router } from "express";
import { GameStateController } from "../controllers/game.controller";

const router = Router();

router.get("/state/:playerId", GameStateController.getFullState);
router.get("/summary/:playerId", GameStateController.getStateSummary);

export default router;
