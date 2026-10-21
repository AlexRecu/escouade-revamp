// Hook de partie : gère la connexion Socket.IO et l'état de session (temps réel).

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState, ExplorationState, RoomSummary, CombatState } from '../types/game';
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
  hubCaravan,
  hubLeave,
  explorationEnter,
  explorationMove,
  explorationRest,
  explorationChest,
  explorationExit,
  combatPlace,
  combatConfirmPlacement,
  combatMove,
  combatAct,
  combatEndTurn,
  combatAiStep,
  combatFlee,
  combatEnd,
  combatSubmitStats,
  partyList,
  partyCreate,
  partyJoin,
  partyLeave,
  partyCreateCharacter,
  type ExplorationDirection,
  onState,
  onLog,
  onError,
  onExplorationState,
  onExplorationLog,
  onExplorationExited,
  onExplorationLevelUps,
  onCombatState,
  onPartyList,
  onPartyUpdated,
  onPartyLeft,
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
  caravan: (destHubId: string) => void;
  leave: () => void;
  // Exploration des donjons.
  explorationEnter: (dungeonId: string) => void;
  explorationMove: (direction: ExplorationDirection) => void;
  explorationRest: () => void;
  explorationChest: () => void;
  explorationExit: () => void;
  // Combat interactif.
  combatPlace: (unitId: string, position: { row: number; col: number }) => void;
  combatConfirmPlacement: () => void;
  combatMove: (unitId: string, position: { row: number; col: number }) => void;
  combatAct: (
    unitId: string,
    action: 'attack' | 'spell' | 'skill' | 'item' | 'combo',
    targetId: string | null,
    extra?: { spell?: { name: string }; skill?: { name: string }; item?: any; combo?: string[] }
  ) => void;
  combatEndTurn: (unitId: string) => void;
  combatAiStep: () => void;
  combatFlee: () => void;
  combatEnd: () => void;
  /** Soumet les stats choisies pour les montées de niveau reportées. */
  combatSubmitStats: (choices: { characterId: string; stat: string }[]) => void;
  // Lobby de parties (multi-joueurs).
  partyList: () => void;
  partyCreate: (opts: { name?: string; isPublic?: boolean; maxPlayers?: number }) => void;
  partyJoin: (roomId: string, isSpectator?: boolean) => void;
  partyLeave: () => void;
  /** Crée le personnage du joueur (job + stats réparties + avatar). */
  partyCreateCharacter: (data: {
    name: string;
    job: string;
    stats: Record<string, number>;
    avatar?: string | null;
  }) => void;
};

export type UseGame = {
  state: GameState | null;
  logs: string[];
  connected: boolean;
  actions: GameActions;
  /** Liste des parties publiques (pour le lobby). */
  rooms: RoomSummary[];
  /** Dernière erreur serveur (ex. création de personnage refusée). */
  error: string | null;
  /** true si le joueur est dans une partie (room) — sinon il est au lobby. */
  inRoom: boolean;
  /** État d'exploration courant (null si l'équipe n'est pas dans un donjon). */
  exploration: ExplorationState | null;
  /** État de combat courant (null si pas de combat en cours). */
  combat: CombatState | null;
  /** Montées de niveau reportées (stat à choisir) — non vide = afficher
   *  l'écran de choix de stat. */
  pendingLevelUps: { characterId: string; name: string; level: number }[];
  /**
   * Enregistre un callback appelé quand le donjon est terminé (porte de
   * sortie atteinte) → le front peut revenir à la mappemonde (auto-sortie).
   */
  setExplorationExitedHandler: (cb: (() => void) | null) => void;
  /**
   * Enregistre un callback appelé quand la connexion socket est **refusée**
   * (token invalide ou expiré) → le front peut renvoyer vers l'écran de
   * connexion (re-login).
   */
  setAuthErrorHandler: (cb: (() => void) | null) => void;
};

/**
 * Hook qui connecte le socket (avec le token JWT), rejoint la ville courante
 * et expose l'état de session + les actions. L'état est mis à jour en temps
 * réel à chaque action (le serveur renvoie l'état sérialisé).
 *
 * @param token le token JWT courant (null si pas connecté). Quand il passe de
 *   null à une valeur (premier login), le socket est **re-connecté** avec le
 *   token — sinon il serait connecté sans token et refusé par le middleware.
 */
