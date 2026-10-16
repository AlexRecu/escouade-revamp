import { Character } from "../src/classes/UnitTypes/Character";
import { Unit } from "../src/classes/UnitTypes/Unit";
import { Eon } from "../src/classes/UnitTypes/Eon";
import { Demon } from "../src/classes/UnitTypes/Demon";
import { Warrior } from "../src/classes/Jobs/Warrior";
import { BlackMage } from "../src/classes/Jobs/BlackMage";
import { Thief } from "../src/classes/Jobs/Thief";
import { BlueMage } from "../src/classes/Jobs/BlueMage";
import { Sword, Katana } from "../src/classes/Items/Weapon";
import { Tools } from "../src/classes/Items/Tools";

describe("Manques reportés (avant Phase 2)", () => {

    // ─────────────────────────────────────────────
    // 1. equipLeftHand (double-armement)
    // ─────────────────────────────────────────────
    describe("equipLeftHand", () => {
        const sword = new Sword("Epee1", "Epee", "", 0, 0, 2, "", null);
        const katana = new Katana("Katana1", "Katana", "", 0, 0, 2, "", null);

        test("Double Armement : arme en main droite ET main gauche", () => {
            const warrior = new Character("1", "DK", "Hero", { row: 0, col: 0 }, 30, 30, [], 10, 10, 10, 10, new Warrior(), sword, null);
            warrior.job.jobLevel = 20;
            warrior.evolveJob("Chevalier Noir");
            warrior.equipLeftHand(katana);
            expect(warrior["rightHand"]).toBe(sword);
            expect(warrior["leftHand"]).toBe(katana);
        });

        test("Main droite vide : équipe simplement la main gauche", () => {
            const warrior = new Character("2", "Guerrier", "Hero", { row: 0, col: 0 }, 30, 30, [], 10, 10, 10, 10, new Warrior(), null, null);
            // Ne doit plus lever d'erreur (cas TODO corrigé)
            expect(() => warrior.equipLeftHand(katana)).not.toThrow();
            expect(warrior["leftHand"]).toBe(katana);
            expect(warrior["rightHand"]).toBeFalsy();
        });

        test("Déséquipement main gauche (null) avec main droite vide", () => {
            const warrior = new Character("3", "Guerrier", "Hero", { row: 0, col: 0 }, 30, 30, [], 10, 10, 10, 10, new Warrior(), null, katana);
            expect(() => warrior.equipLeftHand(null)).not.toThrow();
            expect(warrior["leftHand"]).toBeNull();
        });
    });

    // ─────────────────────────────────────────────
    // 3. Démoniste : listDemon + summonDemon
    // ─────────────────────────────────────────────
    describe("Démoniste (Pactiser)", () => {
        let demonist: Character;

        beforeEach(() => {
            demonist = new Character("1", "Démoniste", "Hero", { row: 3, col: 3 }, 30, 30, [], 12, 12, 10, 10, new BlackMage(), null, null);
            demonist.job.jobLevel = 20;
            demonist.evolveJob("Démoniste");
        });

        test("listDemon renvoie la liste des démons pactisés", () => {
            (demonist.job as BlackMage).recruitDemon("Mateus, le Corrompu");
            const demons = (demonist.job as BlackMage).listDemon();
            expect(demons.length).toBeGreaterThan(0);
            expect(demons).toContain("Mateus, le Corrompu");
        });

        test("Pactiser (compétence) affiche la liste des démons", () => {
            (demonist.job as BlackMage).recruitDemon("Mateus, le Corrompu");
            const log = demonist.useAbilityByName("Pactiser", [demonist]);
            expect(log.some(l => l.includes("Démons disponibles"))).toBe(true);
        });

        test("summonDemon invoque le démon à la position du lanceur et déduit 4 MP", () => {
            (demonist.job as BlackMage).recruitDemon("Mateus, le Corrompu");
            const mpBefore = demonist.currentMp;
            const demon = (demonist.job as BlackMage).summonDemon("Mateus, le Corrompu", demonist);
            expect(demon).toBeInstanceOf(Demon);
            expect(demon.position).toEqual({ row: 3, col: 3 });
            expect(demonist.currentMp).toBe(mpBefore - 4);
            expect((demonist.job as BlackMage).demons).toContain(demon);
        });

        test("summonDemon échoue si pas assez de Mana", () => {
            (demonist.job as BlackMage).recruitDemon("Mateus, le Corrompu");
            demonist.currentMp = 3;
            expect(() => (demonist.job as BlackMage).summonDemon("Mateus, le Corrompu", demonist)).toThrow(/pas assez de Mana/);
        });

        test("summonDemon échoue pour un démon inconnu", () => {
            expect(() => (demonist.job as BlackMage).summonDemon("Zorglub", demonist)).toThrow(/démon inconnu/);
        });

        test("summonDemon échoue si le démon n'est pas pactisé", () => {
            expect(() => (demonist.job as BlackMage).summonDemon("Mateus, le Corrompu", demonist)).toThrow(/pas pactisé/);
        });
    });

    // ─────────────────────────────────────────────
    // 4. Outils ninja : craftNinjaTool stocke dans le bag
    // ─────────────────────────────────────────────
    describe("Outils ninja", () => {
        let ninja: Character;

        beforeEach(() => {
            ninja = new Character("1", "Ninja", "Hero", { row: 0, col: 0 }, 30, 30, [], 10, 10, 10, 10, new Thief(), null, null);
            ninja.job.jobLevel = 20;
            ninja.evolveJob("Ninja");
        });

        test("craftNinjaTool ajoute l'outil au bag et incrémente nbTools", () => {
            const bagBefore = ninja.bag.length;
            const msg = ninja.craftNinjaTool("Doton");
            expect(msg).toContain("Nouvel outil ninja créé");
            expect(ninja.bag.length).toBe(bagBefore + 1);
            expect(ninja.bag[ninja.bag.length - 1]).toBeInstanceOf(Tools);
            expect((ninja.job as Thief).nbTools).toBe(1);
        });

        test("craftNinjaTool refuse quand la capacité est atteinte", () => {
            (ninja.job as Thief).nbTools = 5; // capacité max
            const msg = ninja.craftNinjaTool("Katon");
            expect(msg).toContain("capacité atteinte");
            expect((ninja.job as Thief).nbTools).toBe(5);
        });

        test("increaseToolsCap augmente la capacité au niveau 26", () => {
            const capBefore = (ninja.job as Thief).nbToolsCap ?? 5;
            (ninja.job as Thief).increaseToolsCap();
            expect((ninja.job as Thief).nbToolsCap).toBe(capBefore + 1);
        });

        test("Un non-Ninja ne peut pas créer d'outil", () => {
            const warrior = new Character("2", "Guerrier", "Hero", { row: 0, col: 0 }, 30, 30, [], 10, 10, 10, 10, new Warrior(), null, null);
            const msg = warrior.craftNinjaTool("Doton");
            expect(msg).toContain("seul un Ninja");
        });
    });

    // ─────────────────────────────────────────────
    // 5. Bunshin : statut qui absorbe 1 attaque
    // ─────────────────────────────────────────────
    describe("Bunshin", () => {
        test("consumeBunshin retire le statut et signale l'absorption", () => {
            const unit = new Character("1", "Ninja", "Hero", { row: 0, col: 0 }, 30, 30, [], 10, 10, 10, 10, new Thief(), null, null);
            unit.status.push({ name: "Bunshin", statusType: "boon", nbTurnEffect: null });
            const log: string[] = [];
            expect(unit.consumeBunshin(log)).toBe(true);
            expect(unit.status.some(s => s.name === "Bunshin")).toBe(false);
            expect(log[0]).toContain("encaisse l'attaque");
        });

        test("consumeBunshin renvoie false sans statut Bunshin", () => {
            const unit = new Character("2", "Ninja", "Hero", { row: 0, col: 0 }, 30, 30, [], 10, 10, 10, 10, new Thief(), null, null);
            const log: string[] = [];
            expect(unit.consumeBunshin(log)).toBe(false);
        });

        test("Une attaque sur une cible sous Bunshin est absorbée (0 dégât)", () => {
            const attacker = new Character("1", "Guerrier", "Hero", { row: 0, col: 0 }, 30, 30, [], 10, 10, 10, 10, new Warrior(), new Sword("Epee1", "Epee", "", 0, 0, 2, "", null), null);
            const target = new Character("2", "Ninja", "Enemy", { row: 1, col: 0 }, 30, 30, [], 10, 10, 10, 10, new Thief(), null, null);
            target.status.push({ name: "Bunshin", statusType: "boon", nbTurnEffect: null });
            const hpBefore = target.currentHp;
            attacker.attack(target, 6, 0, 0);
            expect(target.currentHp).toBe(hpBefore);
            expect(target.status.some(s => s.name === "Bunshin")).toBe(false);
        });
    });

    // ─────────────────────────────────────────────
    // 6. Prestesse pérenne (Eon) : annule les dégâts du tour précédent
    // ─────────────────────────────────────────────
    describe("Prestesse pérenne (Odin)", () => {
        let casterChar: Character;
        let odin: Eon;

        beforeEach(() => {
            casterChar = new Character("1", "Mage bleu", "Hero", { row: 5, col: 5 }, new BlueMage(), null, null, []);
            odin = new Eon(casterChar, "Odin");
        });

        test("Restaure les PV au niveau du snapshot (annule les dégâts subis)", () => {
            odin.currentHp = 900;
            odin.hpAtTurnStart = 1000; // snapshot en fin de tour précédent
            const log = odin.useAbilityByName("Prestesse pérenne", [odin]);
            expect(odin.currentHp).toBe(1000);
            expect(log.some(l => l.includes("annule 100 dégâts"))).toBe(true);
        });

        test("Aucun dégât à annuler si PV au maximum", () => {
            odin.currentHp = 1000;
            odin.hpAtTurnStart = 1000;
            const log = odin.useAbilityByName("Prestesse pérenne", [odin]);
            expect(odin.currentHp).toBe(1000);
            expect(log.some(l => l.includes("aucun dégât à annuler"))).toBe(true);
        });
    });
});
