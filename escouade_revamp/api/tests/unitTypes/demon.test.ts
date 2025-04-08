import { Demon } from "../../src/classes/UnitTypes/Demon";
import spellData from "../../src/config/spells_data.json";
import { Spell } from "../../src/classes/Types";
import { Character } from "../../src/classes/UnitTypes/Character";
import { Warrior } from "../../src/classes/Jobs/Warrior";

describe("Demon Class", () => {
    let demon: Demon;
    let target: Character;
    let target2: Character;
    let ally: Character;
    
    beforeEach(() => {
        demon = new Demon("Mateus, le Corrompu", "Hero", { row: 0, col: 0 });
        ally = new Character("Hero_1", "Paladin", "Hero", { row: 1, col: 1 }, new Warrior(), [], null,null,[]);
        ally.job.jobLevel = 20;
        ally.evolveJob("Paladin");
        ally.currentHp=1;

        target = new Character("Hero_2", "Dark Knight", "Enemy", { row: 6, col: 1 }, new Warrior(), [], null,null,[]);
        target.job.jobLevel = 20;
        target.evolveJob("Chevalier Noir");
        target2 = new Character("Hero_3", "Dark Warrior", "Enemy", { row: 6, col: 2 }, new Warrior(), [], null,null,[]);

    });

    test("should create a Demon with correct stats", () => {
        expect(demon.name).toBe("Mateus, le Corrompu");
        expect(demon.stats.strength).toBe(3);
        expect(demon.stats.endurance).toBe(4);
        expect(demon.stats.intelligence).toBe(6);
        expect(demon.actions).toEqual([
            "Congélation",
            "Attaque",
            "Soin +",
            "Glacier X",
            "Onde glacière"
        ]);
    });

    test("should execute actions in order", () => {
        let result = demon.act([target, ally, target2]);
        expect(result[0]).toContain("Mateus, le Corrompu exécute : Congélation");
        expect(demon.currentTurn).toBe(1);
        expect(result).toContain(target.name+" perd 72PV");
        expect(target.currentHp).toBe(0);
        result = demon.act([target, ally, target2]);
        expect(result[0]).toContain("Mateus, le Corrompu exécute : Attaque");
        expect(demon.currentTurn).toBe(2);
        result = demon.act([target, ally, target2]);
        expect(result[0]).toContain("Mateus, le Corrompu exécute : Soin +");
        expect(demon.currentTurn).toBe(3);
        expect(ally.currentHp).toBe(8);
    });

    test("should take damage and reduce endurance", () => {
        let log: string[] = [];
        const isAlive = demon.takeDamage(log);
        
        expect(isAlive).toBe(true);
        expect(demon.stats.endurance).toBe(3);
        expect(log).toContain("Mateus, le Corrompu perd 1 point d'endurance ! Endurance restante : 3");
    });

    test("should disappear when endurance reaches 0", () => {
        let log: string[] = [];
        demon.stats.endurance = 1;
        const isAlive = demon.takeDamage(log);
        
        expect(isAlive).toBe(false);
        expect(log).toContain("Mateus, le Corrompu disparaît !");
    });

    test("should use spell correctly", () => {
        const spell = spellData.find(s => s.name === "Glacier X") as Spell;
        if (!spell) throw new Error("demon.test('should use spell correctly') : Spell not found");

        let result = demon.useSpell(spell, target, 6);
        
        expect(target.currentHp).toBe(0);
    });
});
