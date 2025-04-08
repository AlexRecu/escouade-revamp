import { findAvailablePositions, findPathDijkstra, getAdjacentPositions, isAdjacentToGoal, isOccupied, whoOccupies } from "../../utils/PositionUtils";
import { Item } from "../Items/Item";
import { EonSkill, Position, Skill } from "../Types";
import { Status } from "../Status";
import { getValidTargets } from "../../utils/DamageUtils";
import { applyStatus } from "../../utils/StatusUtils";

export abstract class Unit {
    id: string;
    name: string;
    type: 'Hero' | 'Enemy';
    position: Position;
    currentHp: number;
    maxHp: number;
    weakness: string[] = [];
    immunity: string[] = [];
    resistance: string[] = [];
    status: Status[];
    bag: Item[];
    canAct: boolean = true;
    accuracyModifier: number = 1;
    extraActions: number = 0;
    stats: any;
    isTargeted: boolean = false;

    constructor(id: string, name: string, type: 'Hero' | 'Enemy', position: Position, currentHp: number, maxHp: number, status: Status[], items: Item[]) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.position = position;
        this.currentHp = currentHp;
        this.maxHp = maxHp;
        this.bag = items;
        this.status = status;
    }

    /**
     * Renvoie l'unité du type voulu la plus proche
     * @param type type de l'unité Hero ou Enemy
     * @param units Contexte de toutes les unités sur le plateau
     * @returns {Unit} l'unité du type demandé
     */
    getClosestUnit(type: 'Hero' | 'Enemy', units: Unit[]): Unit | null {
        let closestUnit: Unit | null = null;
        let minDistance = Infinity;

        for (const unit of units) {
            if (unit.type === type && unit !== this) {
                const distance = Math.abs(unit.position.row - this.position.row) + Math.abs(unit.position.col - this.position.col);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestUnit = unit;
                }
            }
        }
        return closestUnit;
    }

    /**
     * Renvoie l'unité du type voulu la plus éloignée
     * @param type type de l'unité Hero ou Enemy
     * @param units Contexte de toutes les unités sur le plateau
     * @returns {Unit} l'unité du type demandé
     */
    getFarthestUnit(type: 'Hero' | 'Enemy', units: Unit[]): Unit | null {
        let farthestUnit: Unit | null = null;
        let maxDistance = -1;

        for (const unit of units) {
            if (unit.type === type && unit !== this) {
                const distance = Math.max(
                    Math.abs(unit.position.row - this.position.row),
                    Math.abs(unit.position.col - this.position.col)
                );
                if (distance > maxDistance) {
                    maxDistance = distance;
                    farthestUnit = unit;
                }
            }
        }
        return farthestUnit;
    }

    /**
     * Retourne la position adjacente la plus proche de la cible
     * @param {Position} target La position de l'unité ciblée
     * @param units Contexte de toutes les unités
     * @returns {Position} La position adjacente la plus proche
     */
    findClosestAdjacent(target: Position, units: Unit[]): Position | null {
        let adjacentPositions = findAvailablePositions(target, units)

        if (adjacentPositions.length === 0) return null;

        // Étape 1 : Récupérer toutes les positions adjacentes les plus proches de la position actuelle
        let closestPositions = adjacentPositions.filter(pos =>
            Math.max(
                Math.abs(pos.row - this.position.row),
                Math.abs(pos.col - this.position.col)
            ) === 1
        );

        if (closestPositions.length === 0) {
            let minDistanceFromCurrent = Math.min(
                ...adjacentPositions.map(pos => Math.max(
                    Math.abs(pos.row - this.position.row),
                    Math.abs(pos.col - this.position.col)
                ))
            );
            closestPositions = adjacentPositions.filter(pos =>
                Math.max(
                    Math.abs(pos.row - this.position.row),
                    Math.abs(pos.col - this.position.col)
                ) === minDistanceFromCurrent
            );
            if (closestPositions.length === 0) {
                return null
            };
        }

        // Étape 2 : Sélectionner la position qui minimise la distance à la cible
        let bestPosition = closestPositions.reduce((best, pos) => {
            let bestDistance = Math.max(
                Math.abs(target.row - best.row),
                Math.abs(target.col - best.col)
            );
            let currentDistance = Math.max(
                Math.abs(target.row - pos.row),
                Math.abs(target.col - pos.col)
            );

            return currentDistance < bestDistance ? pos : best;
        });

        return bestPosition;
    }

    /**
     * Déplace l'unité de @movementRange cases dans la direction de la position @target en prenant le chemin le plus court
     * @param target la position cible
     * @param movementRange nombre de cases de déplacement
     * @param units contexte de toutes les unités sur le plateau
     */
    moveTowards(target: Position, movementRange: number, units: Unit[]) {
        // Stop si on est déjà sur la position d'arrivée
        if (this.position.row === target.row && this.position.col === target.col) return;

        // Si la cible est occupée, trouver une position adjacente libre
        const closestPosition = isOccupied(target, units) ? this.findClosestAdjacent(target, units) : target;
        if (!closestPosition) return;

        // Utiliser le Dijkstra pour trouver le chemin le plus court
        const path = findPathDijkstra(this.position, closestPosition, units);

        if (path.length === 0) return; // Aucun chemin trouvé

        // Se déplacer en suivant le chemin trouvé, mais dans la limite du movementRange
        const steps = Math.min(movementRange, path.length);
        this.position = path[steps - 1]; // Dernière position atteignable dans la limite du mouvement

        return path.slice(0, steps); // Retourne le chemin suivi
    }

    /**
     * Fuis l'unité de @movementRange cases dans la direction opposée de la position @target
     * @param target la position à fuir
     * @param movementRange nombre de cases de déplacement
     * @param units contexte de toutes les unités sur le plateau
     */
    moveAwayFrom(target: Position, movementRange: number, units: Unit[]) {
        const GRID_MIN = 0, GRID_MAX = 7;

        let availablePositions = findAvailablePositions(this.position, units);

        if (availablePositions.length === 0) return; // Aucune fuite possible

        // Déterminer l'extrémité du plateau la plus lointaine
        const extremities = [
            { row: GRID_MIN, col: GRID_MIN },
            { row: GRID_MIN, col: GRID_MAX },
            { row: GRID_MAX, col: GRID_MIN },
            { row: GRID_MAX, col: GRID_MAX }
        ];

        let bestExtremity = extremities.reduce((farthest, ext) => {
            const distCurrent = Math.abs(ext.row - target.row) + Math.abs(ext.col - target.col);
            const distFarthest = Math.abs(farthest.row - target.row) + Math.abs(farthest.col - target.col);
            return distCurrent > distFarthest ? ext : farthest;
        });

        return this.moveTowards(bestExtremity, movementRange, units);
    }

    isDead(): boolean {
        return this.currentHp === 0;
    }

    /**
    * Attaque simple sur une cible
    * @param target La cible visée
    * @param roll Le jet de dès de l'attaque
    * @param critRoll (facultatif, 0 par défaut) Le jet critique si roll = 6 
    * @param bonus (facultatif, 0 par défaut) bonus de dégat à ajouter dans le calcul de l'attaque
    * @returns La liste des actions à afficher côté front
    */
    abstract attack(target: Unit, roll: number, critRoll: number | 0, bonus: number | 0): string[];
    /**
     * Action magique via un sort sur la cible
     * @param spell Le sort utilisé
     * @param target La cible visée
     * @param roll 
     * @param critRoll 
     * @returns La liste des actions à afficher côté front
     */
    abstract useSpellFromName(spellName: string, target: Unit, roll: number, critRoll: number): string[];
    /**
     * Utilise une compétence depuis son nom
     * @param skill 
     * @param allUnits 
     * @returns Le log de toutes les actions effectuées
     */
    useAbility(skill: Skill, allUnits: Unit[]): string[] {
        let resultArray: string[] = [];

        // Déterminer les cibles valides
        let targets = getValidTargets(this, skill, allUnits);
        if (targets.length === 0) {
            resultArray.push(`Aucune cible valide à ${skill.range} case(s) pour ${skill.name}.`);
            return resultArray;
        }

        if (this.currentHp - skill.hpCost < 1) {
            resultArray.push("Pas assez de PV pour utiliser cette compétence !");
            return resultArray;
        }
        this.currentHp -= skill.hpCost;

        skill.target !== 'self' ?
            resultArray.push(`${this.name} utilise ${skill.name} sur ${targets.map(unit => unit.name)}`) :
            resultArray.push(`${this.name} utilise ${skill.name}`);

        for (const target of targets) {
            if (skill.status.length > 0) {
                for (const statut of skill.status) {
                    applyStatus(this, statut, target, skill.roll ? Math.floor(Math.random() * 6) + 1 : 6, resultArray);
                }
            }
            if (skill.roll > 0) {
                const rollResult = Math.floor(Math.random() * 6) + 1;
                if (rollResult < skill.roll) {
                    resultArray.push(`${this.name} échoue à utiliser ${skill.name}.`);
                    return resultArray;
                }
            }

            if (skill.formula && skill.formula !== "") {
                try {
                    this.executeFormula(skill, target, allUnits, resultArray);
                } catch (error) {
                    resultArray.push("Erreur dans l'exécution de la compétence");
                    return resultArray;
                }
            }
        }

        return resultArray;
    };

    /**
         * Evalue la formule de calcul d'une compétence
         * @param formula 
         * @param target 
         */
    protected executeFormula(skill: Skill | EonSkill, target: Unit, allUnits: Unit[], resultArray: string[]): void {
        const context = {
            user: this,
            target: target,
            allUnits: allUnits
        };

        const safeFormula = skill.formula.replace(/this\./g, "context.user.").replace(/target\./g, "context.target.").replace(/allUnits\./g, "context.allUnits.");

        try {
            eval(safeFormula);
        } catch (error) {
            resultArray.push("Erreur lors de l'exécution de la formule: " + error);
            console.error("Erreur lors de l'exécution de la formule: ", error);
        }
    }

    /**
     * Utilise un objet de type Consumable ou Tools sur une cible
     * @param item 
     * @param target 
     */
    abstract useItem(item: Item, target: Unit): string[];
};