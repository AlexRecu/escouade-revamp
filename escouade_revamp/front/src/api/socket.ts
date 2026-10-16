// Client Socket.IO typé pour les interactions de ville (temps réel).

import { io, Socket } from 'socket.io-client';
import { getToken } from './auth';
import type { GameState } from '../types/game';

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
