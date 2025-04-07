import { Warrior } from "../../src/classes/Jobs/Warrior";
import { WhiteMage } from "../../src/classes/Jobs/WhiteMage";
import { Spell } from "../../src/classes/Types";
import { Character } from "../../src/classes/UnitTypes/Character";
import { Monster } from "../../src/classes/UnitTypes/Monster";
import { manageStatusAfterPhase, manageStatusBeforePhase } from "../../src/utils/StatusUtils";

describe("White Mage Spell Tests", () => {
    let whiteMage: Character;
    let ally: Character;
    let enemy: Monster;

    beforeEach(() => {
        whiteMage = new Character("WM1", "TestWhiteMage", 'Hero', { row: 0, col: 0 }, new WhiteMage(), null, null); 
        ally = new Character("W2", "Ally", 'Hero', { row: 3, col: 1 }, new Warrior(), null, null);
        enemy = new Monster("M1", 1,"Enemy1", { row: 1, col: 1 }, [], [], [1], [20], [100], [100], 1, [],["Sacré"]);
    });

    test("Warrior initializes with correct stats", () => {
        expect(whiteMage.stats.strength).toBe(0);
        expect(whiteMage.stats.endurance).toBe(1);
        expect(whiteMage.stats.mana).toBe(3);
        expect(whiteMage.currentHp).toBe(11);
        expect(whiteMage.currentMp).toBe(13);
        expect(whiteMage.currentAp).toBe(10);
    });

    test("Soin soigne 3 PV d'un allié", () => {
        ally.currentHp = 5; // L'allié a 5 HP
        const spells : Spell[] = whiteMage.getAvailableSpells();
        const soinIndex: number = spells.findIndex(spell=> spell.name === "Soin");
        if(soinIndex !== -1){
            whiteMage.useSpellFromName("Soin", ally, 6, 1);
        }
        expect(ally.currentHp).toBe(8); // Vérifie que 3 HP ont été rendus
    });

    test("Grâce rend un peu de PV à chaque tour", () => {
        ally.currentHp = 5; // L'allié a perdu 10 HP
        whiteMage.job.jobLevel = 10;
        const spells : Spell[] = whiteMage.getAvailableSpells();
        const graceIndex: number = spells.findIndex(spell=> spell.name === "Grâce");
        expect(graceIndex).toBeGreaterThanOrEqual(0);
        if(graceIndex !== -1){
            whiteMage.useSpellFromName("Grâce", ally, 6, 1);
        }
        let log = manageStatusBeforePhase(ally);
        expect(log).toStrictEqual(["Ally est sous statut Grâce."]);
        expect(ally.status).toContainEqual({counterItem: undefined, name: "Grâce", nbTurnEffect: 3, statusType: "boon"});
        log = manageStatusAfterPhase(ally);
        expect(log).toStrictEqual(["Ally récupère 2 PV grâce à Grâce."]);
        expect(ally.status).toContainEqual({counterItem: undefined, name: "Grâce", nbTurnEffect: 2, statusType: "boon"});
        expect(ally.currentHp).toBe(7);
    });

    test("Lumen inflige des dégâts aux ennemis", () => {
        whiteMage.job.jobLevel = 18;
        const spells : Spell[] = whiteMage.getAvailableSpells();
        const lumenIndex: number = spells.findIndex(spell=> spell.name === "Lumen");
        whiteMage.useSpellFromName("Lumen", enemy, 6, 1);
        expect(enemy.currentHp).toBeLessThan(20); // Vérifie que des dégâts ont été appliqués
        const enemy2 = new Monster("M2", 1,"Zombie1", { row: 1, col: 1 }, [], [], [1], [100], [100], [100], 1, [],["Sacré"]);
        const log = whiteMage.useSpellFromName("Lumen", enemy2, 6, 1);
        expect(log).toContain("C'est super efficace !");
        expect(enemy2.currentHp).toBe(44);
    });

    // test("Soin + soigne 7 PV d'un allié", () => {
    //     ally.currentHp = 30;
    //     whiteMage.useSpellFromName("Soin +", ally);
    //     expect(ally.currentHp).toBe(37);
    // });

    // test("Barrière protège contre les altérations de statut", () => {
    //     whiteMage.useSpellFromName("Barrière", ally);
    //     expect(ally.status).toContainEqual({ name: "Barrière", duration: 3 });
    // });

    // test("Vie ressuscite un allié KO", () => {
    //     ally.currentHp = 0;
    //     whiteMage.useSpellFromName("Vie", ally);
    //     expect(ally.currentHp).toBeGreaterThan(0);
    // });

    // test("Vie X restaure plus de PV à un allié KO", () => {
    //     ally.currentHp = 0;
    //     whiteMage.useSpellFromName("Vie X", ally);
    //     expect(ally.currentHp).toBe(20); // Supposons que Vie X rende 20 HP
    // });

    // test("Sidéral inflige une puissante attaque magique", () => {
    //     whiteMage.useSpellFromName("Sidéral", enemy);
    //     expect(enemy.currentHp).toBeLessThan(35); // Supposons que Sidéral inflige 15 dégâts
    // });
});
