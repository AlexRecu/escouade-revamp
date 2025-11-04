import { PartyModel, PartyDocument } from "../../models/party.model";
import mongoose from "mongoose";

export class PartyService {
    // 🔍 Récupérer toutes les parties d’un joueur
    async getPartiesByPlayer(playerId: string): Promise<PartyDocument[]> {
        return PartyModel.find({ players: playerId })
            .populate("players")
            .populate("characters")
            .exec();
    }

    // 🔍 Récupérer une party par ID
    async getPartyById(partyId: string): Promise<PartyDocument | null> {
        return PartyModel.findById(partyId)
            .populate("players")
            .populate("characters")
            .exec();
    }

    // ➕ Créer une nouvelle party
    async createParty(
        name: string,
        creatorId: string,
        isPrivate = false
    ): Promise<PartyDocument> {
        const party = new PartyModel({
            name,
            players: [new mongoose.Types.ObjectId(creatorId)],
            characters: [],
            isPrivate,
            isLocked: false,
            zoneLevel: 1,
            playerLevel: 1,
            experienceGained: 0,
        });

        return party.save();
    }

    // 🔗 Rejoindre une party existante
    async joinParty(partyId: string, playerId: string): Promise<PartyDocument | null> {
        const party = await PartyModel.findById(partyId);
        if (!party || party.isLocked) return null;

        const playerObjectId = new mongoose.Types.ObjectId(playerId);
        if (!party.players.includes(playerObjectId)) {
            party.players.push(playerObjectId);
            await party.save();
        }

        return await PartyModel.findById(party._id).populate("players").populate("characters").exec();
    }

    // ✏️ Mettre à jour une party
    async updateParty(
        partyId: string,
        updateData: Partial<PartyDocument>
    ): Promise<PartyDocument | null> {
        return PartyModel.findByIdAndUpdate(partyId, updateData, { new: true })
            .populate("players")
            .populate("characters")
            .exec();
    }

    // 🧹 Supprimer une party
    async deleteParty(partyId: string): Promise<boolean> {
        const result = await PartyModel.findByIdAndDelete(partyId).exec();
        return result !== null;
    }

    // ➕ Ajouter un personnage
    async addCharacter(partyId: string, characterId: string): Promise<PartyDocument | null> {
        const party = await PartyModel.findById(partyId);
        if (!party) return null;

        const charId = new mongoose.Types.ObjectId(characterId);
        if (!party.characters.includes(charId)) {
            party.characters.push(charId);
            await party.save();
        }

        return await PartyModel.findById(party._id).populate("players").populate("characters").exec();
    }

    // ❌ Supprimer un personnage
    async removeCharacter(partyId: string, characterId: string): Promise<PartyDocument | null> {
        const party = await PartyModel.findById(partyId);
        if (!party) return null;

        party.characters = party.characters.filter(
            id => id.toString() !== characterId
        );

        await party.save();
        return await PartyModel.findById(party._id).populate("players").populate("characters").exec();
    }

    // ⚔️ Gagner de l’expérience et mise à jour du niveau
    async gainExperience(partyId: string, amount: number): Promise<PartyDocument | null> {
        const party = await PartyModel.findById(partyId);
        if (!party) return null;

        party.experienceGained += amount;

        const xpThreshold = party.playerLevel * 100;
        while (party.experienceGained >= xpThreshold) {
            party.experienceGained -= xpThreshold;
            party.playerLevel += 1;
        }

        await party.save();
        return party;
    }

    // 🧭 Incrémenter le niveau de zone
    async incrementZoneLevel(partyId: string): Promise<PartyDocument | null> {
        const party = await PartyModel.findById(partyId);
        if (!party) return null;

        party.zoneLevel += 1;
        await party.save();
        return party;
    }
}
