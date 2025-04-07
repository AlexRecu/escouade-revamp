import { Status } from "./Status";

export type MonsterAttack = {
    name: string;
    description: string;
    condition: string;
    target: 'nearest' | 'farthest';
    move: number;
    range: number;
    turn: number;
    zoneEffect: number;
    status: Status;
    chance: number;
    deathMessage: string;
}