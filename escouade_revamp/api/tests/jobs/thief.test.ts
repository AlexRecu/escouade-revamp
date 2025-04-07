import { Character } from "../../src/classes/UnitTypes/Character";
import { Monster } from "../../src/classes/UnitTypes/Monster";
import { Unit } from "../../src/classes/UnitTypes/Unit";
import { Skill } from "../../src/classes/Types";
import { Thief } from "../../src/classes/Jobs/Thief";
import { Dagger } from "../../src/classes/Items/Weapon";
import { Weapon } from "../../src/classes/Items/Weapon";
import { Item } from "../../src/classes/Items/Item";
import {Potion, PotionPlus} from "../../src/classes/Items/Consumable";

describe("Thief Class Tests", () => {
    const weapon: Weapon = new Dagger("Dague1", 'Dague en fer', "", 0, 0, 2, "", null);
    let thief: Character;
    let enemy: Unit;
    const potion: Potion = new Potion();
    const potionP: PotionPlus = new PotionPlus();

    beforeEach(() => {
        thief = new Character("1", "TestThief", 'Hero', { row: 0, col: 0 }, 30, 30, [], 10, 10, 10, 10, new Thief(), weapon, null);
        enemy = new Monster("1", 1, "Enemy1", { row: 7, col: 7 }, [], [], [1], [20], [100], [100], 1, [potion,potionP]);
    });

    test("Thief initializes with correct stats", () => {
        expect(thief.stats.strength).toBe(0);
        expect(thief.stats.dexterity).toBe(2);
        expect(thief.stats.endurance).toBe(1);
        expect(thief.currentAp).toBe(10);
    });

    test("Thief gets abilities based on level", () => {
        thief.job.jobLevel = 1;
        const abilities: Omit<Skill, "formula">[] = thief.getAvailableAbilities();
        expect(abilities.length).toBe(1);
        expect(abilities[0].name).toBe("Vol");

        thief.job.jobLevel = 7;
        const newAbilities: Omit<Skill, "formula">[] = thief.getAvailableAbilities();
        expect(newAbilities.some(skill => skill.name === "Frappe empoisonnée")).toBe(true);
    });

    test("Skill Vol steals random item from target's bag and use it", () => {
        let log = thief.useAbility("Vol", [enemy]);
        expect(log).toContain("TestThief utilise Vol sur "+enemy.name);
        expect(thief.currentAp).toBe(9);
        
        expect(thief.bag.length).toBe(1);
        expect(enemy.bag.length).toBe(1);
        let stolenObject = thief.bag.find(item => item.name === "Potion");
        if(stolenObject){
            expect(enemy.bag).toContain(potionP);
            expect(log).toContain("Obtenu : "+potion.name);
        }else{
            expect(enemy.bag).toContain(potion);
            expect(log).toContain("Obtenu : "+potionP.name);
            stolenObject = thief.bag.find(item => item.name === "Potion+");
        }
        thief.currentHp = 1;
        expect(stolenObject).toBeDefined();
        log = thief.useItem(stolenObject as Item, thief);
        expect(log).toContain(`${thief.name} utilise ${stolenObject?.name} sur ${thief.name}.`);
        expect(thief.currentHp).toBeGreaterThanOrEqual(6);
    });

    test("Skill Pas de l'ombre warps thief behind target and boost critical rate", () => {
        const log = thief.useAbility("Pas de l'ombre", [thief, enemy]);
        expect(log).toContain("TestThief disparaît comme une ombre");
        expect(log).toContain("TestThief utilise Pas de l'ombre");
        expect(thief.currentMp).toBe(9);
        expect(thief.status.some(status => status.name === "Crit+")).toBe(true);
        expect(thief.position).toStrictEqual({row:6, col:6});
    });

    test("Is in range", () => {
        const enemy2 = new Monster("2",1, "Enemy2", { row: 1, col: 1 }, [], [], [1], [100], [100], [100], 1);
        const distance = Math.max(
            Math.abs(enemy2.position.row - thief.position.row),
            Math.abs(enemy2.position.col - thief.position.col)
        );
        const attackRange = thief.job.skills.find((recordLevelSkill) => recordLevelSkill.skill.name === "Frappe empoisonnée")?.skill.range ?? 100;
        expect(distance).toBeLessThanOrEqual(attackRange);
    });

    test("Is not in range", () => {
        const distance = Math.max(
            Math.abs(enemy.position.row - thief.position.row),
            Math.abs(enemy.position.col - thief.position.col)
        );
        const attackRange = thief.job.skills.find((recordLevelSkill) => recordLevelSkill.skill.name === "Frappe empoisonnée")?.skill.range ?? 100;
        expect(distance).toBeGreaterThan(attackRange);
        const log = thief.useAbility("Frappe empoisonnée", [thief, enemy]);
        expect(log).toContain("Aucune cible valide à 1 case(s) pour Frappe empoisonnée.");
    });


    test("Thief fails to attack on roll 1 (Échec critique)", () => {
        const log = thief.attack(enemy, 1);
        expect(log).toContain("ECHEC CRITIQUE !");
        expect(enemy.currentHp).toBe(20);
    });

    test("Thief do critical attack on roll 6 with damage X4", () => {
        const log = thief.attack(enemy, 6, 4, weapon.weaponStat - 2);
        expect(log).toContain("COUT CRITIQUE ! dégat X4!");
        expect(enemy.currentHp).toBe(0);
    });

    test("Thief do critical attack on roll 5 with status Crit+ and damage X2", () => {
        thief.useAbility("Pas de l'ombre", [thief, enemy]);
        const log = thief.attack(enemy, 5, 2, weapon.weaponStat - 2);
        expect(log).toContain("COUT CRITIQUE ! dégat X2!");
        expect(enemy.currentHp).toBe(0);
    });

    test("Thief useAbility Vortex", () => {
        const enemy2 = new Monster("2",1,"Enemy2", { row: 2, col: 1 }, [], [], [1], [100], [100], [100], 1);
        const enemy3 = new Monster("3",1, "Enemy3", { row: 1, col: 1 }, [], [], [1], [20], [100], [100], 1);
        const log = thief.useAbility("Vortex", [enemy, enemy2, enemy3]);
        expect(log).toContain("TestThief utilise Vortex sur "+enemy2.name+","+enemy3.name);
        expect(thief.currentAp).toBe(8);
        expect(enemy.currentHp).toBe(20);
        expect(enemy2.currentHp).toBe(100 - ((thief.stats.dexterity + 5 - 1) * weapon.weaponStat));
        expect(enemy3.currentHp).toBe(20 - ((thief.stats.dexterity + 5 - 1) * weapon.weaponStat));
    });

    test("Thief useAbility Frappe critique", () => {
        const enemy2 = new Monster("2", 1, "Enemy2", { row: 1, col: 1 }, [], [], [1], [100], [100], [100], 1);
        const enemy3 = new Monster("3", 1, "Enemy3", { row: 2, col: 1 }, [], [], [1], [20], [100], [100], 1);
        const log = thief.useAbility("Frappe critique", [enemy,enemy2,enemy3]);
        expect(log).toContain("TestThief utilise Frappe critique sur "+enemy2.name);
        expect(enemy.currentHp).toBe(20);
        expect(enemy2.currentHp).toBe(76);
        expect(enemy3.currentHp).toBe(20);
        expect(thief.currentAp).toBe(7);
    });
});
