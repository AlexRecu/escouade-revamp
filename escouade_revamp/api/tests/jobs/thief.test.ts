import { Character } from "../../src/classes/UnitTypes/Character";
import { Monster } from "../../src/classes/UnitTypes/Monster";
import { Unit } from "../../src/classes/UnitTypes/Unit";
import { Skill } from "../../src/classes/Types";
import { Thief } from "../../src/classes/Jobs/Thief";
import { Dagger } from "../../src/classes/Items/Weapon";
import { Weapon } from "../../src/classes/Items/Weapon";
import { Item } from "../../src/classes/Items/Item";
import {Potion, PotionPlus, Antidote} from "../../src/classes/Items/Consumable";

describe("Thief Class Tests", () => {
    const weapon: Weapon = new Dagger("Dague1", 'Dague en fer', "", 0, 0, 2, "", null);
    let thief: Character;
    let enemy: Unit;
    const potion: Potion = new Potion();
    const potionP: PotionPlus = new PotionPlus();

    beforeEach(() => {
        thief = new Character("1", "TestThief", 'Hero', { row: 0, col: 0 }, 30, 30, [], 10, 10, 10, 10, new Thief(), weapon, null);
        enemy = new Monster("Frelon", { row: 7, col: 7 }, 'Enemy', 2);
        enemy.bag.push(potion, potionP);
        enemy.currentHp = 20;
    });

    test("Thief initializes with correct stats", () => {
        expect(thief.stats.strength).toBe(0);
        expect(thief.stats.dexterity).toBe(2);
        expect(thief.stats.endurance).toBe(1);
        expect(thief.currentAp).toBe(10);
    });

    test("Thief démarre avec la Dague en fer + la Pièce marquée", () => {
        // La Dague en fer est équipée en main droite ; la Pièce marquée (objet
        // de classe, type "special") est dans le sac.
        expect(thief.rightHandWeapon?.name).toBe("Dague en fer");
        const piece = thief.bag.find((i) => i.name === "Pièce marquée");
        expect(piece).toBeDefined();
        expect(piece?.type).toBe("special");
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
        let log = thief.useAbilityByName("Vol", [enemy]);
        expect(log).toContain("TestThief utilise Vol sur "+enemy.name);
        expect(thief.currentAp).toBe(9);
        
        // Le Thief a la Dague en fer + la Pièce marquée (objets de départ) +
        // l'objet volé = 3 objets dans le sac.
        expect(thief.bag.length).toBe(3);
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

    test("Vol sur un monstre sans sac : crée un objet du rang du monstre", () => {
        // En jeu, les monstres n'ont pas de sac : le Vol crée un objet dont le
        // zoneThreshold correspond au rang du monstre (Frelon = rang 1).
        const bareMonster = new Monster("Frelon", { row: 7, col: 7 }, "Enemy", 2);
        expect(bareMonster.bag).toHaveLength(0);
        const bagBefore = thief.bag.length;
        const log = thief.useAbilityByName("Vol", [bareMonster]);
        expect(log.join(" ")).toContain("Obtenu :");
        // Un objet a été ajouté au sac du voleur.
        expect(thief.bag.length).toBe(bagBefore + 1);
        const stolen = thief.bag[thief.bag.length - 1];
        // L'objet volé correspond au rang du monstre (zoneThreshold = 1).
        expect(stolen.zoneThreshold).toBe(1);
    });

    test("Vol sur un monstre déjà volé : rien (anti-exploit)", () => {
        // Un monstre ne peut être volé qu'une fois : le 2e Vol ne crée plus
        // d'objet (sinon = butin infini).
        const bareMonster = new Monster("Frelon", { row: 7, col: 7 }, "Enemy", 2);
        const bagBefore = thief.bag.length;
        const log1 = thief.useAbilityByName("Vol", [bareMonster]);
        expect(log1.join(" ")).toContain("Obtenu :");
        expect(thief.bag.length).toBe(bagBefore + 1);
        // 2e vol sur le même monstre : rien.
        const log2 = thief.useAbilityByName("Vol", [bareMonster]);
        expect(log2.join(" ")).toContain("Aucun objet à voler");
        expect(thief.bag.length).toBe(bagBefore + 1);
    });

    test("Antidote universel retire le statut Poison", () => {
        // La cible est empoisonnée.
        enemy.status.push({ name: "Poison", statusType: "curse", nbTurnEffect: null });
        expect(enemy.status.some(s => s.name === "Poison")).toBe(true);
        // L'Antidote universel guérit le Poison.
        const antidote = new Antidote();
        const log = thief.useItem(antidote, enemy);
        expect(log.join(" ")).toContain("guéri de : Poison");
        expect(enemy.status.some(s => s.name === "Poison")).toBe(false);
    });

    test("Skill Pas de l'ombre warps thief behind target and boost critical rate", () => {
        const log = thief.useAbilityByName("Pas de l'ombre", [thief, enemy]);
        expect(log).toContain("TestThief disparaît comme une ombre");
        expect(log).toContain("TestThief utilise Pas de l'ombre");
        expect(thief.currentMp).toBe(9);
        expect(thief.status.some(status => status.name === "Crit+")).toBe(true);
        expect(thief.position).toStrictEqual({row:6, col:6});
    });

    test("Is in range", () => {
        const enemy2 = new Monster("Frelon", { row: 1, col: 1 }, 'Enemy', 2);
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
        const log = thief.useAbilityByName("Frappe empoisonnée", [thief, enemy]);
        expect(log).toContain("Aucune cible valide à 1 case(s) pour Frappe empoisonnée.");
    });


    test("Thief fails to attack on roll 1 (Échec critique)", () => {
        const log = thief.attack(enemy, 1);
        expect(log).toContain("ECHEC CRITIQUE !");
        expect(enemy.currentHp).toBe(20);
    });

    test("Thief do critical attack on roll 6 with damage X4", () => {
        const log = thief.attack(enemy, 6, 4, weapon.weaponStat - 2);
        expect(log).toContain("COUP CRITIQUE ! (D6 = 4) Dégats x4!");
        expect(enemy.currentHp).toBe(0);
    });

    test("Thief do critical attack on roll 5 with status Crit+ and damage X2", () => {
        thief.useAbilityByName("Pas de l'ombre", [thief, enemy]);
        const log = thief.attack(enemy, 5, 2, weapon.weaponStat - 2);
        expect(log).toContain("COUP CRITIQUE ! (D6 = 2) Dégats x2!");
        expect(enemy.currentHp).toBe(0);
    });

    test("Thief useAbility Vortex", () => {
        const enemy2 = new Monster("Frelon", { row: 2, col: 1 }, 'Enemy', 2);
        enemy2.currentHp = 100;
        const enemy3 = new Monster("Frelon", { row: 1, col: 1 }, 'Enemy', 2);
        enemy3.currentHp = 20;
        const log = thief.useAbilityByName("Vortex", [enemy, enemy2, enemy3]);
        expect(log).toContain("TestThief utilise Vortex sur "+enemy2.name+","+enemy3.name);
        expect(thief.currentAp).toBe(8);
        expect(enemy.currentHp).toBe(20);
        expect(enemy2.currentHp).toBe(100 - ((thief.stats.dexterity + 5 - 1) * weapon.weaponStat));
        expect(enemy3.currentHp).toBe(20 - ((thief.stats.dexterity + 5 - 1) * weapon.weaponStat));
    });

    test("Thief useAbility Frappe critique", () => {
        const enemy2 = new Monster("Frelon", { row: 1, col: 1 }, 'Enemy', 2);
        enemy2.currentHp = 100;
        const enemy3 = new Monster("Frelon", { row: 2, col: 1 }, 'Enemy', 2);
        enemy3.currentHp = 20;
        const log = thief.useAbilityByName("Frappe critique", [enemy,enemy2,enemy3]);
        expect(log).toContain("TestThief utilise Frappe critique sur "+enemy2.name);
        expect(enemy.currentHp).toBe(20);
        expect(enemy2.currentHp).toBe(76);
        expect(enemy3.currentHp).toBe(20);
        expect(thief.currentAp).toBe(7);
    });
});
