// src/routes/party.routes.ts
import { Router } from "express";
import { PartyController } from "../controllers/party.controller";

const router = Router();
const controller = new PartyController();

// Parties
router.get("/player/:playerId/parties", controller.getAllPartiesForPlayer);
router.get("/party/:partyId", controller.getPartyById);
router.post("/party", controller.createParty);
router.post("/party/:partyId/join", controller.joinParty);
router.post("/party/:partyId/character", controller.addCharacter);
router.delete("/party/:partyId/character/:characterId", controller.removeCharacter);
router.put("/party/:partyId", controller.updateParty);
router.delete("/party/:partyId", controller.deleteParty);

// Progression
router.post("/party/:partyId/xp", controller.gainExperience);
router.post("/party/:partyId/zone/next", controller.incrementZoneLevel);

export default router;
