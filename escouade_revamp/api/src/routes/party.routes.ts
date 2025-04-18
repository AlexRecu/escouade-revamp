// src/routes/party.routes.ts

import { Router } from "express";
import { PartyController } from "../controllers/party.controller";

const router = Router();

router.get("/players/:playerId/parties", PartyController.getPartiesByPlayer);
router.get("/parties/:id", PartyController.getPartyById);
router.post("/parties", PartyController.createParty);
router.patch("/parties/:id", PartyController.updateParty);
router.delete("/parties/:id", PartyController.deleteParty);
router.patch("/parties/:id/add-member", PartyController.addMember);
router.patch("/parties/:id/remove-member", PartyController.removeMember);

export default router;
