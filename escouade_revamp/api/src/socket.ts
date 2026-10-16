import { Server, Socket } from 'socket.io';
import { authMiddlewareSocket } from './middleware/authMiddleware';
import { HubSessionService } from './services/Hub/HubSessionService';
import { ExplorationSessionService, Direction } from './services/dungeon/ExplorationSessionService';

/**
 * Câblage Socket.IO du mode ville (temps réel).
 *
 * Le front se connecte avec le token JWT (handshake.auth.token). Une fois
 * authentifié, le joueur envoie des **actions de ville** et reçoit l'état
 * sérialisé en retour. Chaque action est persistée (voir `HubSessionService`).
 *
 * Événements (client → serveur) :
 *  - `hub:join`        {}            → rejoint la ville courante
 *  - `hub:buy`         { itemName }  → achète un objet (consommable ou arme)
 *  - `hub:sell`        { itemId }    → revend un objet du sac
 *  - `hub:equip`       { memberId, itemId, hand } → équipe une arme (right/left)
 *  - `hub:rest`        {}            → nuit à l'auberge
 *  - `hub:sanctuary`   { targetId }  → ranime un allié mort
 *  - `hub:questBoard`  {}            → liste les quêtes disponibles
 *  - `hub:acceptQuest` { questId }   → accepte une quête
 *  - `hub:changeHub`   { hubId }     → entre dans une autre ville
 *  - `hub:completeZone`{ zoneId }    → termine une zone (démo) : monte worldLevel
 *  - `hub:leave`       {}            → quitte la ville
 *
 * Événements (serveur → client) :
 *  - `hub:state`  { state }   → état de session complet (après chaque action)
 *  - `hub:log`    { logs }    → logs de l'action
 *  - `hub:quests` { quests }  → quêtes disponibles (tableau)
 *  - `error`      { message } → erreur
 */
export const initializeSocket = (io: Server) => {
  io.use(authMiddlewareSocket);

  io.on('connection', (socket: Socket) => {
    const playerId = socket.data.playerId as string;
    console.log(`🔌 Joueur connecté : ${playerId}`);

    /** Exécute une action, renvoie état/logs au client, gère les erreurs. */
    const reply = async (action: () => Promise<any>) => {
      try {
        const result = await action();
        if (result && result.state) socket.emit('hub:state', { state: result.state });
        if (result && result.logs) socket.emit('hub:log', { logs: result.logs });
        if (result && result.quests) socket.emit('hub:quests', { quests: result.quests });
      } catch (err: any) {
        socket.emit('error', { message: err?.message ?? 'Erreur inconnue' });
      }
    };

    // NB : join/changeHub retournent l'état directement → on l'enveloppe
    // dans { state } pour que `reply` l'émette correctement.
    socket.on('hub:join', () =>
      reply(async () => ({ state: await HubSessionService.join(playerId) }))
    );
    socket.on('hub:buy', (data: { itemName: string }) =>
      reply(() => HubSessionService.buy(playerId, data.itemName))
    );
    socket.on('hub:sell', (data: { itemId: string }) =>
      reply(() => HubSessionService.sell(playerId, data.itemId))
    );
    socket.on('hub:equip', (data: { memberId: string; itemId: string; hand: 'right' | 'left' }) =>
      reply(() => HubSessionService.equip(playerId, data.memberId, data.itemId, data.hand))
    );
    socket.on('hub:rest', () => reply(() => HubSessionService.rest(playerId)));
    socket.on('hub:sanctuary', (data: { targetId: string }) =>
      reply(() => HubSessionService.sanctuary(playerId, data.targetId))
    );
    socket.on('hub:questBoard', () => reply(() => HubSessionService.questBoard(playerId)));
    socket.on('hub:acceptQuest', (data: { questId: string }) =>
      reply(() => HubSessionService.acceptQuest(playerId, data.questId))
    );
    socket.on('hub:changeHub', (data: { hubId: string }) =>
      reply(async () => ({ state: await HubSessionService.changeHub(playerId, data.hubId) }))
    );
    socket.on('hub:completeZone', (data: { zoneId: string }) =>
      reply(async () => ({ state: await HubSessionService.completeZone(playerId, data.zoneId) }))
    );
    socket.on('hub:leave', () => {
      HubSessionService.leave(playerId);
      socket.emit('hub:log', { logs: ['Vous quittez la ville.'] });
    });

    // ── Exploration des donjons (mode déplacement) ──────────────────────────
    // Exécute une action d'exploration et renvoie l'état de la grille au
    // client via `exploration:state` (+ logs via `exploration:log`).
    const replyExploration = async (action: () => Promise<any>) => {
      try {
        const result = await action();
        if (result && result.state) socket.emit('exploration:state', { state: result.state });
        if (result && result.logs) socket.emit('exploration:log', { logs: result.logs });
      } catch (err: any) {
        socket.emit('error', { message: err?.message ?? 'Erreur inconnue' });
      }
    };

    socket.on('exploration:enter', (data: { dungeonId: string }) =>
      replyExploration(async () => ({ state: await ExplorationSessionService.enterDungeon(playerId, data.dungeonId) }))
    );
    socket.on('exploration:move', (data: { direction: Direction }) =>
      replyExploration(() => ExplorationSessionService.move(playerId, data.direction))
    );
    socket.on('exploration:rest', () =>
      replyExploration(() => ExplorationSessionService.restAtCampfire(playerId))
    );
    socket.on('exploration:exit', () =>
      replyExploration(async () => ({ logs: (await ExplorationSessionService.exitDungeon(playerId)).logs }))
    );

    socket.on('disconnect', () => {
      // Libère les sessions en mémoire (l'état est déjà persisté).
      HubSessionService.leave(playerId);
      ExplorationSessionService.exitDungeon(playerId).catch(() => {});
      console.log(`🔌 Joueur déconnecté : ${playerId}`);
    });
  });
};