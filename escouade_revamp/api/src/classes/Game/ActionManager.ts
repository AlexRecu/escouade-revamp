import { Item } from "../Items/Item";
import { Tools } from "../Items/Tools";
import { Character } from "../UnitTypes/Character";
import { Eon } from "../UnitTypes/Eon";
import { Unit } from "../UnitTypes/Unit";


export class ActionManager {
    private hasMoved: Set<Unit> = new Set();
    private hasActed: Set<Unit> = new Set();

    /**
     * Permet à une unité de se déplacer si elle n'a pas encore bougé ce tour.
     */
    moveUnit(unit: Unit, newPosition: { row: number; col: number }): string {
        if (this.hasMoved.has(unit)) {
            return `${unit.name} a déjà bougé ce tour.`;
        }

        unit.position = newPosition;
        this.hasMoved.add(unit);

        return `${unit.name} se déplace en (${newPosition.row}, ${newPosition.col}).`;
    }

    /**
     * Permet à une unité d'effectuer une action si elle n'a pas déjà agi ce tour.
     */
    performAction(unit: Unit, action: "attack" | "spell" | "skill" | "item" | "combo" | "tool", targets: Unit[], extra?: any): string[] {
        let resultArray: string[] = []
        if (this.hasActed.has(unit)) {
            resultArray.push(`${unit.name} a déjà effectué une action ce tour.`);
            return resultArray;
        }

        if (unit.canAct) {
            switch (action) {
                case "attack":
                    resultArray.push(...unit.attack(targets[0], extra.roll, extra.critRoll, extra.bonus));
                    break;

                // Samouraï
                // case "combo":
                //     resultArray.push(...unit.useCombo(extra.combo as Combo, targets[0], extra.roll, extra.critRoll, extra.bonus).join("\n"));
                //     break;

                case "spell":
                    resultArray.push(...unit.useSpellFromName(extra.spell.name, targets[0], extra.roll, extra.critRoll));
                    break;

                case "skill":
                    if(unit instanceof Eon) resultArray.push(...unit.useEonAbility(extra.skill.name as string, targets));
                    if(unit instanceof Character)resultArray.push(...unit.useCharacterAbility(extra.skill.name as string, targets));
                    break;

                // Ninja
                case "tool":
                     resultArray.push(...unit.useItem(extra.tool as Tools, targets[0]).join("\n"));
                     break;

                case "item":
                    resultArray.push(...unit.useItem(extra.item as Item, targets[0]));
                    break;

                default:
                    resultArray.push("Action invalide.");
                    return resultArray;
            }
        }

        this.hasActed.add(unit);

        // Vérifie si l'unité a une action supplémentaire
        if (unit.extraActions > 0) {
            unit.extraActions--;
            this.hasActed.delete(unit); // Permet une nouvelle action
        }

        return resultArray;
    }

    /**
     * Réinitialise l'état des unités pour un nouveau tour.
     */
    resetTurn(): void {
        this.hasMoved.clear();
        this.hasActed.clear();
    }
}
