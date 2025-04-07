import { Request, Response } from "express";
import { CharacterService } from "../services/characterService";

const characterService = new CharacterService();

// Obtenir tous les personnages d'un joueur
export const getCharactersByPlayer = async (req: Request, res: Response): Promise<void> => {
    try {
        const { playerId } = req.params;
        const characters = await characterService.getCharactersByPlayer(playerId);
        res.json(characters);
    } catch (error) {
        res.status(500).json({ error: "Erreur lors de la récupération des personnages." });
    }
}

// Obtenir un personnage par son ID
export const getCharacterById = async (req: Request, res: Response): Promise<void> => {
    try {
        const { characterId } = req.params;
        const character = await characterService.getCharacterById(characterId);
        if (!character) {
            res.status(404).json({ error: "Personnage non trouvé." });
            return;
        }
        res.json(character);
    } catch (error) {
        res.status(500).json({ error: "Erreur lors de la récupération du personnage." });
    }
}

// Créer un personnage
export const createCharacter = async (req: Request, res: Response): Promise<void> => {
    try {
        const character = await characterService.createCharacter(req.body);
        res.status(201).json(character);
    } catch (error) {
        res.status(500).json({ error: "Erreur lors de la création du personnage." });
    }
}

// Mettre à jour un personnage
export const updateCharacter = async (req: Request, res: Response): Promise<void> => {
    try {
        const { characterId } = req.params;
        const updatedCharacter = await characterService.updateCharacter(characterId, req.body);
        if (!updatedCharacter) {
            res.status(404).json({ error: "Personnage non trouvé." });
            return;
        }
        res.json(updatedCharacter);
    } catch (error) {
        res.status(500).json({ error: "Erreur lors de la mise à jour du personnage." });
    }
}

// Supprimer un personnage
export const deleteCharacter = async (req: Request, res: Response): Promise<void> => {
    try {
        const { characterId } = req.params;
        const success = await characterService.deleteCharacter(characterId);
        if (!success) {
            res.status(404).json({ error: "Personnage non trouvé." });
            return;
        }
        res.json({ message: "Personnage supprimé avec succès." });
    } catch (error) {
        res.status(500).json({ error: "Erreur lors de la suppression du personnage." });
    }
}
