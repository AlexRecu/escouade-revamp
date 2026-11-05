// Hook de partie : gère la connexion Socket.IO et l'état de session (temps réel).

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState, ExplorationState, RoomSummary, CombatState, GameOverRecap } from '../types/game';
import {
  connectSocket,
  disconnectSocket,
  hubJoin,
  hubBuy,
  hubSell,
  hubEquip,
  hubUseItem,
  hubRest,
  hubSanctuary,
  hubCastSpell,
  hubForgetAbility,
  hubQuestBoard,
  hubAcceptQuest,
  hubTalk,
  hubCompleteZone,
  hubChangeHub,
  hubCaravan,
  hubLeave,
  explorationEnter,
  explorationMove,
  explorationRest,
  explorationUseWood,
  explorationChest,
  explorationExit,
  explorationEquip,
  explorationUseItem,
  explorationCastSpell,
  explorationForgetAbility,
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
  partySave,
  partyRename,
  partyDelete,
  partyCreateCharacter,
  type ExplorationDirection,
  onState,
  onLog,
  onError,
  onToast,
  onExplorationState,
  onExplorationLog,
  onExplorationExited,
  onExplorationLevelUps,
  onCombatState,
  onPartyList,
  onPartyUpdated,
  onPartyRenamed,
  onPartyLeft,
  onGameOver,
} from '../api/socket';

export type GameActions = {
  join: () => void;
  buy: (itemName: string) => void;
  sell: (itemId: string) => void;
  equip: (memberId: string, itemId: string, hand: 'right' | 'left') => void;
  useItem: (memberId: string, itemId: string, targetId?: string) => void;
  rest: () => void;
  sanctuary: (targetId: string) => void;
  /** Lance un sort de soin (cible alliée) hors combat (ville ou donjon). */
  castSpell: (casterId: string, targetId: string, spellName: string) => void;
  /** Oublie une compétence/sort appris (Mage bleu) — ville ou donjon. */
  forgetAbility: (memberId: string, abilityName: string) => void;
  questBoard: () => void;
  acceptQuest: (questId: string) => void;
  /** Parler à un PNJ de la ville (dialogue + étapes de quête + récompenses). */
  talk: (npcName: string) => void;
  completeZone: (zoneId: string) => void;
  changeHub: (hubId: string) => void;
  caravan: (destHubId: string) => void;
  leave: () => void;
  // Exploration des donjons.
  explorationEnter: (dungeonId: string) => void;
  explorationMove: (direction: ExplorationDirection) => void;
  explorationRest: () => void;
  explorationUseWood: () => void;
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
  /** Valide la fin du combat (quitte l'écran de relecture → exploration). */
  confirmCombatEnd: () => void;
  /** Soumet les stats choisies pour les montées de niveau reportées. */
  combatSubmitStats: (choices: { characterId: string; stat: string }[]) => void;
  // Lobby de parties (multi-joueurs).
  partyList: () => void;
  partyCreate: (opts: { name?: string; isPublic?: boolean; maxPlayers?: number }) => void;
  partyJoin: (roomId: string, isSpectator?: boolean) => void;
  partyLeave: () => void;
  /** Sauvegarde explicite de la partie (bouton disquette). */
  partySave: () => void;
  /** Renomme la partie courante (bouton crayon, hôte uniquement). */
  partyRename: (name: string) => void;
  /** Supprime définitivement la partie (bouton poubelle, hôte uniquement).
   *  `roomId` optionnel : suppression depuis le lobby (room ciblée) ou room courante. */
  partyDelete: (roomId?: string) => void;
  /** Crée le personnage du joueur (job + stats réparties + avatar). */
  partyCreateCharacter: (data: {
    name: string;
    job: string;
    stats: Record<string, number>;
    avatar?: string | null;
  }) => void;
};

/** Notification éphémère (toast) affichée en surimpression. */
export type Toast = { id: number; message: string; type: 'info' | 'success' | 'error' };

