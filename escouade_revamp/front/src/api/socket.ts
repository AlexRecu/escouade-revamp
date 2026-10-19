// Client Socket.IO typé pour les interactions de ville (temps réel).

import { io, Socket } from 'socket.io-client';
import { getToken } from './auth';
import type { GameState, ExplorationState } from '../types/game';

let socket: Socket | null = null;

/**
 * Connecte (ou reconnecte) le socket avec le token JWT.
 * En dev, Vite proxy `/` vers le backend (même origine) → on ne précise pas
 * d'URL : le socket utilise l'origine courante.
 */
export function connectSocket(): Socket {
  if (socket?.connected) return socket;
  const token = getToken();
  socket = io({
    auth: { token: token ?? '' },
    transports: ['websocket', 'polling'],
  });
  return socket;
}

/** Déconnecte le socket. */
export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

// ── Actions (client → serveur) ─────────────────────────────────────────────

export const hubJoin = (): void => { socket?.emit('hub:join', {}); };
export const hubBuy = (itemName: string): void => { socket?.emit('hub:buy', { itemName }); };
export const hubSell = (itemId: string): void => { socket?.emit('hub:sell', { itemId }); };
export const hubEquip = (memberId: string, itemId: string, hand: 'right' | 'left'): void => {
  socket?.emit('hub:equip', { memberId, itemId, hand });
};
export const hubRest = (): void => { socket?.emit('hub:rest', {}); };
export const hubSanctuary = (targetId: string): void => { socket?.emit('hub:sanctuary', { targetId }); };
export const hubQuestBoard = (): void => { socket?.emit('hub:questBoard', {}); };
export const hubAcceptQuest = (questId: string): void => { socket?.emit('hub:acceptQuest', { questId }); };
export const hubChangeHub = (hubId: string): void => { socket?.emit('hub:changeHub', { hubId }); };
export const hubCompleteZone = (zoneId: string): void => { socket?.emit('hub:completeZone', { zoneId }); };
export const hubLeave = (): void => { socket?.emit('hub:leave', {}); };

// ── Exploration des donjons (client → serveur) ─────────────────────────────

export type ExplorationDirection = 'north' | 'south' | 'east' | 'west';

export const explorationEnter = (dungeonId: string): void => {
  socket?.emit('exploration:enter', { dungeonId });
};
export const explorationMove = (direction: ExplorationDirection): void => {
  socket?.emit('exploration:move', { direction });
};
export const explorationRest = (): void => { socket?.emit('exploration:rest', {}); };
export const explorationExit = (): void => { socket?.emit('exploration:exit', {}); };

// ── Abonnements (serveur → client) ─────────────────────────────────────────

export function onState(cb: (state: GameState) => void): void {
  socket?.on('hub:state', ({ state }: { state: GameState }) => cb(state));
}

export function onLog(cb: (logs: string[]) => void): void {
  socket?.on('hub:log', ({ logs }: { logs: string[] }) => cb(logs));
}

export function onQuests(cb: (quests: unknown[]) => void): void {
  socket?.on('hub:quests', ({ quests }: { quests: unknown[] }) => cb(quests));
}

export function onError(cb: (message: string) => void): void {
  socket?.on('error', ({ message }: { message: string }) => cb(message));
}

// ── Abonnements exploration (serveur → client) ─────────────────────────────

export function onExplorationState(cb: (state: ExplorationState) => void): void {
  socket?.on('exploration:state', ({ state }: { state: ExplorationState }) => cb(state));
}

export function onExplorationLog(cb: (logs: string[]) => void): void {
  socket?.on('exploration:log', ({ logs }: { logs: string[] }) => cb(logs));
}

/** Émis quand le donjon est terminé (porte de sortie atteinte) → auto-sortie. */
export function onExplorationExited(cb: () => void): void {
  socket?.on('exploration:exited', () => cb());
}

// ── Lobby de parties (multi-joueurs) ───────────────────────────────────────

import type { RoomSummary } from '../types/game';

/** Liste les parties publiques (pour le lobby). */
export const partyList = (): void => { socket?.emit('party:list', {}); };

/** Crée une nouvelle partie (l'appelant en devient l'hôte). */
export const partyCreate = (opts: { name?: string; isPublic?: boolean; maxPlayers?: number }): void => {
  socket?.emit('party:create', opts);
};

/** Rejoint une partie existante (en tant que joueur ou spectateur). */
export const partyJoin = (roomId: string, isSpectator = false): void => {
  socket?.emit('party:join', { roomId, isSpectator });
};

/** Quitte la partie courante (retour au lobby). */
export const partyLeave = (): void => { socket?.emit('party:leave', {}); };

/** Liste des parties (réponse à `party:list`). */
export function onPartyList(cb: (rooms: RoomSummary[]) => void): void {
  socket?.on('party:list', ({ rooms }: { rooms: RoomSummary[] }) => cb(rooms));
}

/** Émis quand une partie est créée/rejointe/quitte → rafraîchir le lobby. */
export function onPartyUpdated(cb: () => void): void {
  socket?.on('party:updated', () => cb());
}

/** Émis quand le joueur quitte sa partie → retour au lobby. */
export function onPartyLeft(cb: () => void): void {
  socket?.on('party:left', () => cb());
}
