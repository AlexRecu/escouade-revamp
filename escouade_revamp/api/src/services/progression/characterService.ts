import { CharacterModel, CharacterDocument } from "../../models/character.model";

export class CharacterService {
  // Récupérer tous les personnages d'un joueur
  async getCharactersByPlayer(playerId: string): Promise<CharacterDocument[]> {
    return CharacterModel.find({ player: playerId }).populate("rightHand leftHand").exec();
  }

  // Récupérer un personnage par son ID
  async getCharacterById(characterId: string): Promise<CharacterDocument | null> {
    return CharacterModel.findById(characterId).populate("rightHand leftHand").exec();
  }

  // Créer un nouveau personnage
  async createCharacter(data: Partial<CharacterDocument>): Promise<CharacterDocument> {
    const newCharacter = new CharacterModel(data);
    return newCharacter.save();
  }

  // Mettre à jour un personnage
  async updateCharacter(characterId: string, updateData: Partial<CharacterDocument>): Promise<CharacterDocument | null> {
    return CharacterModel.findByIdAndUpdate(characterId, updateData, { new: true }).exec();
  }

  // Supprimer un personnage
  async deleteCharacter(characterId: string): Promise<boolean> {
    const result = await CharacterModel.findByIdAndDelete(characterId).exec();
    return result !== null;
  }
}
