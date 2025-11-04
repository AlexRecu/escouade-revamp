// src/controllers/player/party.controller.ts
import { Request, Response } from "express";
import { PartyService } from "../services/player/PartyService";

const partyService = new PartyService();

export class PartyController {
  async getAllPartiesForPlayer(req: Request, res: Response) {
    try {
      const { playerId } = req.params;
      const parties = await partyService.getPartiesByPlayer(playerId);
      res.json(parties);
    } catch (err) {
      res.status(500).json({ error: "Erreur lors de la récupération des parties." });
    }
  }

  async getPartyById(req: Request, res: Response) {
    try {
      const { partyId } = req.params;
      const party = await partyService.getPartyById(partyId);
      if (!party) {
        res.status(404).json({ error: "Party introuvable." });
      } else {
        res.json(party);
      }
    } catch (err) {
      res.status(500).json({ error: "Erreur lors de la récupération de la party." });
    }
  }

  async createParty(req: Request, res: Response) {
    try {
      const { name, creatorId, isPrivate } = req.body;
      const party = await partyService.createParty(name, creatorId, isPrivate);
      res.status(201).json(party);
    } catch (err) {
      res.status(500).json({ error: "Erreur lors de la création de la party." });
    }
  }

  async joinParty(req: Request, res: Response) {
    try {
      const { partyId } = req.params;
      const { playerId } = req.body;
      const updated = await partyService.joinParty(partyId, playerId);
      if (!updated) {
        res.status(403).json({ error: "Impossible de rejoindre la party." });
      } else {
        res.json(updated);
      }
    } catch (err) {
      res.status(500).json({ error: "Erreur lors de la tentative de rejoindre la party." });
    }
  }

  async addCharacter(req: Request, res: Response) {
    try {
      const { partyId } = req.params;
      const { characterId } = req.body;
      const updated = await partyService.addCharacter(partyId, characterId);
      if (!updated) {
        res.status(400).json({ error: "Ajout du personnage échoué." });
      } else {
        res.json(updated);
      }
    } catch (err) {
      res.status(500).json({ error: "Erreur lors de l'ajout du personnage." });
    }
  }

  async removeCharacter(req: Request, res: Response) {
    try {
      const { partyId, characterId } = req.params;
      const updated = await partyService.removeCharacter(partyId, characterId);
      if (!updated) {
        res.status(404).json({ error: "Impossible de supprimer le personnage." });
      } else {
        res.json(updated);
      }
    } catch (err) {
      res.status(500).json({ error: "Erreur lors de la suppression du personnage." });
    }
  }

  async deleteParty(req: Request, res: Response) {
    try {
      const { partyId } = req.params;
      const success = await partyService.deleteParty(partyId);
      if (!success) {
        res.status(404).json({ error: "Party introuvable ou déjà supprimée." });
      } else {
        res.json({ success: true });
      }
    } catch (err) {
      res.status(500).json({ error: "Erreur lors de la suppression de la party." });
    }
  }

  async updateParty(req: Request, res: Response) {
    try {
      const { partyId } = req.params;
      const updated = await partyService.updateParty(partyId, req.body);
      if (!updated) {
        res.status(404).json({ error: "Party introuvable." });
      } else {
        res.json(updated);
      }
    } catch (err) {
      res.status(500).json({ error: "Erreur lors de la mise à jour de la party." });
    }
  }

  async gainExperience(req: Request, res: Response) {
    try {
      const { partyId } = req.params;
      const { amount } = req.body;
      const updated = await partyService.gainExperience(partyId, amount);
      if (!updated) {
        res.status(404).json({ error: "Party introuvable." });
      } else {
        res.json(updated);
      }
    } catch (err) {
      res.status(500).json({ error: "Erreur lors de l'ajout d'expérience." });
    }
  }

  async incrementZoneLevel(req: Request, res: Response) {
    try {
      const { partyId } = req.params;
      const updated = await partyService.incrementZoneLevel(partyId);
      if (!updated) {
        res.status(404).json({ error: "Party introuvable." });
      } else {
        res.json(updated);
      }
    } catch (err) {
      res.status(500).json({ error: "Erreur lors de l'incrémentation du niveau de zone." });
    }
  }
}