export function useGame(token: string | null): UseGame {
  const [state, setState] = useState<GameState | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [exploration, setExploration] = useState<ExplorationState | null>(null);
  const [combat, setCombat] = useState<CombatState | null>(null);
  const [pendingLevelUps, setPendingLevelUps] = useState<{ characterId: string; name: string; level: number }[]>([]);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  // Dernière erreur serveur (ex. création de personnage refusée) — affichée
  // dans l'écran courant puis effacée au prochain état valide.
  const [error, setError] = useState<string | null>(null);
  const joinedRef = useRef(false);
  // Callback d'auto-sortie (donjon terminé) — stocké en ref pour ne pas
  // resouscrire l'abonnement à chaque render.
  const exitedHandlerRef = useRef<(() => void) | null>(null);
  // Callback d'erreur d'auth (token invalide/expiré) — renvoie vers le login.
  const authErrorHandlerRef = useRef<(() => void) | null>(null);

  const pushLogs = useCallback((newLogs: string[]) => {
    setLogs((prev) => [...prev, ...newLogs].slice(-60));
  }, []);

  const setExplorationExitedHandler = useCallback((cb: (() => void) | null) => {
    exitedHandlerRef.current = cb;
  }, []);

  const setAuthErrorHandler = useCallback((cb: (() => void) | null) => {
    authErrorHandlerRef.current = cb;
  }, []);

  useEffect(() => {
    // Pas de token (pas connecté) → pas de socket. On attend le login.
    if (!token) {
      setConnected(false);
      return;
    }

    // Nouveau token = nouveau joueur → on doit re-rejoindre la ville.
    joinedRef.current = false;

    const socket = connectSocket();
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    // Connexion refusée par le serveur (token invalide/expiré) → on renvoie
    // vers l'écran de connexion pour que le joueur se reconnecte.
    socket.on('connect_error', (err: Error) => {
      if (err?.message?.includes('Authentication error')) {
        setConnected(false);
        authErrorHandlerRef.current?.();
      }
    });

    onState((s) => {
      setState(s);
      setError(null); // un état valide efface la dernière erreur
      // Un état de **ville** reçu = l'équipe n'est plus dans le donjon. On
      // invalide l'état d'exploration/combat en mémoire : sinon un ancien état
      // d'exploration (PV bas, avant un soin à l'auberge) persisterait et le
      // PartySidebar le fusionnerait sur l'état de ville → PV « redescendus ».
      setExploration(null);
      setCombat(null);
    });
    onLog(pushLogs);
    onError((msg) => {
      setError(msg);
      pushLogs([`⚠️ ${msg}`]);
    });
    onExplorationState((s) => {
      setExploration(s);
      // Un nouvel état d'exploration = le combat est terminé (butin/défaite
      // appliqués) → on quitte la vue de combat.
      setCombat(null);
    });
    onExplorationLog(pushLogs);
    onExplorationExited(() => {
      setExploration(null);
      setPendingLevelUps([]);
      exitedHandlerRef.current?.();
    });
    // Montées de niveau reportées → on affiche l'écran de choix de stat.
    onExplorationLevelUps((levelUps) => {
      setPendingLevelUps(levelUps);
    });
    // Combat : on met à jour l'état du plateau. Quand le combat est terminé
    // (result !== "ongoing"), on demande au serveur d'appliquer le résultat
    // (butin / défaite) → il renvoie l'état d'exploration et on quitte le combat.
    onCombatState((s) => {
      setCombat(s);
      if (s.result !== 'ongoing') {
        combatEnd();
      }
    });

    // Lobby de parties : liste des parties publiques + rafraîchissement à
    // chaque création/rejoindre/quitte. Quand le joueur quitte sa partie,
    // on retourne au lobby (state nulle → inRoom false).
    onPartyList((rs) => setRooms(rs));
    onPartyUpdated(() => partyList());
    onPartyLeft(() => {
      setState(null);
      setExploration(null);
      partyList();
    });

    // Une fois connecté : demande l'état de la room courante (si le joueur en
    // est dans une) + la liste des parties pour le lobby.
    const onConnect = () => {
      if (!joinedRef.current) {
        joinedRef.current = true;
        hubJoin();
        partyList();
      }
    };
    socket.on('connect', onConnect);
    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect);
      disconnectSocket();
    };
  }, [pushLogs, token]);

  // Le joueur est dans une partie si l'état reçu porte un bloc `room`.
  const inRoom = !!state?.room;

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
    caravan: hubCaravan,
    leave: hubLeave,
    explorationEnter,
    explorationMove,
    explorationRest,
    explorationChest,
    explorationExit,
    combatPlace,
    combatConfirmPlacement,
    combatMove,
    combatAct,
    combatEndTurn,
    combatAiStep,
    combatFlee,
    combatEnd,
    combatSubmitStats: (choices: { characterId: string; stat: string }[]) => {
      combatSubmitStats(choices);
      // On ferme l'écran de choix dès la soumission (l'état d'exploration
      // renvoyé par le serveur confirmera la mise à jour des stats).
      setPendingLevelUps([]);
    },
    partyList,
    partyCreate,
    partyJoin,
    partyLeave,
    partyCreateCharacter,
  };

  return { state, logs, connected, actions, rooms, error, inRoom, exploration, combat, pendingLevelUps, setExplorationExitedHandler, setAuthErrorHandler };
}
