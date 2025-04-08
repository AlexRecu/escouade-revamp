import { Status } from "../../src/classes/Status";
import { Character } from "../../src/classes/UnitTypes/Character";
import { Unit } from "../../src/classes/UnitTypes/Unit";
import { Eon } from "../../src/classes/UnitTypes/Eon";
import { BlueMage } from "../../src/classes/Jobs/BlueMage";
import { WhiteMage } from "../../src/classes/Jobs/WhiteMage";

describe("Eon Abilities", () => {
    let casterChar: Character;
    let targetUnit: Unit;
    let eon: Eon;

    beforeEach(() => {
        casterChar = new Character("1", "Mage bleu", "Hero", { row: 5, col: 5 }, new BlueMage(), null, null, []);

        targetUnit = new Character("2", "Mage blanc", "Enemy", { row: 6, col: 5 }, new WhiteMage(), null, null, []);
        targetUnit.currentHp = 1000;

        eon = new Eon(casterChar, "Shiva");
    });

    test("Eon a les mêmes statistiques que le caster", () => {
        const phoenix = new Eon(casterChar, "Phoenix");
        expect(phoenix.stats.intelligence).toBe(2);
        expect(phoenix.stats.intelligence).toBe(casterChar.stats.intelligence);
    });

    test("Eclipse de Phoenix déplace l’Eon", () => {
        const phoenix = new Eon(casterChar, "Phoenix");

        const log = phoenix.useEonAbility("Eclipse de Phoenix", [targetUnit]);
        expect(phoenix.position).toEqual({ row: 6, col: 4 });
    });

    test("Feu résurrecteur inflige des dégâts", () => {
        const phoenix = new Eon(casterChar, "Phoenix");

        const log = phoenix.useEonAbility("Feu résurrecteur", [targetUnit]);
        expect(targetUnit.currentHp).toBe(915); 
        expect(log.some(l => l.includes("perd"))).toBe(true);
    });

    test("Glissade de Shiva applique Paralysie", () => {
        const log = eon.useEonAbility("Glissade de Shiva", [targetUnit]);
        expect(eon.position).toEqual({ row: 6, col: 4 });
        const hasParalysis = targetUnit.status.some((s: Status) => s.name === "Paralysie");
        expect(hasParalysis).toBe(true);
    });

    test("Eruption de glace inflige des dégâts et pousse la cible", () => {
        targetUnit.position = { row: 3, col: 3 };
        const log = eon.useEonAbility("Eruption de glace", [targetUnit]);

        expect(targetUnit.currentHp).toBe(987); 
        expect(targetUnit.position).toEqual({ row: 2, col: 2 });
    });

    test("Frimas frigorifiant inflige des dégâts et attire la cible", () => {
        targetUnit.position = { row: 6, col: 6 };
        const log = eon.useEonAbility("Frimas frigorifiant", [targetUnit]);
        expect(targetUnit.currentHp).toBe(987); 
        expect(targetUnit.position).toEqual({ row: 5, col: 5 });
    });

    test("Poussière de diamant inflige des dégâts et applique Paralysie", () => {

        const log = eon.useEonAbility("Poussière de diamant", [targetUnit]);
        const hasParalysis = targetUnit.status.some((s: Status) => s.name === "Paralysie");

        expect(targetUnit.currentHp).toBe(915);
        expect(hasParalysis).toBe(true);
    });

    test("Titan - Fureur tellurique inflige dégâts et déplace l'ennemi", () => {
        const titan = new Eon(casterChar, "Titan");
        const logs = titan.useEonAbility("Fureur tellurique", [targetUnit]);
        expect(targetUnit.currentHp).toBe(915);
        expect(targetUnit.position).toEqual({ row: 0, col: 0 });
    });

    test("Garuda - Etreinte de Garuda attire l'ennemi", () => {
        const garuda = new Eon(casterChar, "Garuda");
        const logs = garuda.useEonAbility("Etreinte de Garuda", [targetUnit]);
        expect(targetUnit.position).toEqual({ row: 5, col: 4 });
    });

    test("Ramuh - Justice de Ramuh inflige dégâts avec formule", () => {
        const ramuh = new Eon(casterChar, "Ramuh");
        const logs = ramuh.useEonAbility("Justice de Ramuh", [targetUnit]);
        expect(targetUnit.currentHp).toBe(988);
    });

    test("Odin - Lame d'Odin inflige dégâts avec formule", () => {
        const odin = new Eon(casterChar, "Odin");
        const logs = odin.useEonAbility("Lame d'Odin", [targetUnit]);
        expect(targetUnit.currentHp).toBe(988);
    });
});
