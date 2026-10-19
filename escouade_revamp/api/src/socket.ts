import { Server, Socket } from 'socket.io';
import { authMiddlewareSocket } from './middleware/authMiddleware';
import { HubSessionService } from './services/Hub/HubSessionService';
import { PartyRoomService } from './services/Hub/PartyRoomService';
import { ExplorationSessionService, Direction } from './services/dungeon/ExplorationSessionService';
import { PlayerModel } from './models/player.model';

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

  io.on('connection', async (socket: Socket) => {
    const playerId = socket.data.playerId as string;
    console.log(`🔌 Joueur connecté : ${playerId}`);

    // Charge le joueur (pseudo + room courante). Si le joueur est dans une
    // partie (room), on l'ajoute à la room Socket.IO pour recevoir le broadcast.
    const playerDoc = await PlayerModel.findById(playerId);
    const username = playerDoc?.username ?? 'Joueur';
    socket.data.username = username;
    socket.data.roomId = (playerDoc?.currentRoomId as string | null) ?? null;
    if (socket.data.roomId) socket.join(socket.data.roomId as string);

    /** Renvoie la room courante du joueur (null = mode solo). */
    const currentRoomId = (): string | null => (socket.data.roomId as string | null) ?? null;

    /**
     * Exécute une action de ville et diffuse le résultat.
     * - `broadcast=true` : émet à **toute la room** (multi-joueurs, l'équipe
     *   est partagée → tous les membres voient la mise à jour).
     * - `broadcast=false` : émet au seul joueur (solo).
     */
    const reply = async (action: () => Promise<any>, broadcast = false) => {
      try {
        const result = await action();
        const target = broadcast ? io.to(currentRoomId()!) : socket;
        if (result && result.state) target.emit('hub:state', { state: result.state });
        if (result && result.logs) target.emit('hub:log', { logs: result.logs });
        if (result && result.quests) target.emit('hub:quests', { quests: result.quests });
      } catch (err: any) {
        socket.emit('error', { message: err?.message ?? 'Erreur inconnue' });
      }
    };

    // ── Actions de ville (routées room / solo) ──────────────────────────────
    // Si le joueur est dans une partie (room), l'action mute l'état **partagé**
    // (PartyRoomService) et est diffusée à tous les membres. Sinon, mode solo
    // (HubSessionService).
    // `hub:join` : si le joueur est dans une partie (room), renvoie l'état de
    // la room (partagé). Sinon (pas de room), ne renvoie **rien** → le front
    // reste au lobby (plus de création de partie solo automatique).
    socket.on('hub:join', () =>
      reply(async () => {
        const roomId = currentRoomId();
        if (roomId) {
          const { room, session } = await PartyRoomService.getHubState(roomId);
          return { state: PartyRoomService.serializeRoom(room, session) };
        }
        return {}; // pas de room → pas d'état (le front reste au lobby)
      })
    );
    socket.on('hub:buy', (data: { itemName: string }) => {
      const roomId = currentRoomId();
      if (roomId) return reply(() => PartyRoomService.buy(roomId, data.itemName), true);
      return reply(() => HubSessionService.buy(playerId, data.itemName));
    });
    socket.on('hub:sell', (data: { itemId: string }) => {
      const roomId = currentRoomId();
      if (roomId) return reply(() => PartyRoomService.sell(roomId, data.itemId), true);
      return reply(() => HubSessionService.sell(playerId, data.itemId));
    });
    socket.on('hub:equip', (data: { memberId: string; itemId: string; hand: 'right' | 'left' }) => {
      const roomId = currentRoomId();
      if (roomId) return reply(() => PartyRoomService.equip(roomId, data.memberId, data.itemId, data.hand), true);
      return reply(() => HubSessionService.equip(playerId, data.memberId, data.itemId, data.hand));
    });
    socket.on('hub:rest', () => {
      const roomId = currentRoomId();
      if (roomId) return reply(() => PartyRoomService.rest(roomId), true);
      return reply(() => HubSessionService.rest(playerId));
    });
    socket.on('hub:sanctuary', (data: { targetId: string }) => {
      const roomId = currentRoomId();
      if (roomId) return reply(() => PartyRoomService.sanctuary(roomId, data.targetId), true);
      return reply(() => HubSessionService.sanctuary(playerId, data.targetId));
    });
    socket.on('hub:questBoard', () => {
      const roomId = currentRoomId();
      if (roomId) return reply(() => PartyRoomService.questBoard(roomId));
      return reply(() => HubSessionService.questBoard(playerId));
    });
    socket.on('hub:acceptQuest', (data: { questId: string }) => {
      const roomId = currentRoomId();
      if (roomId) return reply(() => PartyRoomService.acceptQuest(roomId, data.questId), true);
      return reply(() => HubSessionService.acceptQuest(playerId, data.questId));
    });
    socket.on('hub:changeHub', (data: { hubId: string }) =>
      reply(async () => {
        const roomId = currentRoomId();
        if (roomId) return { state: await PartyRoomService.changeHub(roomId, data.hubId) };
        return { state: await HubSessionService.changeHub(playerId, data.hubId) };
      }, currentRoomId() !== null)
    );
    socket.on('hub:completeZone', (data: { zoneId: string }) =>
      reply(async () => {
        const roomId = currentRoomId();
        if (roomId) return { state: await PartyRoomService.completeZone(roomId, data.zoneId) };
        return { state: await HubSessionService.completeZone(playerId, data.zoneId) };
      }, currentRoomId() !== null)
    );
    socket.on('hub:leave', () => {
      HubSessionService.leave(playerId);
      socket.emit('hub:log', { logs: ['Vous quittez la ville.'] });
    });

    // ── Lobby de parties (multi-joueurs) ────────────────────────────────────
    // Liste / crée / rejoint / quitte des parties. `party:updated` est émis à
    // tous pour rafraîchir le lobby (une room a été créée/rejointe/quitte).
    socket.on('party:list', () => {
      PartyRoomService.list()
        .then((rooms) => socket.emit('party:list', { rooms }))
        .catch((err) => socket.emit('error', { message: err?.message ?? 'Erreur' }));
    });

    socket.on('party:create', (data: { name?: string; isPublic?: boolean; maxPlayers?: number }) => {
      PartyRoomService.create(
        playerId,
        username,
        data?.name ?? '',
        data?.isPublic ?? true,
        data?.maxPlayers ?? 4
      )
        .then(async (room) => {
          socket.data.roomId = room.roomId;
          socket.join(room.roomId);
          io.emit('party:updated', {}); // rafraîchit le lobby de tous
          const { session } = await PartyRoomService.getHubState(room.roomId);
          socket.emit('hub:state', { state: PartyRoomService.serializeRoom(room, session) });
        })
        .catch((err) => socket.emit('error', { message: err?.message ?? 'Erreur' }));
    });

    socket.on('party:join', (data: { roomId: string; isSpectator?: boolean }) => {
      PartyRoomService.join(playerId, username, data.roomId, data?.isSpectator ?? false)
        .then(async (room) => {
          const oldRoom = socket.data.roomId as string | null;
          if (oldRoom && oldRoom !== room.roomId) socket.leave(oldRoom);
          socket.data.roomId = room.roomId;
          socket.join(room.roomId);
          io.emit('party:updated', {}); // rafraîchit le lobby de tous
          // Notifie la room (liste des membres à jour) + renvoie l'état au
          // joueur qui rejoint.
          const { session } = await PartyRoomService.getHubState(room.roomId);
          const state = PartyRoomService.serializeRoom(room, session);
          io.to(room.roomId).emit('hub:state', { state });
        })
        .catch((err) => socket.emit('error', { message: err?.message ?? 'Erreur' }));
    });

    socket.on('party:leave', () => {
      const roomId = currentRoomId();
      if (!roomId) return;
      PartyRoomService.leave(playerId, roomId)
        .then(async () => {
          socket.leave(roomId);
          socket.data.roomId = null;
          io.emit('party:updated', {}); // rafraîchit le lobby de tous
          // Si la room n'est plus vide, on met à jour les membres restants.
          const remaining = await PartyRoomService.model.findOne({ roomId });
          if (remaining) {
            const { session } = await PartyRoomService.getHubState(roomId);
            io.to(roomId).emit('hub:state', { state: PartyRoomService.serializeRoom(remaining, session) });
          }
          socket.emit('party:left', {}); // le joueur retourne au lobby
        })
        .catch((err) => socket.emit('error', { message: err?.message ?? 'Erreur' }));
    });

    // `party:createCharacter` — un joueur crée SON personnage (job + stats
    // réparties + avatar). Le perso est ajouté à l'équipe partagée et l'état
    // est diffusé à toute la partie (chaque joueur voit l'équipe se compléter
    // en temps réel).
    socket.on('party:createCharacter', (data: { name: string; job: string; stats: Record<string, number>; avatar?: string }) => {
      const roomId = currentRoomId();
      if (!roomId) {
        socket.emit('error', { message: "Vous n'êtes dans aucune partie." });
        return;
      }
      PartyRoomService.createCharacter(roomId, playerId, data)
        .then(({ logs, state }) => {
          io.to(roomId).emit('hub:log', { logs });
          io.to(roomId).emit('hub:state', { state });
        })
        .catch((err) => socket.emit('error', { message: err?.message ?? 'Erreur' }));
    });

    // ── Exploration des donjons (mode déplacement) ──────────────────────────
    // Exécute une action d'exploration et renvoie l'état de la grille au
    // client via `exploration:state` (+ logs via `exploration:log`). En mode
    // room, l'état est **diffusé** à tous les membres (donjon partagé).
    const replyExploration = async (action: () => Promise<any>, broadcast = false) => {
      try {
        const result = await action();
        const target = broadcast ? io.to(currentRoomId()!) : socket;
        if (result && result.state) target.emit('exploration:state', { state: result.state });
        if (result && result.logs) target.emit('exploration:log', { logs: result.logs });
        // Sortie de donjon (fin atteinte) → le front revient à la mappemonde.
        if (result && result.exited) target.emit('exploration:exited', {});
      } catch (err: any) {
        socket.emit('error', { message: err?.message ?? 'Erreur inconnue' });
      }
    };

    /** Clé de la session d'exploration (roomId en room, playerId en solo). */
    const explorationKey = (): string => currentRoomId() ?? playerId;

    /**
     * Après une sortie de donjon (volontaire ou auto), resynchronise la session
     * de ville et émet `hub:state` → le front met à jour `completedZones` /
     * `worldLevel` (brouillard de guerre + boutique).
     */
    const refreshHub = async (broadcast = false) => {
      const roomId = currentRoomId();
      if (roomId) {
        const { room, session } = await PartyRoomService.getHubState(roomId);
        const state = PartyRoomService.serializeRoom(room, session);
        (broadcast ? io.to(roomId) : socket).emit('hub:state', { state });
      } else {
        const state = await HubSessionService.refresh(playerId);
        if (state) socket.emit('hub:state', { state });
      }
    };

    socket.on('exploration:enter', (data: { dungeonId: string }) =>
      replyExploration(async () => {
        const roomId = currentRoomId();
        if (roomId) return { state: await ExplorationSessionService.enterDungeonRoom(roomId, data.dungeonId) };
        return { state: await ExplorationSessionService.enterDungeon(playerId, data.dungeonId) };
      }, currentRoomId() !== null)
    );
    socket.on('exploration:move', (data: { direction: Direction }) =>
      replyExploration(async () => {
        const result = await ExplorationSessionService.move(explorationKey(), data.direction);
        if (result.exited) await refreshHub(currentRoomId() !== null);
        return result;
      }, currentRoomId() !== null)
    );
    socket.on('exploration:rest', () =>
      replyExploration(() => ExplorationSessionService.restAtCampfire(explorationKey()), currentRoomId() !== null)
    );
    socket.on('exploration:exit', () =>
      replyExploration(async () => {
        const result = await ExplorationSessionService.exitDungeon(explorationKey());
        await refreshHub(currentRoomId() !== null);
        return result;
      }, currentRoomId() !== null)
    );

    socket.on('disconnect', () => {
      // Libère les sessions en mémoire (l'état est déjà persisté).
      HubSessionService.leave(playerId);
      ExplorationSessionService.exitDungeon(explorationKey()).catch(() => {});
      console.log(`🔌 Joueur déconnecté : ${playerId}`);
    });
  });
};