export type UseGame = {
  state: GameState | null;
  logs: string[];
  connected: boolean;
  actions: GameActions;
  /** Notifications éphémères (toasts) à afficher en surimpression. */
  toasts: Toast[];
  /** Liste des parties publiques (pour le lobby). */
  rooms: RoomSummary[];
  /** true tant que la liste des parties n'a pas été reçue (spinner lobby). */
  roomsLoading: boolean;
  /** Dernière erreur serveur (ex. création de personnage refusée). */
  error: string | null;
  /** true si le joueur est dans une partie (room) — sinon il est au lobby. */
  inRoom: boolean;
  /** État d'exploration courant (null si l'équipe n'est pas dans un donjon). */
  exploration: ExplorationState | null;
  /** État de combat courant (null si pas de combat en cours). */
  combat: CombatState | null;
  /** true si on est en phase de **validation de fin de combat** (relecture du
   *  journal : dégâts + butin/XP + montée de niveau) avant de passer à la suite. */
  combatEndPending: boolean;
  /** Logs de butin/XP capturés pendant la phase de validation (pour l'écran
   *  de relecture, en complément du journal de combat). */
  combatEndLogs: string[];
  /** Montées de niveau reportées (stat à choisir) — non vide = afficher
   *  l'écran de choix de stat. */
  pendingLevelUps: { characterId: string; name: string; level: number }[];
  /** Récap de **game over** (mode difficile) — non null = afficher l'écran. */
  gameOver: GameOverRecap | null;
  /** Ferme l'écran de game over (retour au lobby). */
  dismissGameOver: () => void;
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
export function useGame(token: string | null, confirmCombatEnd = false): UseGame {
  const [state, setState] = useState<GameState | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [exploration, setExploration] = useState<ExplorationState | null>(null);
  const [combat, setCombat] = useState<CombatState | null>(null);
  // Phase de validation de fin de combat (relecture du journal avant de
  // passer à la suite). `combatEndPending` = on est en relecture ;
  // `combatEndLogs` = logs de butin/XP capturés pendant la relecture.
  const [combatEndPending, setCombatEndPending] = useState(false);
  const [combatEndLogs, setCombatEndLogs] = useState<string[]>([]);
  const [pendingLevelUps, setPendingLevelUps] = useState<{ characterId: string; name: string; level: number }[]>([]);
  const [gameOver, setGameOver] = useState<GameOverRecap | null>(null);
  // Refs miroir (lues par les handlers socket, qui sont dans une closure aux
  // deps [pushLogs, pushToast, token] — on évite de resouscrire le socket à
  // chaque changement de réglage).
  const confirmEndRef = useRef(confirmCombatEnd);
  confirmEndRef.current = confirmCombatEnd;
  const combatEndPendingRef = useRef(false);
  combatEndPendingRef.current = combatEndPending;
  // Sortie de donjon différée : si le combat se termine ET que le donjon est
  // quitté (cas rare), on diffère la navigation vers la mappemonde jusqu'à la
  // validation de fin de combat.
  const exitedDeferredRef = useRef(false);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  // true tant que la 1re liste des parties n'a pas été reçue (spinner lobby).
  const [roomsLoading, setRoomsLoading] = useState(true);
  // Notifications éphémères (toasts) : sauvegarde, nouvel aventurier, renommage.
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Compteur d'ids de toasts (stable, hors render).
  const toastIdRef = useRef(0);
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

  // Ajoute un toast (auto-dismiss après 3,5 s). L'auto-dismiss est géré par
  // setTimeout : on retire le toast par son id quand le délai est écoulé.
  const pushToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const setExplorationExitedHandler = useCallback((cb: (() => void) | null) => {
    exitedHandlerRef.current = cb;
  }, []);

  const setAuthErrorHandler = useCallback((cb: (() => void) | null) => {
    authErrorHandlerRef.current = cb;
  }, []);

  const dismissGameOver = useCallback(() => {
    const mode = gameOver?.mode;
    setGameOver(null);
    if (mode === 'hard') {
      // Game over définitif : retour au lobby.
      setState(null);
      setExploration(null);
      setCombat(null);
      partyList();
    }
    // mode easy : on reste en ville (l'état est déjà à jour via hub:state).
  }, [gameOver, partyList]);

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
    onToast((t) => pushToast(t.message, t.type));
    onExplorationState((s) => {
      setExploration(s);
      // Un nouvel état d'exploration = le combat est terminé (butin/défaite
      // appliqués). En phase de validation de fin de combat, on NE quitte PAS
      // la vue de combat (le joueur relit le journal) ; sinon on quitte.
      if (!combatEndPendingRef.current) setCombat(null);
    });
    onExplorationLog((newLogs) => {
      pushLogs(newLogs);
      // En phase de validation, on capture les logs de butin/XP pour l'écran
      // de relecture (ils arrivent via exploration:log après combatEnd).
      if (combatEndPendingRef.current) {
        setCombatEndLogs((prev) => [...prev, ...newLogs]);
      }
    });
    onExplorationExited(() => {
      // Sortie de donjon : en phase de validation, on diffère la navigation
      // vers la mappemonde (le joueur valide d'abord la fin du combat).
      if (combatEndPendingRef.current) {
        exitedDeferredRef.current = true;
        return;
      }
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
    // Si le réglage « valider la fin du combat » est actif, on entre en phase
    // de relecture (on garde l'écran de combat visible) au lieu de quitter.
    onCombatState((s) => {
      setCombat(s);
      if (s.result !== 'ongoing') {
        if (confirmEndRef.current) {
          setCombatEndPending(true);
          setCombatEndLogs([]);
          exitedDeferredRef.current = false;
        }
        combatEnd();
      }
    });

    // Lobby de parties : liste des parties publiques + rafraîchissement à
    // chaque création/rejoindre/quitte. Quand le joueur quitte sa partie,
    // on retourne au lobby (state nulle → inRoom false).
    onPartyList((rs) => {
      setRooms(rs);
      setRoomsLoading(false);
    });
    onPartyUpdated(() => partyList());
    onPartyRenamed((name) => {
      // Met à jour le nom de la room SANS toucher à exploration/combat.
      setState((prev) => prev?.room ? { ...prev, room: { ...prev.room, name } } : prev);
    });
    onPartyLeft(() => {
      setState(null);
      setExploration(null);
      partyList();
    });
    // Game over (mode difficile) : on affiche l'écran de récap. La partie est
    // supprimée côté serveur ; le joueur retourne au lobby en fermant l'écran.
    onGameOver((recap) => {
      setCombat(null);
      setExploration(null);
      setGameOver(recap);
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

    // Filet de sécurité : si la 1re liste des parties n'arrive pas (requête
    // échouée / socket instable au démarrage), on lève le spinner après 5 s
    // pour ne jamais bloquer le lobby (le bouton « Actualiser » reste dispo).
    const roomsTimeout = window.setTimeout(() => setRoomsLoading(false), 5000);

    return () => {
      socket.off('connect', onConnect);
      window.clearTimeout(roomsTimeout);
      disconnectSocket();
    };
  }, [pushLogs, pushToast, token]);

  // Le joueur est dans une partie si l'état reçu porte un bloc `room`.
  const inRoom = !!state?.room;

  const actions: GameActions = {
    join: hubJoin,
    buy: hubBuy,
    sell: hubSell,
    // En donjon, l'équipement/les objets opèrent sur l'équipe en mémoire de la
    // session (pas sur la partie DB, stale pendant le donjon).
    equip: (memberId, itemId, hand) =>
      exploration ? explorationEquip(memberId, itemId, hand) : hubEquip(memberId, itemId, hand),
    useItem: (memberId, itemId, targetId) =>
      exploration ? explorationUseItem(memberId, itemId, targetId) : hubUseItem(memberId, itemId),
    rest: hubRest,
    sanctuary: hubSanctuary,
    // Sort de soin hors combat : en donjon, opère sur l'équipe en mémoire de
    // la session ; sinon (ville / mappemonde), sur la partie.
    castSpell: (casterId, targetId, spellName) =>
      exploration ? explorationCastSpell(casterId, targetId, spellName) : hubCastSpell(casterId, targetId, spellName),
    // Oublier une capacité apprise : en donjon, opère sur l'équipe en mémoire
    // de la session ; sinon (ville / mappemonde), sur la partie.
    forgetAbility: (memberId, abilityName) =>
      exploration ? explorationForgetAbility(memberId, abilityName) : hubForgetAbility(memberId, abilityName),
    questBoard: hubQuestBoard,
    acceptQuest: hubAcceptQuest,
    talk: hubTalk,
    completeZone: hubCompleteZone,
    changeHub: hubChangeHub,
    caravan: hubCaravan,
    leave: hubLeave,
    explorationEnter,
    explorationMove,
    explorationRest,
    explorationUseWood,
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
    confirmCombatEnd: () => {
      // Quitte l'écran de relecture → exploration (le butin/XP est déjà
      // appliqué par combatEnd, appelé à la détection de la fin du combat).
      setCombatEndPending(false);
      setCombatEndLogs([]);
      setCombat(null);
      // Si la sortie de donjon avait été différée, on la déclenche maintenant.
      if (exitedDeferredRef.current) {
        exitedDeferredRef.current = false;
        setExploration(null);
        setPendingLevelUps([]);
        exitedHandlerRef.current?.();
      }
    },
    combatSubmitStats: (choices: { characterId: string; stat: string }[]) => {
      combatSubmitStats(choices);
      // On ferme l'écran de choix dès la soumission (l'état d'exploration
      // renvoyé par le serveur confirmera la mise à jour des stats).
      setPendingLevelUps([]);
    },
    partyList: () => {
      // Bouton « Actualiser » du lobby : on remonte le spinner le temps de la
      // requête (les rafraîchissements internes appellent `partyList` direct,
      // sans spinner, pour ne pas faire clignoter à chaque update).
      setRoomsLoading(true);
      partyList();
    },
    partyCreate,
    partyJoin,
    partyLeave,
    partySave,
    partyRename,
    partyDelete,
    partyCreateCharacter,
  };

  return { state, logs, connected, actions, rooms, roomsLoading, error, inRoom, exploration, combat, combatEndPending, combatEndLogs, pendingLevelUps, gameOver, dismissGameOver, setExplorationExitedHandler, setAuthErrorHandler, toasts };
}
