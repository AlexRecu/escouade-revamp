import mongoose, { Document, Schema } from 'mongoose';
 
export interface PlayerDocument extends Document {
  username: string;
  email: string;
  password: string;
  lastUpdate: Date;
}
 
const PlayerSchema: Schema = new Schema({
  username: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true },
  lastUpdate: { type: Date, default: Date.now },
});
 
export const PlayerModel = mongoose.model<PlayerDocument>('Player', PlayerSchema);