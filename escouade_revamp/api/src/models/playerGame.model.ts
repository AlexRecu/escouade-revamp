import mongoose, { Document, Schema } from 'mongoose';

/**
 * État de partie persistant par joueur (mode ville + progression monde).
 *
 * Contrairement à `GameSave` (qui stocke un `ExplorationState` lié à une zone),
 * ce modèle stocke l'état **indépendant de la zone** : l'équipe (party), le
 * système de quêtes et la ville courante. C'est ce qui survit entre les villes
 * et les explorations, et ce que le front charge à la connexion.
 *
 * Règle : **une partie active par joueur** (upsert sur `player`).
 *
 *  - `party` : sortie de `Party.toSerialized()` (membres, position, worldLevel,
 *    completedZones, or, sac…).
 *  - `questSystem` : sortie de `QuestSystem.toSerialized()` (état par id).
 *  - `currentHubId` : ville où l'équipe se trouve (défaut : Auberge du matin).
 */
export interface PlayerGameDocument extends Document {
  /** Référence au joueur propriétaire (unique : 1 partie active par joueur). */
  player: mongoose.Types.ObjectId;
  /** État de l'équipe (sortie de `Party.toSerialized()`). */
  party: any;
  /** État du système de quêtes (sortie de `QuestSystem.toSerialized()`). */
  questSystem: any;
  /** Ville courante (id du hub) — le hub de base de l'équipe. */
  currentHubId: string;
  /**
   * Nœud de **position** de l'équipe (id d'un hub OU d'un donjon). C'est ce
   * que suit le cercle blanc de la mappemonde. Quand l'équipe est en ville,
   * `currentNodeId === currentHubId` ; dans une zone, c'est l'id du donjon.
   */
  currentNodeId: string;
  /** Date de sauvegarde. */
  savedAt: Date;
}

const PlayerGameSchema = new Schema<PlayerGameDocument>(
  {
    player: { type: Schema.Types.ObjectId, ref: 'Player', required: true, unique: true },
    party: { type: Schema.Types.Mixed, required: true },
    questSystem: { type: Schema.Types.Mixed, required: true },
    currentHubId: { type: String, default: '' },
    currentNodeId: { type: String, default: '' },
    savedAt: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

export const PlayerGameModel = mongoose.model<PlayerGameDocument>('PlayerGame', PlayerGameSchema);
