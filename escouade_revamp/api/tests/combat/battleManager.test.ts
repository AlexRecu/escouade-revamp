import { BattleManager, DiceRoller } from "../../src/classes/Combat/BattleManager";
import { CombatState } from "../../src/classes/Combat/CombatState";
import { PhaseSystem } from "../../src/classes/Combat/PhaseSystem";
import { Character } from "../../src/classes/UnitTypes/Character";
import { Monster } from "../../src/classes/UnitTypes/Monster";
import { Warrior } from "../../src/classes/Jobs/Warrior";
import { WhiteMage } from "../../src/classes/Jobs/WhiteMage";

/**
 * Fabrique un héros Guerrier à une position donnée.
 */
function makeWarrior(id: string, row: number, col: number): Character {
    return new Character(
        id,
        `Guerrier ${id}`,
        "Hero",
        { row, col },
        new Warrior(),
        null,
        null
    );
}

/**
 * Fabrique un Mage blanc à une position donnée.
 */
function makeWhiteMage(id: string, row: number, col: number): Character {
    return new Character(
        id,
        `Mage ${id}`,
        "Hero",
        { row, col },
        new WhiteMage(),
        null,
        null
    );
}

/**
 * Fabrique un monstre Frelon (rank 1) à une position donnée.
 */
function makeFrelon(row: number, col: number): Monster {
    return new Monster("Frelon", { row, col }, "Enemy", 1);
}

/**
 * Tireur de dés déterministe : renvoie les valeurs de la file, puis boucle sur la dernière.
 */
function sequenceRoller(values: number[]): DiceRoller {
    let i = 0;
    return () => {
        const v = values[i % values.length];
        i++;
        return v;
    };
}

describe("CombatState", () => {
    test("sépare héros et ennemis", () => {
        const hero = makeWarrior("h1", 0, 0);
        const enemy = makeFrelon(3, 3);
        const state = new CombatState([hero, enemy]);

        expect(state.heroes).toHaveLength(1);
        expect(state.enemies).toHaveLength(1);
        expect(state.aliveUnits).toHaveLength(2);
    });

    test("buildActionOrder trie par vitesse décroissante", () => {
        const slowHero = makeWarrior("slow", 0, 0); // Dex 1
        const fastHero = makeWhiteMage("fast", 0, 1); // Dex plus élevée
        const state = new CombatState([slowHero, fastHero]);
        const order = state.buildActionOrder();

        // Le plus rapide doit être en premier.
        expect(state.getSpeed(order[0])).toBeGreaterThanOrEqual(state.getSpeed(order[1]));
    });

    test("checkEnd détecte la victoire quand plus aucun ennemi", () => {
        const hero = makeWarrior("h1", 0, 0);
        const enemy = makeFrelon(3, 3);
        const state = new CombatState([hero, enemy]);

        expect(state.checkEnd()).toBe(false);
        enemy.currentHp = 0;
        expect(state.checkEnd()).toBe(true);
        expect(state.result).toBe("victory");
    });

    test("checkEnd détecte la défaite quand plus aucun héros", () => {
        const hero = makeWarrior("h1", 0, 0);
        const enemy = makeFrelon(3, 3);
        const state = new CombatState([hero, enemy]);

        hero.currentHp = 0;
        expect(state.checkEnd()).toBe(true);
        expect(state.result).toBe("defeat");
    });
});

describe("CombatState — double action des monstres lents", () => {
    test("shouldActTwice : 2×rang < Dextérité du héros ciblé", () => {
        const hero = makeWarrior("h1", 0, 0);
        const enemy = makeFrelon(3, 3); // rank 1 → 2×rang = 2
        const state = new CombatState([hero, enemy]);

        // Héros Dex 2 : 2 < 2 = false → le Frelon n'agit qu'une fois.
        hero.stats.dexterity = 2;
        expect(state.shouldActTwice(enemy)).toBe(false);
        // Héros Dex 4 : 2 < 4 = true → le Frelon agit deux fois.
        hero.stats.dexterity = 4;
        expect(state.shouldActTwice(enemy)).toBe(true);
    });

    test("shouldActTwice : un héros n'agit jamais deux fois", () => {
        const hero = makeWarrior("h1", 0, 0);
        const enemy = makeFrelon(3, 3);
        const state = new CombatState([hero, enemy]);
        hero.stats.dexterity = 10;
        expect(state.shouldActTwice(hero)).toBe(false);
    });

    test("computeActionOrder : le monstre lent apparaît 2× en fin de file", () => {
        const hero = makeWarrior("h1", 0, 0);
        const enemy = makeFrelon(3, 3); // rank 1
        const state = new CombatState([hero, enemy]);
        hero.stats.dexterity = 4; // 2 < 4 → double action

        const order = state.computeActionOrder();
        // Héros (vitesse 4) d'abord, puis le Frelon 2× en fin de file.
        expect(order).toHaveLength(3);
        expect(order[0]).toBe(hero);
        expect(order[1]).toBe(enemy);
        expect(order[2]).toBe(enemy);
    });

    test("computeActionOrder : monstre rapide = 1 seule entrée", () => {
        const hero = makeWarrior("h1", 0, 0);
        const enemy = makeFrelon(3, 3); // rank 1
        const state = new CombatState([hero, enemy]);
        hero.stats.dexterity = 2; // 2 < 2 = false → simple action

        const order = state.computeActionOrder();
        expect(order).toHaveLength(2);
        expect(order.filter((u) => u === enemy)).toHaveLength(1);
    });

    test("canAct est false si l'unité est endormie", () => {
        const hero = makeWarrior("h1", 0, 0);
        const enemy = makeFrelon(3, 3);
        const state = new CombatState([hero, enemy]);
        const phases = new PhaseSystem(state);

        hero.canAct = false;
        expect(phases.canAct(hero)).toBe(false);
    });
});

