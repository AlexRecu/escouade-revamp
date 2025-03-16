import { Unit } from "./Unit";

export type Status = {
    name: string,
    description?: string,
    unitType?: 'ally' | 'enemy',
    counterItem?: Item[],
    nbTurnEffect?: number | null,
    aoe?: boolean,
    chance?: number
};

export type Job = {
    name: string,
    description: string,
    defaultStats : Statistics,
    weapons: string[],
    item: Item[],
    gold: number,
    skills: Skill[],
    spells: Spell[]
};

export type Evolution = {
    name: string,
    requirements: Requirement,
    specialAbility: string,
    bonuses : Statistics,
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
    range: number,
    apCost: number,
    mpCost: number,
    hpCost: number,
    roll: number,
    status: Status[],
    element: string,
    description: string
};

export type Spell = {
   target: 'ally' | 'enemy',
   name: string,
   element: string,
   manaCost: number | null,
   hpCost: number | null,
   power: number | null,
   hp: number | null,
   status: Status,
   description: string
};

export type Item = {
    id: string,
    name: string,
    type: 'weapon' | 'consumable',
    effect: string,
    purchasePrice: number,
    resaleBase: number,
    zoneThreshold: number
};

export type Weapon = Item & {
    weaponType: string,
    mainStat: string,
    subStat: string,
    weaponStat: number,
    weaponSubStat: number,
    range: number,
    status: Status,
    element: string
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
    range: null,
    turn: number,
    zoneEffect: number,
    status: Status,
    chance: number,
    deathMessage: string
};