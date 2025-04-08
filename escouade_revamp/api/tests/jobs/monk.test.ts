import { Character } from "../../src/classes/UnitTypes/Character";
import { Monster } from "../../src/classes/UnitTypes/Monster";
import { Unit } from "../../src/classes/UnitTypes/Unit";
import { Skill } from "../../src/classes/Types";
import { Monk } from "../../src/classes/Jobs/Monk";
import { Weapon, Knuckles} from "../../src/classes/Items/Weapon";

describe("Monk Class Tests", () => {
    let monk: Character;
    let enemy: Unit;
    let weapon: Weapon;
    
    beforeEach(() => {
        weapon = new Knuckles("1","Bandage","",0,0,2,"");
        monk = new Character("1", "TestMonk", 'Hero', { row: 0, col: 0 }, 10, 10, [], 10, 10, 10, 10, new Monk(), weapon, null);
        enemy = new Monster("Frelon", { row: 1, col: 1 }, 'Enemy', 2);        
    });

    test("Monk initializes with correct stats", () => {
        expect(monk.stats.strength).toBe(4);
        expect(monk.stats.endurance).toBe(2);
        expect(monk.currentAp).toBe(10);
    });

    test("Monk gets abilities based on level", () => {
        monk.job.jobLevel = 1;
        const abilities: Omit<Skill, "formula">[] = monk.getAvailableAbilities();
        expect(abilities.length).toBe(1);
        expect(abilities[0].name).toBe("Concentration");

        monk.job.jobLevel = 7;
        const newAbilities: Omit<Skill, "formula">[] = monk.getAvailableAbilities();
        expect(newAbilities.some(skill => skill.name === "Mantra")).toBe(true);
    });

    test("Skill Concentration restores MP", () => {
        monk.useCharacterAbility("Concentration", [monk]);
        expect(monk.currentMp).toBe(Math.min(13, monk.maxMp));
    });

    test("Skill Frappe Chi deals correct damage", () => {
        const log = monk.useCharacterAbility("Frappe Chi", [enemy]);
        expect(log).toContain("TestMonk utilise Frappe Chi sur "+enemy.name);
        expect(enemy.currentHp).toBeLessThan(20);
    });

    test("Skill Mantra heals based on endurance", () => {
        monk.currentHp = 10;
        monk.useCharacterAbility("Mantra", [monk]);
        expect(monk.currentHp).toBe(10 + monk.stats.endurance);
    });

    test("Skill Pied du Buddha works at range 2", () => {
        const distance = Math.max(
            Math.abs(enemy.position.row - monk.position.row),
            Math.abs(enemy.position.col - monk.position.col)
        );
        const attackRange = monk.job.skills.find(skill => skill.skill.name === "Pied du Buddha")?.skill.range ?? 100;
        expect(distance).toBeLessThanOrEqual(attackRange);
    });

    test("Skill Frappe karmique deals damage based on missing HP", () => {
        monk.currentHp = 1;
        const log = monk.useCharacterAbility("Frappe karmique", [enemy]);
        expect(log).toContain("TestMonk utilise Frappe karmique sur "+enemy.name);
    });

    test("Skill Ruée de coups performs two attacks", () => {
        enemy.currentHp = 40;
        const log = monk.useCharacterAbility("Ruée de coups", [enemy]);
        expect(log).toContain("TestMonk utilise Ruée de coups sur "+enemy.name);
        expect(enemy.currentHp).toBe(0);
    });

    test("Skill Chakra applies Dissipation status", () => {
        const ally = new Character("2", "Ally", 'Hero', { row: 1, col: 1 }, 30, 30, [{name:"Poison", statusType: "curse" ,nbTurnEffect: null}], 10, 10, 10, 10, new Monk(), null, null);
        
        monk.useCharacterAbility("Chakra", [ally]);
        expect(ally.status).toStrictEqual([]);
    });
});
