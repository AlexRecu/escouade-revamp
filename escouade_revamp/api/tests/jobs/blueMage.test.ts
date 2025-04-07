import { Warrior } from "../../src/classes/Jobs/Warrior";
import { WhiteMage } from "../../src/classes/Jobs/WhiteMage";
import { BlueMage } from "../../src/classes/Jobs/BlueMage";
import { Skill, Spell } from "../../src/classes/Types";
import { Character } from "../../src/classes/UnitTypes/Character";
import { Monster } from "../../src/classes/UnitTypes/Monster";
import { Sword } from "../../src/classes/Items/Weapon";
import { Weapon } from "../../src/classes/Items/Weapon";
import { Monstronomicon } from "../../src/classes/Items/Monstronomicon";

describe("Blue Mage Class Tests", () => {
    let whiteMage: Character;
    let blueMage: Character;
    const weapon: Weapon = new Sword("Epee1", "Epee", "", 0, 0, 2, "", null);
    let warriorEnemy: Character;
    let enemy: Monster;

    beforeEach(() => {
        blueMage = new Character("BM1", "TestBlueMage", 'Hero', { row: 0, col: 0 }, new BlueMage(), weapon, null);
        whiteMage = new Character("WM1", "TestWhiteMage", 'Enemy', { row: 0, col: 7 }, new WhiteMage(), null, null);
        warriorEnemy = new Character("W2", "EnemyWarrior", 'Enemy', { row: 3, col: 1 }, new Warrior(), null, null);
        enemy = new Monster("M1", 1, "Enemy1", { row: 1, col: 1 }, [], [], [1], [20], [100], [100], 1, [], ["Sacré"]);
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
        const highRankEnemy = new Monster("M2", 6, "highRankEnemy", { row: 0, col: 1 }, [], [], [1], [20], [100], [100], 1, [], ["Sacré"]);
        const monstronomiconIndex: number = blueMage.bag.findIndex(item => item.name === "Monstronomicon")
        expect(monstronomiconIndex).toBeGreaterThanOrEqual(0);
        let monstronomicon: Monstronomicon = blueMage.bag[monstronomiconIndex] as Monstronomicon;
        expect(monstronomicon.units).toStrictEqual([]);

        let log = blueMage.useAbility("Scan", [highRankEnemy]);
        expect(log).toContain(highRankEnemy.name+" est trop puissant pour être étudié");
        expect(monstronomicon.units).toStrictEqual([]);

        log = blueMage.useAbility("Scan", [enemy]);
        expect(log).toContain(`${enemy.name} a bien été ajoutée au monstronomicon`);
        expect(monstronomicon.units).toStrictEqual([enemy]);
    });

    test("Apprendre marche uniquement si le monstre est dans le monstronomicon", () => {
        let log = blueMage.useAbility("Apprendre", [enemy]);
        expect(log).toContain(`${enemy.name} doit d'abord être étudié`);
        blueMage.useAbility("Scan", [enemy]);
        log = blueMage.useAbility("Apprendre", [enemy]);
        expect(log).toContain(`${enemy.name} n'a aucune attaque à apprendre.`);
        enemy.monsterSkills.push({
            name: "Dard empoisonné",
            description: "invoque un dard de frelon",
            condition: "this.attack(target,2,1, 0, resultArray);",
            target: "nearest",
            move: 0,
            range: 1,
            turn: 0,
            zoneEffect: 0,
            status: {
                "name": "Poison",
                "statusType": "curse",
                "nbTurnEffect": null,
                "chance": 30
              },
            chance: 30,
            deathMessage: ""
        });
        log = blueMage.useAbility("Apprendre", [enemy]);
        expect(log).toContain(`Mage Bleu a appris une nouvelle compétence : Dard empoisonné !`);
        const abilities: Omit<Skill, "formula">[] = blueMage.getAvailableAbilities();
        expect(abilities.length).toBe(3);
        expect(abilities[0].name).toBe("Scan");
        expect(abilities[1].name).toBe("Apprendre");
        expect(abilities[2].name).toBe("Dard empoisonné");
        log = blueMage.useAbility("Dard empoisonné", [enemy]);
        expect(log).toContain(`${blueMage.name} utilise Dard empoisonné sur ${enemy.name}`);
        expect(enemy.currentHp).toBe(enemy.maxHp-6);
    });

    test("Apprendre marche aussi sur les skills de classe", () => {
        warriorEnemy.job.jobLevel=1;
        let log = blueMage.useAbility("Scan", [warriorEnemy]);
        expect(log).toContain(`La classe "${warriorEnemy.job.name}" a bien été ajoutée au monstronomicon`);
        log = blueMage.useAbility("Apprendre", [warriorEnemy]);
        
        expect(log).toContain(`Mage Bleu a appris une compétence de classe : "Bouclier impénétrable" !`);
        const abilities: Omit<Skill, "formula">[] = blueMage.getAvailableAbilities();
        expect(abilities.length).toBe(3);
        expect(abilities[0].name).toBe("Scan");
        expect(abilities[1].name).toBe("Apprendre");
        expect(abilities[2].name).toBe("Bouclier impénétrable");
    });

    test("Apprendre marche aussi sur les sorts de classe", () => {
        whiteMage.job.jobLevel=1;
        let log = blueMage.useAbility("Scan", [whiteMage]);
        expect(log).toContain(`La classe "${whiteMage.job.name}" a bien été ajoutée au monstronomicon`);
        log = blueMage.useAbility("Apprendre", [whiteMage]);
        
        expect(log[1]).toMatch(new RegExp(`Mage Bleu a appris le sort [S,R][a-z]* !`));
        const abilities: Omit<Skill, "formula">[] = blueMage.getAvailableAbilities();
        expect(abilities.length).toBe(2);
        expect(abilities[0].name).toBe("Scan");
        expect(abilities[1].name).toBe("Apprendre");
        const spells = blueMage.getAvailableSpells();
        expect(spells.length).toBe(1);
    });
});