import { Request, Response } from 'express';
import { SaveService } from '../services/Progression/SaveService';
import { ExplorationState } from '../classes/Exploration/ExplorationState';

/**
 * Controller de sauvegarde de partie (Phase 4 — persistance Mongoose).
 *
 * Le `playerId` est injecté par `authMiddleware` dans `req.body.playerId`.
 * L'état de jeu est échangé en JSON (sortie de `ExplorationState.toJSON()`).
 */

/** POST /save — sauvegarde l'état de jeu du joueur. */
export const saveGame = async (req: Request, res: Response): Promise<void> => {
  try {
    const { state } = req.body;
    if (!state || typeof state !== 'object') {
      res.status(400).json({ message: "L'état de jeu est manquant ou invalide." });
      return;
    }
    const explorationState = ExplorationState.loadFromJSON(state);
    const summary = await SaveService.saveGame(req.body.playerId, explorationState);
    res.status(200).json({ message: 'Partie sauvegardée.', save: summary });
  } catch (error) {
    res.status(500).json({ message: "Une erreur s'est produite lors de la sauvegarde." });
  }
};

/** GET /save — charge l'état de jeu du joueur. */
export const loadGame = async (req: Request, res: Response): Promise<void> => {
  try {
    const explorationState = await SaveService.loadGame(req.body.playerId);
    if (!explorationState) {
      res.status(404).json({ message: 'Aucune sauvegarde trouvée.' });
      return;
    }
    res.status(200).json({ state: explorationState.toJSON() });
  } catch (error) {
    res.status(500).json({ message: "Une erreur s'est produite lors du chargement." });
  }
};

/** DELETE /save — supprime la sauvegarde du joueur. */
export const deleteGame = async (req: Request, res: Response): Promise<void> => {
  try {
    const deleted = await SaveService.deleteGame(req.body.playerId);
    if (!deleted) {
      res.status(404).json({ message: 'Aucune sauvegarde trouvée.' });
      return;
    }
    res.status(200).json({ message: 'Sauvegarde supprimée.' });
  } catch (error) {
    res.status(500).json({ message: "Une erreur s'est produite lors de la suppression." });
  }
};

/** GET /save/list — liste les sauvegardes (champs dénormalisés). */
export const listSaves = async (req: Request, res: Response): Promise<void> => {
  try {
    const saves = await SaveService.listSaves();
    res.status(200).json({ saves });
  } catch (error) {
    res.status(500).json({ message: "Une erreur s'est produite lors de la liste." });
  }
};
