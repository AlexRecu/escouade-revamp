// src/services/exploration/ExplorationStorage.ts
import fs from "fs";
import path from "path";
import { ExplorationState } from "../classes/Exploration/ExplorationState";

// Mémoire temporaire de session (à terme, remplacer par Redis, etc.)
const sessionCache = new Map<string, ExplorationState>();

export class SaveModel {
  private static readonly SAVE_DIR = path.join(__dirname, "../../../data/saves");

  /**
   * Sauvegarde dans le cache mémoire + fichier
   */
  static saveState(playerId: string, state: ExplorationState): void {
    sessionCache.set(playerId, state);
    this.saveToFile(playerId, state);
  }

  /**
   * Charge en mémoire si dispo sinon depuis le disque
   */
  static loadState(playerId: string): ExplorationState | null {
    if (sessionCache.has(playerId)) {
      return sessionCache.get(playerId)!;
    }

    const fromFile = this.loadFromFile(playerId);
    if (fromFile) sessionCache.set(playerId, fromFile);
    return fromFile;
  }

  static saveToFile(playerId: string, state: ExplorationState): void {
    if (!fs.existsSync(this.SAVE_DIR)) {
      fs.mkdirSync(this.SAVE_DIR, { recursive: true });
    }

    const filePath = path.join(this.SAVE_DIR, `${playerId}.json`);
    const json = JSON.stringify(state.getSummary(), null, 2);
    fs.writeFileSync(filePath, json, "utf-8");
  }

  static loadFromFile(playerId: string): ExplorationState | null {
    const filePath = path.join(this.SAVE_DIR, `${playerId}.json`);
    if (!fs.existsSync(filePath)) return null;

    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);
    return ExplorationState.loadFromJSON(data);
  }

  static clear(playerId: string) {
    sessionCache.delete(playerId);
    const filePath = path.join(this.SAVE_DIR, `${playerId}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
