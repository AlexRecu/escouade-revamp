import { PlayerModel, PlayerDocument } from "../../models/player.model";
import bcrypt from "bcrypt";
import { ExplorationState } from "../../classes/Exploration/ExplorationState";
import { CharacterModel, CharacterDocument } from "../../models/character.model";

export class PlayerService {
  /**
   * Crée un nouveau joueur avec un mot de passe hashé
   */
  static async register(username: string, email: string, password: string): Promise<PlayerDocument> {
    const existing = await PlayerModel.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      throw new Error("Email ou nom d'utilisateur déjà utilisé.");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const player = new PlayerModel({
      username,
      email,
      password: hashedPassword,
    });

    return await player.save();
  }

  /**
   * Vérifie les identifiants pour la connexion
   */
  static async login(email: string, password: string): Promise<PlayerDocument> {
    const player = await PlayerModel.findOne({ email });
    if (!player) throw new Error("Aucun joueur trouvé avec cet email.");

    const valid = await bcrypt.compare(password, player.password);
    if (!valid) throw new Error("Mot de passe incorrect.");

    return player;
  }

  /**
   * Récupère un joueur par ID
   */
  static async getById(playerId: string): Promise<PlayerDocument | null> {
    return PlayerModel.findById(playerId);
  }

  /**
   * Sauvegarde l’état d’exploration du joueur
   */
  static async saveExplorationState(playerId: string, state: ExplorationState): Promise<void> {
    const player = await PlayerModel.findById(playerId);
    if (!player) throw new Error("Joueur introuvable.");

    player.explorationState = state.getSummary();
    await player.save();
  }

  /**
   * Charge l’état d’exploration stocké
   */
  static async loadExplorationState(playerId: string): Promise<any> {
    const player = await PlayerModel.findById(playerId);
    if (!player) throw new Error("Joueur introuvable.");

    return player.explorationState;
  }

  /**
   * Met à jour des infos diverses sur le joueur
   */
  static async updatePlayer(playerId: string, data: Partial<PlayerDocument>): Promise<PlayerDocument> {
    const player = await PlayerModel.findByIdAndUpdate(playerId, data, { new: true });
    if (!player) throw new Error("Joueur introuvable.");
    return player;
  }

  /**
   * Supprime un joueur
   */
  static async deletePlayer(playerId: string): Promise<void> {
    await PlayerModel.findByIdAndDelete(playerId);
  }

  /**
   * Récupère tous les personnages du joueur
   */
  static async getPlayerCharacters(playerId: string) {
    return CharacterModel.find({ player: playerId })
      .populate("rightHand leftHand")
      .exec();
  }

  /**
   * Ajoute un nouveau personnage au joueur
   */
  static async addCharacterToPlayer(playerId: string, charData: Partial<CharacterDocument>) {
    const newChar = new CharacterModel({ ...charData, player: playerId });
    return await newChar.save();
  }
}
