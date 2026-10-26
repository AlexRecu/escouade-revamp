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
export const hubUseItem = (memberId: string, itemId: string): void => {
  socket?.emit('hub:useItem', { memberId, itemId });
};
export const hubRest = (): void => { socket?.emit('hub:rest', {}); };
export const hubSanctuary = (targetId: string): void => { socket?.emit('hub:sanctuary', { targetId }); };
/** Lance un sort de soin (cible alliée) hors combat en ville. */
export const hubCastSpell = (casterId: string, targetId: string, spellName: string): void => {
  socket?.emit('hub:castSpell', { casterId, targetId, spellName });
};
export const hubQuestBoard = (): void => { socket?.emit('hub:questBoard', {}); };
export const hubAcceptQuest = (questId: string): void => { socket?.emit('hub:acceptQuest', { questId }); };
export const hubChangeHub = (hubId: string): void => { socket?.emit('hub:changeHub', { hubId }); };
export const hubCaravan = (destHubId: string): void => { socket?.emit('hub:caravan', { destHubId }); };
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
/** Utilise l'objet « Bois » : allume un feu de camp sur la case courante (vide). */
export const explorationUseWood = (): void => { socket?.emit('exploration:useWood', {}); };
export const explorationChest = (): void => { socket?.emit('exploration:chest', {}); };
export const explorationExit = (): void => { socket?.emit('exploration:exit', {}); };
/** Équipe une arme du sac en main droite/gauche pendant le donjon. */
export const explorationEquip = (memberId: string, itemId: string, hand: 'right' | 'left'): void => {
  socket?.emit('exploration:equip', { memberId, itemId, hand });
};
/** Utilise un consommable du sac pendant le donjon. */
export const explorationUseItem = (memberId: string, itemId: string): void => {
  socket?.emit('exploration:useItem', { memberId, itemId });
};
/** Lance un sort de soin (cible alliée) hors combat pendant le donjon. */
export const explorationCastSpell = (casterId: string, targetId: string, spellName: string): void => {
  socket?.emit('exploration:castSpell', { casterId, targetId, spellName });
};

// ── Combat interactif (client → serveur) ───────────────────────────────────

/** Phase de placement : repositionne un héros sur les 2 lignes du bas. */
export const combatPlace = (unitId: string, position: { row: number; col: number }): void => {
  socket?.emit('combat:place', { unitId, position });
};
/** Valide le placement et démarre le combat. */
export const combatConfirmPlacement = (): void => {
  socket?.emit('combat:confirmPlacement', {});
};
export const combatMove = (unitId: string, position: { row: number; col: number }): void => {
  socket?.emit('combat:move', { unitId, position });
};
export const combatAct = (
  unitId: string,
  action: 'attack' | 'spell' | 'skill' | 'item' | 'combo',
  targetId: string | null,
  extra?: { spell?: { name: string }; skill?: { name: string }; item?: any; combo?: string[] }
): void => {
  socket?.emit('combat:act', { unitId, action, targetId, extra });
};
export const combatEndTurn = (unitId: string): void => {
  socket?.emit('combat:endTurn', { unitId });
};
/** Un tour IA à la fois (animation des ennemis un par un). */
export const combatAiStep = (): void => { socket?.emit('combat:aiStep', {}); };
export const combatFlee = (): void => { socket?.emit('combat:flee', {}); };
/** Fin de combat : le serveur applique le butin / la défaite et renvoie l'état d'exploration. */
export const combatEnd = (): void => { socket?.emit('combat:end', {}); };
/** Soumet les stats choisies pour les montées de niveau reportées. */
export const combatSubmitStats = (choices: { characterId: string; stat: string }[]): void => {
  socket?.emit('combat:submitStats', { choices });
};

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

/** Émis après une victoire avec montée de niveau : les montées reportées
 *  (stat à choisir par le joueur) pour l'écran de choix. */
export function onExplorationLevelUps(cb: (levelUps: { characterId: string; name: string; level: number }[]) => void): void {
  socket?.on('exploration:levelUps', ({ levelUps }: { levelUps: { characterId: string; name: string; level: number }[] }) => cb(levelUps));
}

/** Émis à chaque action de combat (état du plateau + actions disponibles). */
export function onCombatState(cb: (state: import('../types/game').CombatState) => void): void {
  socket?.on('combat:state', ({ state }: { state: import('../types/game').CombatState }) => cb(state));
}

// ── Lobby de parties (multi-joueurs) ───────────────────────────────────────

import type { RoomSummary } from '../types/game';

/** Liste les parties publiques (pour le lobby). */
export const partyList = (): void => { socket?.emit('party:list', {}); };

/** Crée une nouvelle partie (l'appelant en devient l'hôte). */
export const partyCreate = (opts: { name?: string; isPublic?: boolean; maxPlayers?: number; difficulty?: 'easy' | 'hard' }): void => {
  socket?.emit('party:create', opts);
};

/** Rejoint une partie existante (en tant que joueur ou spectateur). */
export const partyJoin = (roomId: string, isSpectator = false): void => {
  socket?.emit('party:join', { roomId, isSpectator });
};

/** Quitte la partie courante (retour au lobby). */
export const partyLeave = (): void => { socket?.emit('party:leave', {}); };

/** Sauvegarde explicite de la partie (bouton disquette). */
export const partySave = (): void => { socket?.emit('party:save', {}); };

/** Supprime définitivement la partie (bouton poubelle, hôte uniquement).
 *  `roomId` optionnel : s'il est fourni (suppression depuis le lobby), on
 *  supprime cette room ; sinon on supprime la room courante du joueur. */
export const partyDelete = (roomId?: string): void => { socket?.emit('party:delete', roomId ? { roomId } : {}); };

/** Crée le personnage du joueur (job + stats réparties + avatar). */
export const partyCreateCharacter = (data: {
  name: string;
  job: string;
  stats: Record<string, number>;
  avatar?: string | null;
}): void => { socket?.emit('party:createCharacter', data); };

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

/** Émis en cas de **game over** (mode difficile, équipe anéantie sans or) :
 *  récapitulatif (dernier héros tombé + tueur + log du dernier tour). La
 *  partie est supprimée côté serveur. */
export function onGameOver(cb: (recap: { heroName: string; heroJob: string; killerName: string; lastTurnLog: string[] }) => void): void {
  socket?.on('game:over', ({ recap }: { recap: { heroName: string; heroJob: string; killerName: string; lastTurnLog: string[] } }) => cb(recap));
}