describe("BattleManager", () => {
    test("moveUnit refuse une case occupée", () => {
        const hero = makeWarrior("h1", 0, 0);
        const enemy = makeFrelon(0, 1);
        const bm = new BattleManager([hero, enemy], sequenceRoller([3]));

        const msg = bm.moveUnit(hero, { row: 0, col: 1 });
        expect(msg).toContain("occupée");
    });

    test("moveUnit refuse une position hors plateau", () => {
        const hero = makeWarrior("h1", 0, 0);
        const enemy = makeFrelon(3, 3);
        const bm = new BattleManager([hero, enemy], sequenceRoller([3]));

        const msg = bm.moveUnit(hero, { row: 99, col: 0 });
        expect(msg).toContain("hors du plateau");
    });

    test("performAction attaque inflige des dégâts (roll favorable)", () => {
        const hero = makeWarrior("h1", 0, 0);
        const enemy = makeFrelon(0, 1);
        const initialHp = enemy.currentHp;
        // roll = 6 (touche + crit), critRoll = 6
        const bm = new BattleManager([hero, enemy], sequenceRoller([6, 6]));

        const log = bm.performAction(hero, "attack", [enemy], { roll: 6, critRoll: 6 });
        expect(enemy.currentHp).toBeLessThan(initialHp);
        expect(log.length).toBeGreaterThan(0);
    });

    test("run simule un combat jusqu'à un résultat", () => {
        const hero = makeWarrior("h1", 0, 0);
        const enemy = makeFrelon(0, 1);
        // Rolls favorables aux héros pour finir vite.
        const bm = new BattleManager([hero, enemy], sequenceRoller([6, 6, 5, 5]));

        const result = bm.run(30);
        expect(["victory", "defeat"]).toContain(result);
        expect(bm.combatState.log.length).toBeGreaterThan(0);
    });

    test("le log contient des entrées de tour", () => {
        const hero = makeWarrior("h1", 0, 0);
        const enemy = makeFrelon(0, 1);
        const bm = new BattleManager([hero, enemy], sequenceRoller([4, 4, 4, 4]));

        bm.run(10);
        expect(bm.combatState.log.some((l) => l.includes("Tour"))).toBe(true);
    });

    test("la régénération d'AP augmente de 1 au début du tour (plafonnée)", () => {
        const hero = makeWarrior("h1", 0, 0);
        const enemy = makeFrelon(3, 3);
        const bm = new BattleManager([hero, enemy], sequenceRoller([4]));
        const phases = new PhaseSystem(bm.combatState);

        // Le Guerrier démarre à 10 AP (max 10).
        expect(hero.currentAp).toBe(10);

        // On baisse les AP, puis on déclenche le début de tour : +1.
        hero.currentAp = 7;
        phases.startUnitTurn(hero);
        expect(hero.currentAp).toBe(8);

        // Plafonnée au maximum : à 10, reste 10.
        hero.currentAp = 10;
        phases.startUnitTurn(hero);
        expect(hero.currentAp).toBe(10);
    });

    test("attemptFlee réussit si aucun héros ne fait 1", () => {
        const hero = makeWarrior("h1", 0, 0);
        const enemy = makeFrelon(0, 1);
        // Rolls de fuite = 4 (pas de 1) => succès.
        const bm = new BattleManager([hero, enemy], sequenceRoller([4]));

        const success = bm.attemptFlee();
        expect(success).toBe(true);
        expect(bm.result).toBe("fled");
        expect(bm.combatState.isOver).toBe(true);
    });

    test("attemptFlee échoue si un héros fait 1", () => {
        const hero = makeWarrior("h1", 0, 0);
        const enemy = makeFrelon(0, 1);
        // Roll de fuite = 1 => échec.
        const bm = new BattleManager([hero, enemy], sequenceRoller([1]));

        const success = bm.attemptFlee();
        expect(success).toBe(false);
        expect(bm.result).toBe("ongoing");
        expect(bm.combatState.isOver).toBe(false);
    });

    test("attemptFlee avec plusieurs héros : un seul 1 suffit à échouer", () => {
        const hero1 = makeWarrior("h1", 0, 0);
        const hero2 = makeWhiteMage("h2", 0, 1);
        const enemy = makeFrelon(0, 2);
        // hero1 roll 4 (ok), hero2 roll 1 (échec).
        const bm = new BattleManager([hero1, hero2, enemy], sequenceRoller([4, 1]));

        const success = bm.attemptFlee();
        expect(success).toBe(false);
        expect(bm.result).toBe("ongoing");
    });
});
