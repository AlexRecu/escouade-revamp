// Hook de partie : gère la connexion Socket.IO et l'état de session (temps réel).

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState, ExplorationState } from '../types/game';
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
  explorationEnter,
  explorationMove,
  explorationRest,
  explorationExit,
  type ExplorationDirection,
  onState,
  onLog,
  onError,
  onExplorationState,
  onExplorationLog,
  onExplorationExited,
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
  // Exploration des donjons.
  explorationEnter: (dungeonId: string) => void;
  explorationMove: (direction: ExplorationDirection) => void;
  explorationRest: () => void;
  explorationExit: () => void;
};

export type UseGame = {
  state: GameState | null;
  logs: string[];
  connected: boolean;
  actions: GameActions;
  /** État d'exploration courant (null si l'équipe n'est pas dans un donjon). */
  exploration: ExplorationState | null;
  /**
   * Enregistre un callback appelé quand le donjon est terminé (porte de
   * sortie atteinte) → le front peut revenir à la mappemonde (auto-sortie).
   */
  setExplorationExitedHandler: (cb: (() => void) | null) => void;
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
  const [exploration, setExploration] = useState<ExplorationState | null>(null);
  const joinedRef = useRef(false);
  // Callback d'auto-sortie (donjon terminé) — stocké en ref pour ne pas
  // resouscrire l'abonnement à chaque render.
  const exitedHandlerRef = useRef<(() => void) | null>(null);

  const pushLogs = useCallback((newLogs: string[]) => {
    setLogs((prev) => [...prev, ...newLogs].slice(-60));
  }, []);

  const setExplorationExitedHandler = useCallback((cb: (() => void) | null) => {
    exitedHandlerRef.current = cb;
  }, []);

  useEffect(() => {
    const socket = connectSocket();
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    onState((s) => setState(s));
    onLog(pushLogs);
    onError((msg) => pushLogs([`⚠️ ${msg}`]));
    onExplorationState((s) => setExploration(s));
    onExplorationLog(pushLogs);
    onExplorationExited(() => {
      setExploration(null);
      exitedHandlerRef.current?.();
    });

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
    explorationEnter,
    explorationMove,
    explorationRest,
    explorationExit,
  };

  return { state, logs, connected, actions, exploration, setExplorationExitedHandler };
}
