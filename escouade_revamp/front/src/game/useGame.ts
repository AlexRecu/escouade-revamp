// Hook de partie : gère la connexion Socket.IO et l'état de session (temps réel).

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState } from '../types/game';
import {
  connectSocket,
  disconnectSocket,
  hubJoin,
  hubBuy,
  hubSell,
  hubEquip,
  hubRest,
  hubSanctuary,
  hubQuestBoard,
  hubAcceptQuest,
  hubCompleteZone,
  hubChangeHub,
  hubLeave,
  onState,
  onLog,
  onError,
} from '../api/socket';

export type GameActions = {
  join: () => void;
  buy: (itemName: string) => void;
  sell: (itemId: string) => void;
  equip: (memberId: string, itemId: string, hand: 'right' | 'left') => void;
  rest: () => void;
  sanctuary: (targetId: string) => void;
  questBoard: () => void;
  acceptQuest: (questId: string) => void;
  completeZone: (zoneId: string) => void;
  changeHub: (hubId: string) => void;
  leave: () => void;
};

export type UseGame = {
  state: GameState | null;
  logs: string[];
  connected: boolean;
  actions: GameActions;
};

/**
 * Hook qui connecte le socket (avec le token JWT), rejoint la ville courante
 * et expose l'état de session + les actions. L'état est mis à jour en temps
 * réel à chaque action (le serveur renvoie l'état sérialisé).
 */
export function useGame(): UseGame {
  const [state, setState] = useState<GameState | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const joinedRef = useRef(false);

  const pushLogs = useCallback((newLogs: string[]) => {
    setLogs((prev) => [...prev, ...newLogs].slice(-60));
  }, []);

  useEffect(() => {
    const socket = connectSocket();
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    onState((s) => setState(s));
    onLog(pushLogs);
    onError((msg) => pushLogs([`⚠️ ${msg}`]));

    // Rejoint la ville courante une fois connecté.
    const onConnect = () => {
      if (!joinedRef.current) {
        joinedRef.current = true;
        hubJoin();
      }
    };
    socket.on('connect', onConnect);
    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect);
      disconnectSocket();
    };
  }, [pushLogs]);

  const actions: GameActions = {
    join: hubJoin,
    buy: hubBuy,
    sell: hubSell,
    equip: hubEquip,
    rest: hubRest,
    sanctuary: hubSanctuary,
    questBoard: hubQuestBoard,
    acceptQuest: hubAcceptQuest,
    completeZone: hubCompleteZone,
    changeHub: hubChangeHub,
    leave: hubLeave,
  };

  return { state, logs, connected, actions };
}
