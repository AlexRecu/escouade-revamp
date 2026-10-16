// src/services/Progression/SaveService.ts
import { GameSaveModel } from "../../models/gameSave.model";
import { ExplorationState } from "../../classes/Exploration/ExplorationState";

/**
 * Service de persistance de partie (Phase 4 — Mongoose).
 *
 * Pont entre l'état de jeu en mémoire (`ExplorationState`) et la base
 * (modèle `GameSave`). L'état complet est stocké en JSON (sortie de
 * `ExplorationState.toJSON()`), rechargé via `ExplorationState.loadFromJSON`.
 *
 * Règle : **une sauvegarde active par joueur** (upsert sur `player`).
 *
 * Le modèle est **injectable** (`SaveService.model`) pour permettre de mocker
 * la base en test (pas de MongoDB requis).
 */

/** Résumé d'une sauvegarde (pour la liste, sans l'état complet). */
export interface SaveSummary {
  playerId: string;
  zoneName: string;
  difficulty: string;
  partySize: number;
  savedAt: Date;
}

export class SaveService {
  /** Modèle injectable (défaut `GameSaveModel`) — à mocker en test. */
  static model: typeof GameSaveModel = GameSaveModel;

  /**
   * Sauvegarde l'état de jeu d'un joueur (upsert : 1 sauvegarde active par
   * joueur). Renvoie le résumé de la sauvegarde.
   */
  static async saveGame(playerId: string, state: ExplorationState): Promise<SaveSummary> {
    const serialized = state.toJSON();
    const zoneName = state.zone.name;
    const difficulty = state.difficulty;
    const partySize = state.party.members.length;
    const savedAt = new Date();

    await this.model.findOneAndUpdate(
      { player: playerId },
      { $set: { state: serialized, zoneName, difficulty, partySize, savedAt } },
      { upsert: true, new: true }
    );

    return { playerId, zoneName, difficulty, partySize, savedAt };
  }

  /**
   * Charge l'état de jeu d'un joueur.
   * @returns l'état rechargé, ou null si aucune sauvegarde.
   */
  static async loadGame(playerId: string): Promise<ExplorationState | null> {
    const doc = await this.model.findOne({ player: playerId });
    if (!doc) return null;
    return ExplorationState.loadFromJSON(doc.state);
  }

  /**
   * Supprime la sauvegarde d'un joueur.
   * @returns true si une sauvegarde a été supprimée.
   */
  static async deleteGame(playerId: string): Promise<boolean> {
    const result = await this.model.deleteOne({ player: playerId });
    return (result?.deletedCount ?? 0) > 0;
  }

  /**
   * Liste les sauvegardes (champs dénormalisés, sans l'état complet).
   */
  static async listSaves(): Promise<SaveSummary[]> {
    const docs = await this.model.find();
    return docs.map((d) => ({
      playerId: String(d.player),
      zoneName: d.zoneName,
      difficulty: d.difficulty,
      partySize: d.partySize,
      savedAt: d.savedAt,
    }));
  }
}
