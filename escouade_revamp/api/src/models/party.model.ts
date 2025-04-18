// src/models/party.model.ts

import mongoose, { Document, Schema } from "mongoose";

export interface PartyDocument extends Document {
  name: string;
  player: mongoose.Types.ObjectId;
  members: mongoose.Types.ObjectId[]; // Liste des personnages
  createdAt: Date;
  updatedAt: Date;
  zoneLevel: number;
  defeatedEnemies: number;
}

const PartySchema = new Schema<PartyDocument>(
  {
    name: { type: String, required: true },
    player: { type: Schema.Types.ObjectId, ref: "Player", required: true },
    members: [{ type: Schema.Types.ObjectId, ref: "Character" }],
    zoneLevel: { type: Number, default: 1 },
    defeatedEnemies: { type: Number, default: 0 },
  },
  {
    timestamps: true, // ajoute createdAt et updatedAt
  }
);

export const PartyModel = mongoose.model<PartyDocument>("Party", PartySchema);
