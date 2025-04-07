import { Status } from "./Status";

export type Evolution = {
    name: string,
    requirements: Requirement,
    specialAbility: string,
    bonuses : Statistics,
    skills : { level: number; skill: Skill }[],
    spells:  { level: number; spell: string}[]
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

   constructor(name: string, description: string, target: 'ally' | 'self' | 'enemy', element: string, mpCost: number | null, hpCost: number | null, hp: number | null, power: number | null, status?: Status){
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
