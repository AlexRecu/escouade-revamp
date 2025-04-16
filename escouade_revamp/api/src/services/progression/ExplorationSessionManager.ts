// src/services/session/ExplorationSessionManager.ts

import { ExplorationState } from "../../classes/Exploration/ExplorationState";

const sessionCache = new Map<string, ExplorationState>();

export class ExplorationSessionManager {
  static save(playerId: string, state: ExplorationState) {
    sessionCache.set(playerId, state);
  }

  static load(playerId: string): ExplorationState | undefined {
    return sessionCache.get(playerId);
  }

  static clear(playerId: string) {
    sessionCache.delete(playerId);
  }

  static has(playerId: string): boolean {
    return sessionCache.has(playerId);
  }
}
