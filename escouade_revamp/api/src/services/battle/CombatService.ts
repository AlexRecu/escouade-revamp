import { CombatState } from "../../classes/Battle/CombatState";
import { Item } from "../../classes/Items/Item";
import { Skill } from "../../classes/Types";
import { Character } from "../../classes/UnitTypes/Character";
import { Demon } from "../../classes/UnitTypes/Demon";
import { Eon } from "../../classes/UnitTypes/Eon";
import { Monster } from "../../classes/UnitTypes/Monster";
import { Unit } from "../../classes/UnitTypes/Unit";
import { whoOccupies } from "../../utils/PositionUtils";
import { manageStatusBeforePhase, manageStatusAfterPhase } from "../../utils/StatusUtils";
import skillData from "../../config/blueMage_skills_data.json";

export class CombatService {
    /**
     * Effectue une attaque standard avec un jet de dé fourni
     */
    static performAttack(attacker: Unit, target: Unit, roll: number, critRoll: number = 0): string[] {
        return attacker.attack(target, roll, critRoll, 0);
    }

    /**
     * Utilise un sort avec les dés fournis
     */
    static performSpell(caster: Unit, target: Unit, spellName: string, roll: number, critRoll: number = 0): string[] {
        return caster.useSpellFromName(spellName, target, roll, critRoll);
    }

    /**
     * Utilise une compétence ou une capacité spéciale
     */
    static performAbility(user: Unit, skillName: string, allUnits: Unit[]): string[] {
        if (user instanceof Character) return user.useCharacterAbility(skillName, allUnits);
        if (user instanceof Monster) return user.useMonsterAbility(allUnits);
        if (user instanceof Demon) return user.act(allUnits);
        if (user instanceof Eon) return user.useEonAbility(skillName, allUnits);
        const skill: Skill = skillData.find(skill => skill.name === skillName) as Skill;
        return user.useAbility(skill, allUnits);
    }

    /**
     * Utilise un objet (consommable ou outil)
     */
    static performItemUse(user: Unit, item: Item, target: Unit): string[] {
        return user.useItem(item, target);
    }

    /**
     * Déplace une unité vers une position si la case est libre
     */
    static performMove(unit: Unit, targetPosition: { row: number, col: number }, allUnits: Unit[]): string[] {
        const occupyingUnit = whoOccupies(targetPosition, allUnits);
        if (occupyingUnit) {
            return [`La case (${targetPosition.row}, ${targetPosition.col}) est occupée.`];
        }
        unit.position = targetPosition;
        return [`${unit.name} se déplace vers la case (${targetPosition.row}, ${targetPosition.col}).`];
    }


    /**
     * Tente une fuite — réussite aléatoire basée sur un roll
     */
    static attemptFlee(unit: Unit, roll: number, state: CombatState): string[] {
        const success = roll >= 5;
        if (success) {
            unit.canAct = false;
            return [`${unit.name} parvient à fuir le combat !`];
        } else {
            unit.canAct = false;
            return [`${unit.name} tente de fuir... mais échoue.`];
        }
    }

    /**
     * Vérifie les morts et met à jour les unités
     */
    static updateKOUnits(state: CombatState): string[] {
        const logs: string[] = [];

        for (let unit of [...state.heroes, ...state.enemies]) {
            if (unit.currentHp <= 0 && !unit.isDead()) {
                unit.currentHp = 0;
                logs.push(`${unit.name} est KO !`);
            }
        }

        return logs;
    }

    /**
     * Vérifie si le combat est terminé (victoire/défaite)
     */
    static checkBattleEnd(state: CombatState): "victory" | "defeat" | null {
        const heroesAlive = state.heroes.some(h => !h.isDead());
        const enemiesAlive = state.enemies.some(e => !e.isDead());

        if (!heroesAlive) return "defeat";
        if (!enemiesAlive) return "victory";
        return null;
    }

    /**
     * Réinitialise les unités en début de phase
     */
    static refreshUnitsForPhase(units: Unit[]): string[] {
        const logs: string[] = [];
        for (let unit of units) {
            logs.push(...manageStatusBeforePhase(unit));
            unit.canAct = true;
        }
        return logs;
    }

    /**
     * Nettoyage de fin de phase (statuts, poison, KO, etc.)
     */
    static cleanUpAfterPhase(units: Unit[]): string[] {
        const logs: string[] = [];
        for (let unit of units) {
            logs.push(...manageStatusAfterPhase(unit));
        }
        return logs;
    }
}
