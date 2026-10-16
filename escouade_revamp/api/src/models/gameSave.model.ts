import mongoose, { Document, Schema } from 'mongoose';

/**
 * Sauvegarde de partie (Phase 4 — persistance Mongoose).
 *
 * Une sauvegarde regroupe **tout** l'état de jeu d'un joueur : l'équipe, la
 * zone, le système de quêtes et les démons vaincus. L'état est stocké en JSON
 * (`state`, type `Mixed`) — c'est exactement la sortie de
 * `ExplorationState.toJSON()`, rechargée via `ExplorationState.loadFromJSON`.
 *
 * Quelques champs sont **dénormalisés** (zone, difficulté, taille d'équipe)
 * pour permettre de lister les sauvegardes sans recharger l'état complet.
 */
export interface GameSaveDocument extends Document {
  /** Référence au joueur propriétaire (unique : 1 sauvegarde active par joueur). */
  player: mongoose.Types.ObjectId;
  /** État de jeu complet (sortie de `ExplorationState.toJSON()`). */
  state: any;
  /** Nom de la zone courante (affichage liste). */
  zoneName: string;
  /** Difficulté de la partie (affichage liste). */
  difficulty: string;
  /** Nombre de membres de l'équipe (affichage liste). */
  partySize: number;
  /** Date de sauvegarde. */
  savedAt: Date;
}

const GameSaveSchema = new Schema<GameSaveDocument>(
  {
    player: { type: Schema.Types.ObjectId, ref: 'Player', required: true, unique: true },
    state: { type: Schema.Types.Mixed, required: true },
    zoneName: { type: String, default: '' },
    difficulty: { type: String, default: 'easy' },
    partySize: { type: Number, default: 0 },
    savedAt: { type: Date, default: Date.now }
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

export const GameSaveModel = mongoose.model<GameSaveDocument>('GameSave', GameSaveSchema);
