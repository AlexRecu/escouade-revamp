// src/routes/exploration.routes.ts
import express from "express";
import { saveExploration, loadExploration, listSaves } from "../controllers/exploration.controller";


const router = express.Router();

router.get("/saves", listSaves);
router.post("/save", saveExploration);
router.get("/load/:partyId", loadExploration);

export default router;
