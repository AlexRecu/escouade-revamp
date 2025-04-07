import { Item } from "../../src/classes/Items/Item";
import { Status } from "../../src/classes/Status";
import { Unit } from "../../src/classes/UnitTypes/Unit";
import { manageStatusBeforePhase, manageStatusAfterPhase, applyStatus } from "../../src/utils/StatusUtils";
import { calculateDamageMultiplier } from "../../src/utils/DamageUtils"

class TestUnit extends Unit {
    attack(target: Unit, roll: number, critRoll = 0, bonus = 0) {
        return [`Attaque sur ${target.name} avec roll ${roll}`];
    }
    useSpellFromName(spellName: string, target: Unit, roll: number, critRoll: number) {
        return [`Lance ${spellName} sur ${target.name}`];
    }
    useAbility(skillName: string, allUnits: Unit []) {
        return [`Utilise ${skillName}`];
    }
    useItem(item: Item, target: Unit) {
        return [`Utilise ${item.name} sur ${target.name}`];
    }
}

describe("Unit Class", () => {
    let unit1: Unit, unit2: Unit, unit3: Unit; 
    let units : Unit[];

    beforeEach(() => {
        unit1 = new TestUnit("1", "Hero1", "Hero", { row: 0, col: 0 }, 10, 10, [], []);
        unit2 = new TestUnit("2", "Enemy1", "Enemy", { row: 1, col: 1 }, 10, 10, [], []);
        unit3 = new TestUnit("3", "Hero2", "Hero", { row: 3, col: 3 }, 10, 10, [], []);
        units = [unit1, unit2, unit3];
    });

    test("getClosestUnit returns the closest unit of specified type", () => {
        expect(unit1.getClosestUnit("Enemy", units)).toBe(unit2);
    });

    test("getFarthestUnit returns the farthest unit of specified type", () => {
        expect(unit1.getFarthestUnit("Hero", units)).toBe(unit3);
    });

    test("isDead returns true when HP is 0", () => {
        unit1.currentHp = 0;
        expect(unit1.isDead()).toBe(true);
    });

    test("calculateDamageMultiplier correctly determines multipliers", () => {
        unit2.weakness = ["Fire"];
        expect(calculateDamageMultiplier(unit1, "Fire", unit2)).toBe(2);
    });

    test("applyStatus correctly applies statuses", () => {
        let resultArray: string[] = [];
        const status: Status = { name: "Poison", statusType: "curse", nbTurnEffect: 3 };
        applyStatus(unit1, status, unit2, 4, resultArray);
        expect(unit2.status).toContainEqual(status);
    });

    test("moveTowards allows to avoid 1 obstacle while moving closer to target", () => {
        unit1.position = {row: 0, col:0};
        unit1.moveTowards({ row: 3, col: 3 }, 4, units);
        expect(unit1.position).toEqual({ row: 2, col: 2 });
    });

    test("moveTowards moves the unit in a define pattern", () => {
        const unit4 = new TestUnit("1", "Enemy2", "Enemy", { row: 0, col: 5 }, 10, 10, [], []);
        const unit5 = new TestUnit("2", "Enemy3", "Enemy", { row: 1, col: 6 }, 10, 10, [], []);
        units.push(unit4,unit5);
        unit1.position = {row: 1, col:0};
        unit1.moveTowards({ row: 0, col: 7 }, 1, units);
        expect(unit1.position).toEqual({ row: 0, col: 1 });
        unit1.moveTowards({ row: 0, col: 7 }, 1, units);
        expect(unit1.position).toEqual({ row: 0, col: 2 });
        unit1.moveTowards({ row: 0, col: 7 }, 1, units);
        expect(unit1.position).toEqual({ row: 0, col: 3 });
        unit1.moveTowards({ row: 0, col: 7 }, 1, units);
        expect(unit1.position).toEqual({ row: 0, col: 4 });
        unit1.moveTowards({ row: 0, col: 7 }, 1, units);
        expect(unit1.position).toEqual({ row: 1, col: 5 });
        unit1.moveTowards({ row: 0, col: 7 }, 1, units);
        expect(unit1.position).toEqual({ row: 0, col: 6 });
        unit1.moveTowards({ row: 0, col: 7 }, 1, units);
        expect(unit1.position).toEqual({ row: 0, col: 7 });
        unit1.position = {row: 1, col:0};
        unit1.moveTowards({ row: 0, col: 7 }, 7, units);
        expect(unit1.position).toEqual({ row: 0, col: 7 });
    });

    test("moveTowards moves the unit around large obstacle", () => {
        const unit4 = new TestUnit("1", "Enemy2", "Enemy", { row: 0, col: 5 }, 10, 10, [], []);
        const unit5 = new TestUnit("2", "Enemy3", "Enemy", { row: 1, col: 6 }, 10, 10, [], []);
        const unit6 = new TestUnit("3", "Enemy4", "Enemy", { row: 0, col: 6 }, 10, 10, [], []);
        units.push(unit4,unit5, unit6);
        unit1.position = {row: 0, col:4};
        unit1.moveTowards({ row: 0, col: 7 }, 1, units);
        expect(unit1.position).toEqual({ row: 1, col: 5 });
        unit1.moveTowards({ row: 0, col: 7 }, 1, units);
        expect(unit1.position).toEqual({ row: 2, col: 6 });
        unit1.moveTowards({ row: 0, col: 7 }, 1, units);
        expect(unit1.position).toEqual({ row: 1, col: 7 });
        unit1.moveTowards({ row: 0, col: 7 }, 1, units);
        expect(unit1.position).toEqual({ row: 0, col: 7 });
    });

    test("moveTowards moves using Dijsktra", () => {
        const unit4 = new TestUnit("1", "Enemy2", "Enemy", { row: 2, col: 1 }, 10, 10, [], []);
        const unit5 = new TestUnit("2", "Enemy3", "Enemy", { row: 2, col: 2 }, 10, 10, [], []);
        const unit6 = new TestUnit("3", "Enemy4", "Enemy", { row: 3, col: 2 }, 10, 10, [], []);
        const unit7 = new TestUnit("4", "Enemy5", "Enemy", { row: 4, col: 2 }, 10, 10, [], []);
        const unit8 = new TestUnit("5", "Enemy6", "Enemy", { row: 4, col: 3 }, 10, 10, [], []);
        const unit9 = new TestUnit("6", "Enemy7", "Enemy", { row: 4, col: 4 }, 10, 10, [], []);
        unit3.position = { row: 3, col: 4 };
        units.push(unit4,unit5, unit6, unit7, unit8, unit9);
        unit1.position = {row: 3, col:0};
        unit1.moveTowards({ row: 3, col: 3 }, 1, units);
        expect(unit1.position).toEqual({ row: 2, col: 0 });
        unit3.position = { row: 1, col: 0 };
        unit1.moveTowards({ row: 3, col: 3 }, 4, units);
        expect(unit1.position).toEqual({ row: 5, col: 3 });
        unit1.moveTowards({ row: 3, col: 3 }, 4, units);
        expect(unit1.position).toEqual({ row: 3, col: 3 });
    });

    test("moveAwayFrom moves the unit away from target", () => {
        const log = unit1.moveAwayFrom({ row: 2, col: 4}, 8, units);
        expect(unit1.position).toEqual({ row: 7, col: 0 });
    });

    test("manageStatusBeforePhase handles statuses correctly", () => {
        unit1.status = [{ name: "Sommeil", statusType: "curse", nbTurnEffect: 1 } as Status];
        const logs = manageStatusBeforePhase(unit1);
        expect(logs).toContain("Hero1 est incapable d'agir.");
        expect(unit1.canAct).toBe(false);
    });

    test("manageStatusAfterPhase handles status effects correctly", () => {
        unit1.status = [{ name: "Poison", statusType: "curse", nbTurnEffect: 1 } as Status];
        const logs = manageStatusAfterPhase(unit1);
        expect(logs.some(log => log.includes("subit"))).toBe(true);
    });
});