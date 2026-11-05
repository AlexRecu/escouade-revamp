import { Status } from "./Status";

export type Evolution = {
    name: string,
    requirements: Requirement,
    specialAbility: string,
    bonuses: Statistics,
    skills: { level: number; skill: Skill }[],
    spells: { level: number; spell: string }[],
    /** Bonus d'AP maximum accordé par l'évolution (ex. Samouraï : +2 AP). */
    apBonus?: number
};

export type Requirement = {
    level: number
}

export type Statistics = {
    strength: number,
    dexterity: number,
    endurance: number,
    mana: number,
    intelligence: number,
    perception: number,
    charisma: number
};

export type Skill = {
    name: string,
    formula: string,
    target: 'ally' | 'self' | 'enemy',
    type: 'single' | 'multi',
    move: number | 0,
    range: number,
    apCost: number,
    mpCost: number,
    hpCost: number,
    roll: number,
    status: Status[],
    element: string,
    description: string
};

export type EonSkill = {
    name: string,
    description: string,
    tp: number,
    formula: string,
    type: string,
    range: number,
    power: number | null
};

export class Spell {
    target: 'ally' | 'self' | 'enemy';
    name: string;
    element: string;
    mpCost: number | null;
    hpCost: number | null;
    power: number | null;
    hp: number | null;
    status?: Status;
    description: string;

    constructor(name: string, description: string, target: 'ally' | 'self' | 'enemy', element: string, mpCost: number | null, hpCost: number | null, hp: number | null, power: number | null, status?: Status) {
        this.name = name;
        this.description = description;
        this.element = element;
        this.target = target;
        this.power = power;
        this.mpCost = mpCost;
        this.hpCost = hpCost;
        this.hp = hp;
        this.status = status;
    }
};

export type Position = {
    row: number,
    col: number
};

/** Type de coffre : commun (objets de zone ≤ niveau-1) ou rare (objets de zone = niveau). */
export type ChestType = "common" | "rare";

/** Coffre d'exploration : position sur la grille + type + état d'ouverture. */
export type Chest = {
    position: Position;
    type: ChestType;
    /** true si le coffre a déjà été ouvert (session courante). */
    opened: boolean;
};

/** Mode de difficulté de la partie (easy = wipe à la ville, hard = game over). */
export type Difficulty = "easy" | "hard";

export type MonsterAttack = {
    name: string,
    description: string,
    condition: string,
    target: 'nearest' | 'farthest',
    move: number,
    range: number,
    turn: number,
    zoneEffect: number,
    status: Status,
    chance: number,
    deathMessage: string
};

export type AstroCard = {
    name: string;
    description: string; // Description de l'effet
    bonus?: Statistics; // bonus de stats des autres cartes
    power?: number; // Le Roi des couronnes
    status?: Status; // La Flèche
    isAce: boolean; // Le Roi et la Reine des couronnes
    sigil?: string; // Astrologie
};

export type Element = "Feu" | "Glace" | "Foudre" | "Air" | "Terre" | "Ténèbre" | "Sacré" | "";

export interface MonsterSpawnRate {
    monsterName: string;
    rate: number; // entre 0 et 1, total de la liste = 1
}

export type HubServices = {
    shop: boolean;
    inn: boolean;
    church: boolean;
    questBoard: boolean;
};

/** Bâtiment de ville (un service ancré sur une case précise). */
export type HubBuilding = {
    service: keyof HubServices;
    row: number;
    col: number;
};

/**
 * PNJ de ville (ancré sur une case, cliquable).
 *
 * Le joueur marche jusqu'à côté et clique pour **parler**. Le dialogue :
 *  - complète les étapes de quête `talk` dont la cible est le **nom du PNJ**
 *    OU le **nom de la ville** (ex. « Parler aux PNJ de Qual-Chen »),
 *  - remet l'**objet de quête** (`questItem`) si le PNJ en donne un
 *    (ex. le Pêcheur donne l'Embarcation),
 *  - distribue la récompense des quêtes ainsi complétées.
 */
export type HubResident = {
    /** Nom du PNJ (doit correspondre à la cible d'une étape `talk` si pertinent). */
    name: string;
    row: number;
    col: number;
    /** Dialogue affiché quand on lui parle. */
    dialogue: string;
    /** Objet de quête remis au joueur (nom, cf. `quest-items.json`). */
    questItem?: string;
};

/**
 * Layout d'une ville (mode point-and-clic).
 *
 * La ville est une **grille de tuiles** (comme les zones) : `true` = case
 * marchable, `false` = bloquée. Les bâtiments (services) sont ancrés sur des
 * cases précises, et `exit` est la case de sortie vers les donjons.
 * Le déplacement du personnage est géré au front (pathfinding + interpolation).
 */
export type HubLayout = {
    size: { rows: number; cols: number };
    tileMap: boolean[][];
    startTile: Position;
    buildings: HubBuilding[];
    /** PNJ de la ville (cliquables — dialogues + objets de quête). */
    residents?: HubResident[];
    exit: { row: number; col: number; label: string };
    /** Case de la caravane (en diagonale de la sortie) — ouvre le panneau de voyage. */
    caravan?: { row: number; col: number };
};

/**
 * Quête de chasse : tuer un certain nombre de monstres d'une **famille**
 * (monstres de même rang regroupés sous une bannière, ex. tous les Bombos).
 *
 * Générée à la découverte d'une ville (1 par donjon adjacent). Les kills sont
 * trackés au fil des combats ; des **paliers** (tous les 10%) distribuent de
 * l'XP. Une famille ne peut être chassée qu'une fois (toutes villes confondues).
 */
export type HuntQuest = {
    /** Id unique de la quête de chasse. */
    id: string;
    /** Famille ciblée (ex. "Bombo", "Dragon", "Frelon"). */
    family: string;
    /** Rang des monstres de la famille (tous identiques). */
    rank: number;
    /** Noms des monstres de la famille (tous comptent pour les kills). */
    monsters: string[];
    /** Nombre total de kills requis. */
    totalKills: number;
    /** Kills effectués. */
    kills: number;
    /** XP par kill (au worldLevel de génération). */
    xpPerKill: number;
    /** Paliers atteints (1-10, ex. [1, 2] = 10% et 20% atteints). */
    milestonesReached: number[];
    /** Ville (hub) où la quête est proposée. */
    hubId: string;
    /** Zone (donjon) d'origine. */
    zoneId: string;
    /** true si la quête est terminée (totalKills atteints). */
    completed: boolean;
};