// src/models/party.model.ts
import mongoose, { Document, Schema } from "mongoose";

export interface PartyDocument extends Document {
  name: string;
  players: mongoose.Types.ObjectId[];
  characters: mongoose.Types.ObjectId[];
  isLocked: boolean;
  isPrivate: boolean;
  zoneLevel: number;           // 🧭 Niveau de zone
  playerLevel: number;         // 🎖️ Niveau de l'équipe
  experienceGained: number;    // 📈 Suivi de progression dans le niveau
  createdAt: Date;
  updatedAt: Date;
}

const PartySchema: Schema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    players: [{ type: Schema.Types.ObjectId, ref: "Player" }],
    characters: [{ type: Schema.Types.ObjectId, ref: "Character" }],
    isLocked: { type: Boolean, default: false },
    isPrivate: { type: Boolean, default: false },
    zoneLevel: { type: Number, default: 1 },        // 🧭 Niveau de zone
    playerLevel: { type: Number, default: 1 },      // 🎖️ Progression globale
    experienceGained: { type: Number, default: 0 }, // 📈 Suivi de progression
  },
  { timestamps: true }
);

export const PartyModel = mongoose.model<PartyDocument>("Party", PartySchema);
