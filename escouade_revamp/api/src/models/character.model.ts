import mongoose, { Document, Schema } from 'mongoose';
import { PlayerDocument } from './player.model';

// Interface pour un personnage stocké en base de données
export interface CharacterDocument extends Document {
  player: PlayerDocument['_id']; // Référence au joueur
  name: string;
  type: 'Hero' | 'Enemy';
  position: { row: number; col: number };
  currentHp: number;
  maxHp: number;
  currentMp: number;
  maxMp: number;
  currentAp: number;
  maxAp: number;
  classe: string; // Stocke l'ID ou le nom de la classe
  stats: {
    strength: number;
    dexterity: number;
    intelligence: number;
    endurance: number;
    mana: number;
  };
  rightHand: mongoose.Types.ObjectId | null; // Référence à une arme
  leftHand: mongoose.Types.ObjectId | null; // Référence à une arme
  status: { name: string; duration: number }[];
}

// Définition du schéma Mongoose
const CharacterSchema = new Schema({
  player: { type: Schema.Types.ObjectId, ref: 'Player', required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['Hero', 'Enemy'], required: true },
  position: {
    row: { type: Number, required: true },
    col: { type: Number, required: true }
  },
  currentHp: { type: Number, required: true },
  maxHp: { type: Number, required: true },
  currentMp: { type: Number, required: true },
  maxMp: { type: Number, required: true },
  currentAp: { type: Number, required: true },
  maxAp: { type: Number, required: true },
  classe: { type: String, required: true },
  stats: {
    strength: { type: Number, required: true },
    dexterity: { type: Number, required: true },
    intelligence: { type: Number, required: true },
    endurance: { type: Number, required: true },
    mana: { type: Number, required: true }
  },
  rightHand: { type: Schema.Types.ObjectId, ref: 'Weapon', default: null },
  leftHand: { type: Schema.Types.ObjectId, ref: 'Weapon', default: null },
  status: [{ name: { type: String }, duration: { type: Number } }]
});

// Modèle Mongoose exporté
export const CharacterModel = mongoose.model<CharacterDocument>('Character', CharacterSchema);
