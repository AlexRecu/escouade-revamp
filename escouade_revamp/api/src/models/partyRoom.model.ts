import mongoose, { Document, Schema } from 'mongoose';

/**
 * Membre d'une partie (room) : un joueur connecté (ou spectateur).
 */
export interface RoomMember {
  /** Référence au joueur (Player._id). */
  playerId: mongoose.Types.ObjectId;
  /** Pseudo (dénormalisé pour l'affichage dans le lobby). */
  username: string;
  /** true si le membre est en mode spectateur (consultation uniquement). */
  isSpectator: boolean;
}

/**
 * Partie partagée (mode multi-joueurs temps réel).
 *
 * Contrairement à `PlayerGame` (1 partie par joueur, solo), une `PartyRoom`
 * est une **partie commune** que plusieurs joueurs rejoignent : ils partagent
 * la même équipe (`party`), le même système de quêtes et la même ville
 * courante. Quand un membre agit (achat, déplacement, donjon…), l'état est
 * persisté ici et **diffusé** à tous les membres connectés (voir `socket.ts`).
 *
 *  - `roomId` : identifiant lisible (ex. `Room_xxx`) — sert aussi de nom de
 *    room Socket.IO pour le broadcast.
 *  - `hostId` / `hostName` : l'hôte (celui qui a créé la partie).
 *  - `members` : les joueurs dans la partie (hôte inclus) + éventuels
 *    spectateurs.
 *  - `party` / `questSystem` / `currentHubId` : l'état de jeu partagé
 *    (mêmes formats que `PlayerGame`).
 *  - `isPublic` : visible dans le lobby (rejoignable par n'importe qui).
 *  - `maxPlayers` : nombre max de joueurs (hors spectateurs).
 */
export interface PartyRoomDocument extends Document {
  /** Identifiant lisible de la partie (unique). */
  roomId: string;
  /** Nom de la partie (affiché dans le lobby). */
  name: string;
  /** Joueur hôte (Player._id). */
  hostId: mongoose.Types.ObjectId;
  /** Pseudo de l'hôte (dénormalisé). */
  hostName: string;
  /** Membres de la partie (hôte inclus + spectateurs). */
  members: RoomMember[];
  /** État de l'équipe (sortie de `Party.toSerialized()`). */
  party: any;
  /** État du système de quêtes (sortie de `QuestSystem.toSerialized()`). */
  questSystem: any;
  /** Ville courante (id du hub) — le hub de base de l'équipe. */
  currentHubId: string;
  /**
   * Nœud de **position** de l'équipe (id d'un hub OU d'un donjon). C'est ce
   * que suit le cercle blanc de la mappemonde. Quand l'équipe est en ville,
   * `currentNodeId === currentHubId` ; quand elle est dans une zone
   * d'exploration, `currentNodeId` est l'id du donjon.
   */
  currentNodeId: string;
  /**
   * **Difficulté** de la partie : `easy` (défaite = ranimation payante /
   * dernier survivant à 1 PV) ou `hard` (défaite sans or = game over, partie
   * supprimée). Choisie à la création de la partie.
   */
  difficulty: "easy" | "hard";
  /**
   * **Session d'exploration persistée** (donjon en cours). Snapshot de l'état
   * du donjon (seed, étage, position, tuiles visitées, coffres ouverts, feux
   * de camp utilisés) pour survivre à une reconnexion / redémarrage. `null`
   * quand l'équipe n'est pas dans un donjon. Voir
   * `ExplorationSessionService.serializeSnapshot` / `restoreFromSnapshot`.
   */
  exploration: any;
  /**
   * **Session de combat persistée** (combat en cours dans le donjon). Snapshot
   * de l'état du combat (unités, tour, ordre d'action, log, budget de
   * déplacement) pour survivre à une reconnexion / redémarrage. `null` quand
   * aucun combat n'est en cours. Voir
   * `CombatSessionService.serializeCombatSnapshot` / `restoreCombat`.
   */
  combat: any;
  /** Visible dans le lobby (rejoignable). */
  isPublic: boolean;
  /** Nombre max de joueurs (hors spectateurs). */
  maxPlayers: number;
  /** Date de sauvegarde. */
  savedAt: Date;
}

const RoomMemberSchema = new Schema(
  {
    playerId: { type: Schema.Types.ObjectId, ref: 'Player', required: true },
    username: { type: String, required: true },
    isSpectator: { type: Boolean, default: false },
  },
  { _id: false }
);

const PartyRoomSchema = new Schema<PartyRoomDocument>(
  {
    roomId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    hostId: { type: Schema.Types.ObjectId, ref: 'Player', required: true },
    hostName: { type: String, required: true },
    members: { type: [RoomMemberSchema], default: [] },
    party: { type: Schema.Types.Mixed, required: true },
    questSystem: { type: Schema.Types.Mixed, required: true },
    currentHubId: { type: String, default: '' },
    currentNodeId: { type: String, default: '' },
    // Difficulté de la partie (easy/hard) — choisie à la création.
    difficulty: { type: String, default: 'easy' },
    // Session d'exploration persistée (donjon en cours) — null si hors donjon.
    exploration: { type: Schema.Types.Mixed, default: null },
    // Session de combat persistée (combat en cours) — null si aucun combat.
    combat: { type: Schema.Types.Mixed, default: null },
    isPublic: { type: Boolean, default: true },
    maxPlayers: { type: Number, default: 4 },
    savedAt: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

export const PartyRoomModel = mongoose.model<PartyRoomDocument>('PartyRoom', PartyRoomSchema);
