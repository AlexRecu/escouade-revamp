import { Item } from "../Items/Item";
import { MonsterAttack, Position, Skill, Spell } from "../Types";
import { Status } from "../Status";
import { Unit } from "../UnitTypes/Unit";
import bestiary from "../../config/bestiary_data.json";
import { IdGenerator } from "../../utils/IdGeneratorUtils";
import skillData from "../../config/blueMage_skills_data.json";

export class Monster extends Unit {
    rank!: number;
    monsterSkills!: string[];
    atk!: number;
    xp!: number;
    gold!: number;

    constructor(name: string, position: Position, type: 'Hero' | 'Enemy', zoneLevel: number);
    constructor(rank: number, name: string, type: 'Hero' | 'Enemy', zoneLevel: number, position: Position, status: Status[], monsterSkills: string[], atk: number[], pv: number[], xp: number[], gold: number[], items: Item[], weakness: string[], resistance: string[], immunity: string[])
    constructor(arg1: number | string, arg2: string | Position, arg3: 'Hero' | 'Enemy', zoneLevel: number, position?: Position, status?: Status[], monsterSkills?: string[], atk?: number[], pv?: number[], xp?: number[], gold?: number[], items?: Item[], weakness?: string[], resistance?: string[], immunity?: string[]) {
        if (typeof arg1 === "string") {
            // => constructor(name: string, position: Position, type: ...)
            const name = arg1;
            const position = arg2 as Position;
            const type = arg3 as 'Hero' | 'Enemy';
            const monster = bestiary.find(m => m.name === name);
            if (monster) {
                super(IdGenerator.generate(monster.name), monster.name, type, position, monster.pv[zoneLevel - 1], monster.pv[zoneLevel - 1], status ?? [], items ?? []);
                this.rank = monster.rank;
                this.monsterSkills = monster.attack ?? [];
                this.atk = monster.atk[zoneLevel - 1];
                this.xp = monster.xp[zoneLevel - 1];
                this.gold = monster.gold[zoneLevel - 1];
                this.weakness = monster.weakness ?? [];
                this.resistance = monster.resistance ?? [];
                this.immunity = monster.immunity ?? [];
            }
        } else {
            // => constructor(rank: number, name: string, type: ..., ...)
            const rank = arg1 as number;
            const name = arg2 as string;
            const type = arg3 as 'Hero' | 'Enemy';
            super(IdGenerator.generate(name), name, type, position!, pv ? pv[zoneLevel - 1] : 10000, pv ? pv[zoneLevel - 1] : 10000, status ?? [], items ?? []);
            this.rank = rank;
            this.monsterSkills = monsterSkills ?? [];
            this.atk = atk ? atk[zoneLevel - 1] : 0;
            this.xp = xp ? xp[zoneLevel - 1] : 10000;
            this.gold = gold ? gold[zoneLevel - 1] : 10000;
            this.weakness = weakness ?? [];
            this.resistance = resistance ?? [];
            this.immunity = immunity ?? [];
        }
    }

    attack(target: Unit, roll: number, critRoll: number | 0): string[] {
        let resultArray: string[] = [];
        let damage: number = 0;
        resultArray.push(`${this.name} attaque ${target.name}`);
        if (roll > 1) {
            damage = this.atk;
            if (roll = 6) {
                resultArray.push(`COUP CRITIQUE !`);
                damage *= 2;
            }
            resultArray.push(`${target.name} subit ${damage} de dommage`);
            target.currentHp = Math.max(target.currentHp - damage, 0);

            if (target.isDead()) resultArray.push(`${target.name} est KO ...`);
        } else {
            resultArray.push(`${this.name} rate son attaque`);
        }
        return resultArray;
    };
    useSpellFromName(spellName: string, target: Unit, roll: number, critRoll: number): string[] {
        throw new Error("Method not implemented.");
    }
    useItem(item: Item, target: Unit): string[] {
        throw new Error("Method not implemented.");
    }
    useMonsterAbility(allUnits: Unit[]): string[];
    useMonsterAbility(skillName: string, allUnits: Unit[]): string[];
    useMonsterAbility(arg1: string | Unit[], arg2?: Unit[]) {
        let skill: Skill;
        let skillName;
        let allUnits;
        if (typeof arg1 === "string") {
            skillName = arg1 as string;
            allUnits = arg2 as Unit[];
        } else {
            allUnits = arg1 as Unit[];
            const skillIndex = Math.floor(Math.random() * this.monsterSkills.length);
            skillName = this.monsterSkills[skillIndex];
        }
        //lister MonsterSkills
        skill = skillData.find(skill => skill.name === skillName) as Skill;
        if (!skill && (typeof arg1 === "string")) {
            this.useMonsterAbility(allUnits);
        } else if (!skill) {
            throw new Error("Monster.useMonsterAbility : No skill to use");
        }
        return this.useAbility(skill, allUnits);
    }

}