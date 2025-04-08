import { Character } from "../../src/classes/UnitTypes/Character";
import { Monster } from "../../src/classes/UnitTypes/Monster";
import { Unit } from "../../src/classes/UnitTypes/Unit";
import { Skill } from "../../src/classes/Types";
import { Warrior } from "../../src/classes/Jobs/Warrior";
import { Sword } from "../../src/classes/Items/Weapon";
import { Weapon } from "../../src/classes/Items/Weapon";

describe("Warrior Class Tests", () => {
    const weapon: Weapon = new Sword("Epee1", "Epee", "", 0, 0, 2, "", null);
    let warrior: Character;
    let enemy: Unit;

    beforeEach(() => {
        warrior = new Character("1", "TestWarrior", 'Hero', { row: 0, col: 0 }, 30, 30, [], 0, 0, 10, 10, new Warrior(), weapon, null);
        enemy = new Monster("Gobelin", { row: 1, col: 1 },'Enemy', 1);
    });

    test("Warrior initializes with correct stats", () => {
        expect(warrior.stats.strength).toBe(2);
        expect(warrior.stats.endurance).toBe(3);
        expect(warrior.currentAp).toBe(10);
        expect(warrior.getRightHand()).toBe(weapon);
    });

    test("Warrior gets abilities based on level", () => {
        warrior.job.jobLevel = 1;
        const abilities: Omit<Skill, "formula">[] = warrior.getAvailableAbilities();
        expect(abilities.length).toBe(1);
        expect(abilities[0].name).toBe("Bouclier impénétrable");

        warrior.job.jobLevel = 7;
        const newAbilities: Omit<Skill, "formula">[] = warrior.getAvailableAbilities();
        expect(newAbilities.some(skill => skill.name === "Percée")).toBe(true);
    });

    test("Bouclier impénétrable increases Heart Points", () => {
        const log = warrior.useCharacterAbility("Bouclier impénétrable", [warrior]);
        expect(warrior.currentHp).toBe(33);
        expect(warrior.currentAp).toBe(9);
        expect(log).toContain("Il lève son bouclier pour se protéger lui et ses alliés pendant 3 tours");
        expect(log).toContain("TestWarrior utilise Bouclier impénétrable");
        expect(warrior.status.some(status => status.name === "Bouclier Impénétrable")).toBe(true);
    });

    test("Cri de guerre forces all enemies to target Warrior", () => {
        const log = warrior.useCharacterAbility("Cri de guerre", [warrior]);
        expect(warrior.currentAp).toBe(9);
        expect(log).toContain("Il devient le centre d'attention des ennemis pendant 5 tours");
        expect(warrior.status.some(status => status.name === "Provoque")).toBe(true);
    });

    test("Is in range", () => {
        const distance = Math.max(
            Math.abs(enemy.position.row - warrior.position.row),
            Math.abs(enemy.position.col - warrior.position.col)
        );
        const perceeRange = warrior.job.skills.find((recordLevelSkill) => recordLevelSkill.skill.name === "Percée")?.skill.range ?? 100;
        expect(distance).toBeLessThanOrEqual(perceeRange);
    });

    test("Is not in range", () => {
        const enemy2 = new Monster("Gobelin", { row: 2, col: 1 },'Enemy', 1);
        enemy2.currentHp = 100;
        const distance = Math.max(
            Math.abs(enemy2.position.row - warrior.position.row),
            Math.abs(enemy2.position.col - warrior.position.col)
        );
        const perceeRange = warrior.job.skills.find((recordLevelSkill) => recordLevelSkill.skill.name === "Percée")?.skill.range ?? 100;
        expect(distance).toBeGreaterThan(perceeRange);
    });


    test("Warrior fails to attack on roll 1 (Échec critique)", () => {
        const log = warrior.attack(enemy, 1);
        expect(log).toContain("ECHEC CRITIQUE !");
        expect(enemy.currentHp).toBe(20);
    });

    test("Warrior do critical attack on roll 6 with damage X4", () => {
        const log = warrior.attack(enemy, 6, 4, weapon.weaponStat - 2);
        expect(log).toContain("COUT CRITIQUE ! dégat X4!");
        expect(enemy.currentHp).toBe(0);
    });

    test("Warrior useAbility Percée", () => {
        const log = warrior.useCharacterAbility("Percée", [enemy]);
        expect(log).toContain("TestWarrior utilise Percée sur "+enemy.name);
        expect(enemy.currentHp).toBeLessThan(20);
        expect(warrior.currentAp).toBe(8);
    });

    test("Warrior useAbility Frappe Tournoyante", () => {
        const enemy2 = new Monster("Gobelin", { row: 2, col: 1 },'Enemy', 1);
        enemy2.currentHp = 100;
        const enemy3 = new Monster("Gobelin", { row: 7, col: 1 },'Enemy', 1);
        enemy3.currentHp = 20;
        const log = warrior.useCharacterAbility("Frappe tournoyante", [enemy, enemy2, enemy3]);
        expect(log).toContain("TestWarrior utilise Frappe tournoyante sur "+enemy.name+","+enemy2.name);
        expect(warrior.currentAp).toBe(8);
        expect(enemy3.currentHp).toBe(20);
        expect(enemy2.currentHp).toBe(100 - ((warrior.stats.strength + 5 - 2) * weapon.weaponStat));
        expect(enemy.currentHp).toBe(20 - ((warrior.stats.strength + 5 - 2) * weapon.weaponStat));
    });
});
