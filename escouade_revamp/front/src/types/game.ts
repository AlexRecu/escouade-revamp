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
  /** Statistiques détaillées (7 stats) — pour le panneau de détail. */
  stats?: Statistics;
  /** Compétences de classe débloquées — pour le panneau de détail. */
  skills?: { name: string; apCost: number; mpCost: number; target: string; type: string; range: number; description: string }[];
  /** Sorts débloqués — pour le panneau de détail. */
  spells?: { name: string; mpCost: number | null; hpCost: number | null; target: string; element: string; description: string }[];
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
    /** Villes visitées (ids de hubs) — source de vérité du brouillard de guerre des villes. */
    visitedHubs: string[];
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

/** Coffre présent sur la grille (commun ou rare). */
export type DungeonChest = {
  row: number;
  col: number;
  type: 'common' | 'rare';
  opened: boolean;
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
  /** Coffres de l'étage (position + type commun/rare + état d'ouverture). */
  chests: DungeonChest[];
  /** Coffre sur la case courante (pour le bouton d'ouverture). */
  activeChest: {
    row: number;
    col: number;
    type: 'common' | 'rare';
    opened: boolean;
  } | null;
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

// ── Combat interactif (temps réel, tour par tour) ──────────────────────────

/** Unité sur le plateau de combat (héros ou ennemi). */
export type CombatUnit = {
  id: string;
  name: string;
  type: 'Hero' | 'Enemy';
  position: { row: number; col: number };
  currentHp: number;
  maxHp: number;
  isDead: boolean;
  isReplaced: boolean;
  status: { name: string; statusType?: 'boon' | 'curse'; nbTurnEffect: number | null }[];
  /** Héros : id du joueur qui contrôle l'unité. */
  ownerId?: string | null;
  /** Héros : nom de la classe. */
  jobName?: string;
  currentMp?: number;
  maxMp?: number;
  currentAp?: number;
  maxAp?: number;
  /** Ennemi : rang (≈ vitesse). */
  rank?: number;
};

/** Cibles valides d'une action (ids d'unités). */
export type ActionTargetView = { validTargets: string[] };

/** Sort utilisable par l'unité courante. */
export type CombatSpell = {
  name: string;
  mpCost: number | null;
  target: 'ally' | 'self' | 'enemy';
  description: string;
  validTargets: string[];
};

/** Compétence utilisable par l'unité courante. */
export type CombatSkill = {
  name: string;
  apCost: number;
  target: 'ally' | 'self' | 'enemy';
  type: 'single' | 'multi';
  description: string;
  validTargets: string[];
};

/** Objet utilisable par l'unité courante. */
export type CombatItem = {
  id: string;
  name: string;
  target: 'ally' | 'self' | 'enemy';
  validTargets: string[];
};

/** Ensemble des actions disponibles pour l'unité courante. */
export type CombatActions = {
  canMove: boolean;
  moveRange: number;
  attack: ActionTargetView;
  spells: CombatSpell[];
  skills: CombatSkill[];
  items: CombatItem[];
  canFlee: boolean;
};

/** Entrée de la file d'ordre des actions (affichée au-dessus du plateau). */
export type ActionOrderEntry = {
  id: string;
  name: string;
  type: 'Hero' | 'Enemy';
  /** Vitesse (Dextérité du héros / rang du monstre). */
  speed: number;
  /** true si l'unité a déjà agi ce tour (grisé dans la file). */
  acted: boolean;
};

/** État complet du combat renvoyé par le serveur. */
export type CombatState = {
  units: CombatUnit[];
  gridSize: number;
  turn: number;
  result: 'victory' | 'defeat' | 'fled' | 'ongoing';
  /** Id de l'unité dont c'est le tour (héros contrôlé), ou null. */
  currentUnitId: string | null;
  /** Actions disponibles pour l'unité courante (null si pas de tour joueur). */
  actions: CombatActions | null;
  /** File d'ordre des actions du tour courant (héros + ennemis, par vitesse). */
  actionOrder: ActionOrderEntry[];
  /** true si le combat est en phase de placement (positionner les héros). */
  placement: boolean;
  /** Journal du combat (dernières entrées). */
  log: string[];
  /** Métadonnées de la dernière action (animation : potion, sort, compétence,
   *  attaque de zone). `seq` croît à chaque action pour détecter un changement
   *  même si deux actions identiques se suivent. */
  lastAction: {
    actorId: string;
    targetId: string | null;
    targetIds: string[];
    kind: 'attack' | 'spell' | 'skill' | 'item' | 'combo';
    name?: string;
    seq: number;
  } | null;
};
