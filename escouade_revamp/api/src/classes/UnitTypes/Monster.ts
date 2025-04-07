import { Item } from "../Items/Item";
import { MonsterAttack, Position, Skill, Spell } from "../Types";
import { Status } from "../Status";
import { Unit } from "../UnitTypes/Unit";

export class Monster extends Unit {
    rank: number;
    monsterSkills: MonsterAttack[];
    atk: number;
    xp: number;
    gold: number;

    constructor(id: string, rank: number, name: string, position: Position, status: Status[], monsterSkills: MonsterAttack[], atk: number[], pv: number[], xp: number[], gold: number[], zoneLevel: number, items?: Item[], weakness: string[] = [], resistance: string[] = [], immunity: string[] = []) {
        super(id ?? null, name ?? null, 'Enemy', position ?? null, pv[zoneLevel - 1], pv[zoneLevel - 1], status ?? [], items ?? []);
        this.rank = rank;
        this.monsterSkills = monsterSkills ?? [];
        this.atk = atk[zoneLevel - 1];
        this.xp = xp[zoneLevel - 1];
        this.gold = gold[zoneLevel - 1];
        this.weakness = weakness;
        this.resistance = resistance;
        this.immunity = immunity;
    }

    attack(target: Unit, roll: number, critRoll: number | 0): string[] {
        return [];
    };
    useSpellFromName(spellName: string, target: Unit, roll: number, critRoll: number): string[] {
        throw new Error("Method not implemented.");
    }
    useItem(item: Item, target: Unit): string[] {
        throw new Error("Method not implemented.");
    }
    useAbility(skillName: string, allUnits: Unit[]): string[] {
        throw new Error("A Monster cannot use Skill.");
    }
}