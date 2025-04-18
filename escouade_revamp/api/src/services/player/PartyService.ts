// src/services/player/PartyService.ts

import { PartyModel, PartyDocument } from "../../models/party.model";
import { CharacterModel } from "../../models/character.model";
import mongoose from "mongoose";

export class PartyService {
  // 🔍 Récupérer toutes les parties d'un joueur
  async getPartiesByPlayer(playerId: string): Promise<PartyDocument[]> {
    return PartyModel.find({ player: playerId }).populate("members").exec();
  }

  // 🔍 Récupérer une party par son ID
  async getPartyById(partyId: string): Promise<PartyDocument | null> {
    return PartyModel.findById(partyId).populate("members").exec();
  }

  // ➕ Créer une nouvelle party
  async createParty(data: {
    name: string;
    player: string;
    members: string[];
  }): Promise<PartyDocument> {
    const newParty = new PartyModel({
      name: data.name,
      player: new mongoose.Types.ObjectId(data.player),
      members: data.members.map(id => new mongoose.Types.ObjectId(id)),
      zoneLevel: 1,
      defeatedEnemies: 0,
    });
    return newParty.save();
  }

  // ✏️ Mettre à jour une party
  async updateParty(
    partyId: string,
    updateData: Partial<PartyDocument>
  ): Promise<PartyDocument | null> {
    return PartyModel.findByIdAndUpdate(partyId, updateData, {
      new: true,
    })
      .populate("members")
      .exec();
  }

  // ❌ Supprimer une party
  async deleteParty(partyId: string): Promise<boolean> {
    const result = await PartyModel.findByIdAndDelete(partyId).exec();
    return result !== null;
  }

  // 📊 Ajouter un personnage à une party
  async addMember(partyId: string, characterId: string): Promise<PartyDocument | null> {
    const party = await PartyModel.findById(partyId);
    if (!party) return null;

    if (!party.members.includes(new mongoose.Types.ObjectId(characterId))) {
      party.members.push(new mongoose.Types.ObjectId(characterId));
      await party.save();
    }

    return party.populate("members");
  }

  // 🧹 Supprimer un personnage d'une party
  async removeMember(partyId: string, characterId: string): Promise<PartyDocument | null> {
    const party = await PartyModel.findById(partyId);
    if (!party) return null;

    party.members = party.members.filter(
      memberId => memberId.toString() !== characterId
    );

    await party.save();
    return party.populate("members");
  }
}
