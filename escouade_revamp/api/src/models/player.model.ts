// src/models/player.model.ts
import mongoose, { Document, Schema } from 'mongoose';

export interface PlayerDocument extends Document {
  username: string;
  email: string;
  password: string;
  lastUpdate: Date;
  createdAt: Date;
  explorationState?: any; // Pourrait contenir un snapshot de ExplorationState si besoin
  partyId?: string; // Lien vers une équipe
}

const PlayerSchema: Schema = new Schema({
  username: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: () => new Date() },
  lastUpdate: { type: Date, default: () => new Date() },

  // Extension RPG
  explorationState: { type: Schema.Types.Mixed }, // Peut contenir un JSON de l'état d'exploration
  partyId: { type: String }, // ou ref: 'Party' si tu veux une collection dédiée
});

PlayerSchema.pre('save', function (next) {
  this.lastUpdate = new Date();
  next();
});

export const PlayerModel = mongoose.model<PlayerDocument>('Player', PlayerSchema);
