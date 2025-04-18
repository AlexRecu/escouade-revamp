import { Request, Response } from "express";
import { PartyService } from "../services/player/PartyService";

const partyService = new PartyService();

export class PartyController {
    // 🔍 GET /players/:playerId/parties
    static async getPartiesByPlayer(req: Request, res: Response) {
        try {
            const { playerId } = req.params;
            const parties = await partyService.getPartiesByPlayer(playerId);
            res.json(parties);
        } catch (err) {
            res.status(500).json({ error: "Failed to fetch parties" });
        }
    }

    // 🔍 GET /parties/:id
    static async getPartyById(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const party = await partyService.getPartyById(id);
            if (!party) { res.status(404).json({ error: "Party not found" }); }
            else { res.json(party); }
        } catch (err) {
            res.status(500).json({ error: "Failed to fetch party" });
        }
    }

    // ➕ POST /parties
    static async createParty(req: Request, res: Response) {
        try {
            const { name, player, members } = req.body;
            const party = await partyService.createParty({ name, player, members });
            res.status(201).json(party);
        } catch (err) {
            res.status(500).json({ error: "Failed to create party" });
        }
    }

    // ✏️ PATCH /parties/:id
    static async updateParty(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const updates = req.body;
            const updatedParty = await partyService.updateParty(id, updates);
            if (!updatedParty) res.status(404).json({ error: "Party not found" });
            else res.json(updatedParty);
        } catch (err) {
            res.status(500).json({ error: "Failed to update party" });
        }
    }

    // ❌ DELETE /parties/:id
    static async deleteParty(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const deleted = await partyService.deleteParty(id);
            if (!deleted) res.status(404).json({ error: "Party not found" });
            else res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: "Failed to delete party" });
        }
    }

    // ➕ PATCH /parties/:id/add-member
    static async addMember(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { characterId } = req.body;
            const updatedParty = await partyService.addMember(id, characterId);
            if (!updatedParty)  res.status(404).json({ error: "Party not found" });
            else res.json(updatedParty);
        } catch (err) {
            res.status(500).json({ error: "Failed to add member" });
        }
    }

    // ❌ PATCH /parties/:id/remove-member
    static async removeMember(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { characterId } = req.body;
            const updatedParty = await partyService.removeMember(id, characterId);
            if (!updatedParty) res.status(404).json({ error: "Party not found" });
            else res.json(updatedParty);
        } catch (err) {
            res.status(500).json({ error: "Failed to remove member" });
        }
    }
}
