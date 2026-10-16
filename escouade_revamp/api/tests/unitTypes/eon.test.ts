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

        const log = phoenix.useAbilityByName("Eclipse de Phoenix", [targetUnit]);
        expect(phoenix.position).toEqual({ row: 6, col: 4 });
    });

    test("Feu résurrecteur inflige des dégâts", () => {
        const phoenix = new Eon(casterChar, "Phoenix");

        const log = phoenix.useAbilityByName("Feu résurrecteur", [targetUnit]);
        expect(targetUnit.currentHp).toBe(915); 
        expect(log.some(l => l.includes("perd"))).toBe(true);
    });

    test("Glissade de Shiva applique Paralysie", () => {
        const log = eon.useAbilityByName("Glissade de Shiva", [targetUnit]);
        expect(eon.position).toEqual({ row: 6, col: 4 });
        const hasParalysis = targetUnit.status.some((s: Status) => s.name === "Paralysie");
        expect(hasParalysis).toBe(true);
    });

    test("Eruption de glace inflige des dégâts et pousse la cible", () => {
        targetUnit.position = { row: 3, col: 3 };
        const log = eon.useAbilityByName("Eruption de glace", [targetUnit]);

        expect(targetUnit.currentHp).toBe(987); 
        expect(targetUnit.position).toEqual({ row: 2, col: 2 });
    });

    test("Frimas frigorifiant inflige des dégâts et attire la cible", () => {
        targetUnit.position = { row: 6, col: 6 };
        const log = eon.useAbilityByName("Frimas frigorifiant", [targetUnit]);
        expect(targetUnit.currentHp).toBe(987); 
        expect(targetUnit.position).toEqual({ row: 5, col: 5 });
    });

    test("Poussière de diamant inflige des dégâts et applique Paralysie", () => {

        const log = eon.useAbilityByName("Poussière de diamant", [targetUnit]);
        const hasParalysis = targetUnit.status.some((s: Status) => s.name === "Paralysie");

        expect(targetUnit.currentHp).toBe(915);
        expect(hasParalysis).toBe(true);
    });

    test("Titan - Fureur tellurique inflige dégâts et déplace l'ennemi", () => {
        const titan = new Eon(casterChar, "Titan");
        const logs = titan.useAbilityByName("Fureur tellurique", [targetUnit]);
        expect(targetUnit.currentHp).toBe(915);
        expect(targetUnit.position).toEqual({ row: 0, col: 0 });
    });

    test("Garuda - Etreinte de Garuda attire l'ennemi", () => {
        const garuda = new Eon(casterChar, "Garuda");
        const logs = garuda.useAbilityByName("Etreinte de Garuda", [targetUnit]);
        expect(targetUnit.position).toEqual({ row: 5, col: 4 });
    });

    test("Ramuh - Justice de Ramuh inflige dégâts avec formule", () => {
        const ramuh = new Eon(casterChar, "Ramuh");
        const logs = ramuh.useAbilityByName("Justice de Ramuh", [targetUnit]);
        expect(targetUnit.currentHp).toBe(988);
    });

    test("Odin - Lame d'Odin inflige dégâts avec formule", () => {
        const odin = new Eon(casterChar, "Odin");
        const logs = odin.useAbilityByName("Lame d'Odin", [targetUnit]);
        expect(targetUnit.currentHp).toBe(988);
    });

    test("Phoenix - Cyclone écarlate inflige des dégâts de feu", () => {
        const phoenix = new Eon(casterChar, "Phoenix");
        const hpBefore = targetUnit.currentHp;
        const log = phoenix.useAbilityByName("Cyclone écarlate", [targetUnit]);
        expect(targetUnit.currentHp).toBeLessThan(hpBefore);
        expect(log.some(l => l.includes("perd"))).toBe(true);
    });

    test("Phoenix - Onde incendiaire inflige des dégâts et érige une barrière", () => {
        const phoenix = new Eon(casterChar, "Phoenix");
        const hpBefore = targetUnit.currentHp;
        const log = phoenix.useAbilityByName("Onde incendiaire", [targetUnit]);
        expect(targetUnit.currentHp).toBeLessThan(hpBefore);
        expect(phoenix.damageBlocked).toBe(true);
        expect(log.some(l => l.includes("barrière"))).toBe(true);
    });

    test("Garuda - Virevolte captivante inflige des dégâts et érige une barrière", () => {
        const garuda = new Eon(casterChar, "Garuda");
        const hpBefore = targetUnit.currentHp;
        const log = garuda.useAbilityByName("Virevolte captivante", [targetUnit]);
        expect(targetUnit.currentHp).toBeLessThan(hpBefore);
        expect(garuda.damageBlocked).toBe(true);
    });

    test("Garuda - Rafale aérienne inflige des dégâts et soigne les alliés", () => {
        const garuda = new Eon(casterChar, "Garuda");
        garuda.currentHp = garuda.maxHp - 20; // blesser l'Eon pour voir le soin
        const hpBefore = targetUnit.currentHp;
        const eonHpBefore = garuda.currentHp;
        // L'Eon est dans allUnits pour que le Soin+ s'applique à lui-même (allié)
        const log = garuda.useAbilityByName("Rafale aérienne", [targetUnit, garuda]);
        expect(targetUnit.currentHp).toBeLessThan(hpBefore);
        expect(garuda.currentHp).toBe(eonHpBefore + 7); // Soin+ sur l'allié (lui-même)
        expect(log.some(l => l.includes("récupère 7PV"))).toBe(true);
    });

    test("Titan - Blocage de Titan bloque les dégâts reçus", () => {
        const titan = new Eon(casterChar, "Titan");
        const log = titan.useAbilityByName("Blocage de Titan", [titan]);
        expect(titan.damageBlocked).toBe(true);
        expect(log.some(l => l.includes("bloque les degats"))).toBe(true);
        // Une attaque subie n'inflige aucun dégât tant que le blocage est actif
        const hpBefore = titan.currentHp;
        titan.applyDamage(50, []);
        expect(titan.currentHp).toBe(hpBefore);
    });

    test("Le blocage d'un Eon est levé au début de son prochain tour", () => {
        const titan = new Eon(casterChar, "Titan");
        titan.damageBlocked = true;
        // Simulation du début de tour (PhaseSystem.startUnitTurn reset le blocage)
        const { PhaseSystem } = require("../../src/classes/Combat/PhaseSystem");
        const { CombatState } = require("../../src/classes/Combat/CombatState");
        const state = new CombatState([titan]);
        const phases = new PhaseSystem(state);
        phases.startUnitTurn(titan);
        expect(titan.damageBlocked).toBe(false);
    });
});
