// Types du front — miroir de l'état de session sérialisé par le backend
// (HubSessionService.serialize).

import type { Hub } from './world';

export type BagItem = {
  id: string;
  name: string;
  type: string;
  description: string;
  purchasePrice: number;
  // Détails d'arme (présents si l'objet est une arme).
  weaponType?: string;
  mainStat?: string;
  weaponStat?: number;
  element?: string;
};

/** Arme équipée (main droite ou gauche). */
export type EquippedWeapon = {
  id: string;
  name: string;
  weaponType: string;
  subType: string;
  mainStat: string;
  weaponStat: number;
  element: string;
  status: string | null;
};

export type PartyMember = {
  id: string;
  name: string;
  job: string;
  jobLevel: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  gold: number;
  level: number;
  isDead: boolean;
  /** Types d'armes que ce personnage peut équiper (selon sa classe). */
  equippableWeapons: string[];
  /** Peut-il tenir une arme en main gauche (passif Double Armement) ? */
  canDualWield: boolean;
  rightHand: EquippedWeapon | null;
  leftHand: EquippedWeapon | null;
  bag: BagItem[];
  /** Id du joueur qui contrôle ce personnage (multi-joueurs). `null` = perso IA. */
  ownerId: string | null;
  /** Avatar personnalisé : nom du fichier de token choisi (ex. "Guerrier.png"). */
  avatar: string | null;
};

/** Statistiques d'un personnage (7 stats). */
export type Statistics = {
  strength: number;
  dexterity: number;
  endurance: number;
  mana: number;
  intelligence: number;
  perception: number;
  charisma: number;
};

/** Job disponible pour la création de personnage (GET /api/world/jobs). */
export type JobInfo = {
  name: string;
  description: string;
  defaultStats: Statistics;
  gold: number;
};

export type QuestStep = {
  id: string;
  description: string;
  type: string;
  target: string;
  done: boolean;
};

export type Quest = {
  id: string;
  name: string;
  giver: { npc: string; hub: string; dialogue: string } | null;
  steps: QuestStep[];
  reward: { demon?: string; gold?: number; xp?: number; description: string };
  accepted: boolean;
  completed: boolean;
};

export type ShopItem = {
  name: string;
  /** "weapon" (arme) ou "consommable". */
  kind: 'weapon' | 'consumable';
  price: number;
  effect: string;
  // Champs d'arme (présents si kind === "weapon").
  subType?: string;
  mainStat?: string;
  weaponStat?: number;
  element?: string;
  status?: string | null;
};

/** État de session complet renvoyé par le serveur après chaque action. */
/** Membre d'une partie (room) multi-joueurs. */
export type RoomMember = {
  playerId: string;
  username: string;
  isSpectator: boolean;
};

/** Bloc `room` présent dans l'état quand le joueur est dans une partie. */
export type RoomInfo = {
  roomId: string;
  name: string;
  hostName: string;
  isPublic: boolean;
  maxPlayers: number;
  members: RoomMember[];
};

/** Résumé d'une partie pour le lobby (liste des parties en cours). */
export type RoomSummary = {
  roomId: string;
  name: string;
  hostName: string;
  isPublic: boolean;
  maxPlayers: number;
  playerCount: number;
  memberCount: number;
  members: { username: string; isSpectator: boolean }[];
};

export type GameState = {
  /**
   * Nœud de **position** de l'équipe (id d'un hub OU d'un donjon). C'est ce
   * que suit le cercle blanc de la mappemonde. Quand l'équipe est en ville,
   * c'est l'id du hub ; dans une zone d'exploration, l'id du donjon.
   */
  currentNodeId: string;
  hub: Hub;
  party: {
    id: string;
    worldLevel: number;
    completedZones: string[];
    /** Pot commun d'or de l'équipe (source de vérité des transactions de ville). */
    gold: number;
    /** Monstres déjà vus (bestiaire, persisté côté serveur). */
    seenMonsters: string[];
    members: PartyMember[];
  };
  quests: {
    available: Quest[];
    accepted: Quest[];
  };
  shop: ShopItem[];
  /** Partie courante (présent si le joueur est dans une room multi-joueurs). */
  room?: RoomInfo;
};

// ── Exploration des donjons (mode déplacement) ─────────────────────────────

/** Résumé d'un membre de l'équipe dans la vue donjon. */
export type DungeonMember = {
  id: string;
  name: string;
  job: string;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  isDead: boolean;
};

/** Feu de camp présent sur la grille. */
export type DungeonCampfire = {
  row: number;
  col: number;
  used: boolean;
};

/** État d'exploration renvoyé par le serveur après chaque action de donjon. */
export type ExplorationState = {
  dungeonId: string;
  dungeonName: string;
  biome: string;
  zoneLevel: number;
  floor: number;
  totalFloors: number;
  completed: boolean;
  /** Grille : true = praticable, false = mur. */
  tileMap: boolean[][];
  position: { row: number; col: number };
  startTile: { row: number; col: number };
  endTile: { row: number; col: number };
  /** Type de la tuile d'arrivée : "door" (porte de sortie) ou "stairs" (escalier). */
  exitType: 'door' | 'stairs';
  campfires: DungeonCampfire[];
  visited: { row: number; col: number }[];
  activeCampfire: {
    location: string;
    used: boolean;
    restoredHp: number;
    restoredMp: number;
  } | null;
  party: {
    gold: number;
    members: DungeonMember[];
  };
};
