import { MonsterAttack, Position, Status } from "./Types";
import { Unit } from "./Unit";

export abstract class Monster extends Unit {
    monsterattack: MonsterAttack[];
    atk: number;
    pv: number;
    xp: number;
    gold: number;

    constructor(id: string, name: string, type: 'Hero' | 'Enemy', position: Position, currentHp: number, maxHp: number, status: Status[], monsterattack: MonsterAttack[], atk: number[], pv: number[], xp: number[], gold: number[], zoneLevel: number){
        super(id ?? null, name ?? null, type ?? 'Enemy', position ?? null, currentHp ?? pv[0], maxHp ?? pv[0], status ?? []);
        this.monsterattack = monsterattack ?? [];
        this.atk = atk[zoneLevel]; 
        this.pv = pv[zoneLevel]; 
        this.xp = xp[zoneLevel]; 
        this.gold = gold[zoneLevel];     
    }

    abstract attack(target: Unit, roll: number, critRoll: number | 0): string[];
}