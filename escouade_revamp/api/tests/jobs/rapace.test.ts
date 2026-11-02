import { BlueMage } from "../../src/classes/Jobs/BlueMage";
import { Character } from "../../src/classes/UnitTypes/Character";
import { Monster } from "../../src/classes/UnitTypes/Monster";
import { Skill } from "../../src/classes/Types";
import skillData from "../../src/config/blueMage_skills_data.json";

/**
 * Régression : Rapace (charge de 3 cases + attaque) doit infliger des dégâts.
 * Le bug historique : la formule appelait `isAdjacentToGoal(this.position, target)`
 * en passant un **Unit** au lieu de `target.position` (une **Position**) →
 * `goal.row`/`goal.col` = undefined → NaN → l'attaque ne se déclenchait jamais.
 *
 * La formule est chargée **depuis le JSON** (pas recopiée) pour que ce test
 * protège aussi contre une régression dans `blueMage_skills_data.json`.
 */
describe("Rapace inflige des dégâts", () => {
    const rapace = (skillData as any[]).find((s) => s.name === "Rapace") as Skill;

    function makeMage(pos: { row: number; col: number }): Character {
        const m = new Character("BM1", "TestBlueMage", "Hero", pos, new BlueMage(), null, null);
        (m.job as BlueMage).skills.push({ level: 1, skill: rapace });
        return m;
    }

    test("ennemi à 2 cases : le mage charge et frappe", () => {
        const mage = makeMage({ row: 0, col: 0 });
        const enemy = new Monster("Frelon", { row: 0, col: 2 }, "Enemy", 2);
        const hpBefore = enemy.currentHp;
        const log = mage.useAbilityByName("Rapace", [mage, enemy], enemy);
        // Le mage doit être devenu adjacent à la cible.
        expect(Math.max(Math.abs(mage.position.row - enemy.position.row), Math.abs(mage.position.col - enemy.position.col))).toBeLessThanOrEqual(1);
        // Et la cible doit avoir perdu des PV.
        expect(enemy.currentHp).toBeLessThan(hpBefore);
        expect(log.some((l) => l.includes("perd") && l.includes("PV"))).toBe(true);
    });

    test("ennemi à 4 cases (limite de portée range+move=4) : le mage charge et frappe", () => {
        const mage = makeMage({ row: 0, col: 0 });
        const enemy = new Monster("Frelon", { row: 0, col: 4 }, "Enemy", 2);
        const hpBefore = enemy.currentHp;
        mage.useAbilityByName("Rapace", [mage, enemy], enemy);
        expect(enemy.currentHp).toBeLessThan(hpBefore);
    });

    test("ennemi adjacent : le mage frappe sans se déplacer", () => {
        const mage = makeMage({ row: 0, col: 0 });
        const enemy = new Monster("Frelon", { row: 0, col: 1 }, "Enemy", 2);
        const hpBefore = enemy.currentHp;
        mage.useAbilityByName("Rapace", [mage, enemy], enemy);
        expect(enemy.currentHp).toBeLessThan(hpBefore);
    });
});
