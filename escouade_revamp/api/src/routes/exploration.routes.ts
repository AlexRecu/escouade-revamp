// src/routes/exploration.routes.ts
import express from "express";
import { ExplorationController } from "../controllers/exploration.controller";


const router = express.Router();

router.get("/saves", ExplorationController.listSaves);
router.post("/save", ExplorationController.saveExploration);
router.get("/load/:partyId", ExplorationController.loadExploration);

export default router;
