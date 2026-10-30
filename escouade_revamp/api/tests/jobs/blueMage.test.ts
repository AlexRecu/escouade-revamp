import { Warrior } from "../../src/classes/Jobs/Warrior";
import { WhiteMage } from "../../src/classes/Jobs/WhiteMage";
import { BlueMage } from "../../src/classes/Jobs/BlueMage";
import { Skill, Spell } from "../../src/classes/Types";
import { Character } from "../../src/classes/UnitTypes/Character";
import { Monster } from "../../src/classes/UnitTypes/Monster";
import { Sword } from "../../src/classes/Items/Weapon";
import { Weapon } from "../../src/classes/Items/Weapon";
import { Monstronomicon } from "../../src/classes/Items/Monstronomicon";
// import { Unit } from "../../src/classes/UnitTypes/Unit";

describe("Blue Mage Class Tests", () => {
    let blueMage: Character;
    let whiteMage: Character;
    const weapon: Weapon = new Sword("Epee1", "Epee", "", 0, 0, 2, "", null);
    let warriorEnemy: Character;
    let enemy: Monster;

    beforeEach(() => {
        blueMage = new Character("BM1", "TestBlueMage", 'Hero', { row: 0, col: 0 }, new BlueMage(), null, null);
        whiteMage = new Character("WM1", "TestWhiteMage", 'Enemy', { row: 0, col: 7 }, new WhiteMage(), null, null);
        warriorEnemy = new Character("W2", "EnemyWarrior", 'Enemy', { row: 3, col: 1 }, new Warrior(), null, null);
        enemy = new Monster("Frelon", { row: 1, col: 1 }, 'Enemy', 2);
    });

    test("BlueMage initializes with correct stats", () => {
        expect(blueMage.stats.strength).toBe(1);
        expect(blueMage.stats.endurance).toBe(1);
        expect(blueMage.currentAp).toBe(10);
    });

    test("BlueMage gets abilities based on level", () => {
        blueMage.job.jobLevel = 1;
        const abilities: Omit<Skill, "formula">[] = blueMage.getAvailableAbilities();
        expect(abilities.length).toBe(2);
        expect(abilities[0].name).toBe("Scan");
        expect(abilities[1].name).toBe("Apprendre");
    });

    test("Scan does not work on High Rank Enemy", () => {
        const highRankEnemy = new Monster("Chevalier mort vivant", { row: 0, col: 1 }, 'Enemy', 2);
        const monstronomiconIndex: number = blueMage.bag.findIndex(item => item.name === "Monstronomicon")
        expect(monstronomiconIndex).toBeGreaterThanOrEqual(0);
        let monstronomicon: Monstronomicon = blueMage.bag[monstronomiconIndex] as Monstronomicon;
        expect(monstronomicon.entries).toStrictEqual([]);

        let log = blueMage.useAbilityByName("Scan", [highRankEnemy]);
        expect(log).toContain(highRankEnemy.name + " est trop puissant pour être étudié");
        expect(monstronomicon.entries).toStrictEqual([]);

        log = blueMage.useAbilityByName("Scan", [enemy]);
        expect(log).toContain(`${enemy.name} a bien été ajoutée au monstronomicon`);
        expect(monstronomicon.entries).toStrictEqual([{ name: enemy.name, isLearned: false }]);
    });

    test("Apprendre marche uniquement si le monstre est dans le monstronomicon", () => {
        let log = blueMage.useAbilityByName("Apprendre", [enemy]);
        expect(log).toContain(`${enemy.name} doit d'abord être étudié`);
        blueMage.useAbilityByName("Scan", [enemy]);
        log = blueMage.useAbilityByName("Apprendre", [enemy]);
        expect(log).toContain(`Mage Bleu a appris une nouvelle compétence : Dard empoisonné !`);
        const abilities: Omit<Skill, "formula">[] = blueMage.getAvailableAbilities();
        expect(abilities.length).toBe(3);
        expect(abilities[0].name).toBe("Scan");
        expect(abilities[1].name).toBe("Apprendre");
        expect(abilities[2].name).toBe("Dard empoisonné");
        log = blueMage.useAbilityByName("Dard empoisonné", [enemy]);
        expect(log).toContain(`${blueMage.name} utilise Dard empoisonné sur ${enemy.name}`);
        expect(enemy.currentHp).toBe(enemy.maxHp - 6);
    });

    test("Apprendre marche aussi sur les skills de classe", () => {
        warriorEnemy.job.jobLevel = 1;
        let log = blueMage.useAbilityByName("Scan", [warriorEnemy]);
        expect(log).toContain(`La classe "${warriorEnemy.job.name}" a bien été ajoutée au monstronomicon`);
        log = blueMage.useAbilityByName("Apprendre", [warriorEnemy]);

        expect(log).toContain(`Mage Bleu a appris une compétence de classe : "Bouclier impénétrable" !`);
        const abilities: Omit<Skill, "formula">[] = blueMage.getAvailableAbilities();
        expect(abilities.length).toBe(3);
        expect(abilities[0].name).toBe("Scan");
        expect(abilities[1].name).toBe("Apprendre");
        expect(abilities[2].name).toBe("Bouclier impénétrable");
    });

    test("Apprendre marche aussi sur les sorts de classe", () => {
        whiteMage.job.jobLevel = 1;
        let log = blueMage.useAbilityByName("Scan", [whiteMage]);
        expect(log).toContain(`La classe "${whiteMage.job.name}" a bien été ajoutée au monstronomicon`);
        log = blueMage.useAbilityByName("Apprendre", [whiteMage]);

        expect(log[1]).toMatch(new RegExp(`Mage Bleu a appris le sort [S,R][a-z]* !`));
        const abilities: Omit<Skill, "formula">[] = blueMage.getAvailableAbilities();
        expect(abilities.length).toBe(2);
        expect(abilities[0].name).toBe("Scan");
        expect(abilities[1].name).toBe("Apprendre");
        const spells = blueMage.getAvailableSpells();
        expect(spells.length).toBe(1);
    });

    test("getMonstronomiconData dérive les détails du bestiaire", () => {
        blueMage.useAbilityByName("Scan", [enemy]); // Frelon (rank 1, Physique)
        const data = (blueMage.job as BlueMage).getMonstronomiconData();
        expect(data).toHaveLength(1);
        expect(data[0].name).toBe("Frelon");
        expect(data[0].isMonster).toBe(true);
        expect(data[0].rank).toBe(1);
        expect(data[0].attackType).toBe("Physique");
        expect(data[0].pvByZone).toHaveLength(6);
        expect(data[0].attacks).toContain("Dard empoisonné");
        expect(data[0].isLearned).toBe(false);
    });

    test("markLearned marque l'attaque apprise", () => {
        blueMage.useAbilityByName("Scan", [enemy]);
        const mono = (blueMage.job as BlueMage).monstronomicon;
        mono.markLearned(enemy.name, "Dard empoisonné");
        const data = (blueMage.job as BlueMage).getMonstronomiconData();
        expect(data[0].isLearned).toBe(true);
        expect(data[0].learnedAttack).toBe("Dard empoisonné");
    });

    test("Les entries du Monstronomicon survivent au round-trip de sérialisation", () => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { CharacterFactory } = require("../../src/services/factory/CharacterFactory");
        blueMage.useAbilityByName("Scan", [enemy]);
        (blueMage.job as BlueMage).monstronomicon.markLearned(enemy.name, "Dard empoisonné");

        const serialized = CharacterFactory.toSerialized(blueMage);
        expect(serialized.classe.monstronomiconEntries).toHaveLength(1);

        const restored = CharacterFactory.fromSerialized(serialized);
        const restoredMono = (restored.job as BlueMage).monstronomicon;
        expect(restoredMono.entries).toHaveLength(1);
        expect(restoredMono.entries[0].name).toBe("Frelon");
        expect(restoredMono.entries[0].isLearned).toBe(true);
        expect(restoredMono.entries[0].learnedAttack).toBe("Dard empoisonné");
    });
});