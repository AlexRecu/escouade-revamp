// Types partagés du front — miroir des types backend (src/classes/Types.ts).

export type Position = { row: number; col: number };

export type HubServices = {
  shop: boolean;
  inn: boolean;
  church: boolean;
  questBoard: boolean;
};

export type HubBuilding = {
  service: keyof HubServices;
  row: number;
  col: number;
};

export type HubLayout = {
  size: { rows: number; cols: number };
  tileMap: boolean[][];
  startTile: Position;
  buildings: HubBuilding[];
  exit: { row: number; col: number; label: string };
  /** Case de la caravane (en diagonale de la sortie) — ouvre le panneau de voyage. */
  caravan?: { row: number; col: number };
};

export type Hub = {
  id: string;
  name: string;
  services: HubServices;
  layout: HubLayout | null;
  /** Description de la ville (générée côté backend). */
  description: string;
};

export type Dungeon = {
  id: string;
  name: string;
  zoneLevel: number;
  biome: string;
  floors: number;
  /** Noms des monstres rencontrables dans ce donjon (dérivés du biome). */
  monsters: string[];
};

export type WorldSummary = {
  hubs: Hub[];
  dungeons: Dungeon[];
  edges: Record<string, string[]>;
};

/** Statut (armes + sorts + compétences) — miroir de `statuses_data.json`. */
export type Status = {
  name: string;
  /** "boon" (avantage) ou "curse" (malus). */
  statusType: 'boon' | 'curse';
  /** Icône affichée sur la chip. */
  icon: string;
  /** Effet du statut (texte du tooltip). */
  description: string;
  /** Durée en tours (null = jusqu'à dissipation / effet immédiat). */
  nbTurnEffect: number | null;
  /** Objet qui dissipe ce statut (ex. "Sérum", "Antidote universel"). */
  counterItem: string | null;
  /** Sources (ex. "Sort : Morphée", "Arme : Épée Sanguine"). */
  sources: string[];
};
