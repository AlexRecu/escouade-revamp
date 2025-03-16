import { getAdjacentPositions, isAdjacentToGoal, isOccupied } from "../utils/PositionUtils";
import { Dice } from "./Dice";
import { Position, Status } from "./Types";

export abstract class Unit {
    id: string;
    name: string;
    dice: Dice = new Dice();
    type: "Hero" | "Enemy";
    position: Position;
    currentHp: number;
    maxHp: number;
    weakness: string[] = [];
    immunity: string[] = [];
    resistance: string[] = [];
    status: Status[];

    constructor(id: string, name: string, type: "Hero" | "Enemy", position: Position, currentHp: number, maxHp: number, status: Status[]) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.position = position;
        this.currentHp = currentHp;
        this.maxHp = maxHp;
        this.status = status;
    }

    /**
     * Renvoie l'unité du type voulu la plus proche
     * 
     * @param type type de l'unité Hero ou Enemy
     * @param units Contexte de toutes les unités sur le plateau
     * @returns {Unit} l'unité du type demandé
     */
    getClosestUnit(type: "Hero" | "Enemy", units: Unit[]): Unit | null {
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
     * 
     * @param type type de l'unité Hero ou Enemy
     * @param units Contexte de toutes les unités sur le plateau
     * @returns {Unit} l'unité du type demandé
     */
    getFarthestUnit(type: "Hero" | "Enemy", units: Unit[]): Unit | null {
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
     * 
     * @param {Position} target La position de l'unité ciblée
     * @param units Contexte de toutes les unités
     * @returns {Position} La position adjacente la plus proche
     */
    findClosestAdjacent(target: Position, units: Unit[]): Position | null {
        const adjacentPositions = getAdjacentPositions(target)
            .filter(pos => !isOccupied(pos, units));

        if (adjacentPositions.length === 0) return null;

        return adjacentPositions.reduce((closest, pos) => {
            const distCurrent = Math.abs(pos.row - this.position.row) + Math.abs(pos.col - this.position.col);
            const distClosest = Math.abs(closest.row - this.position.row) + Math.abs(closest.col - this.position.col);
            return distCurrent < distClosest ? pos : closest;
        });
    }

    /**
     * Déplace l'unité de @movementRange cases dans la direction de la position @target en prenant le chemin le plus court
     * 
     * @param target la position cible
     * @param movementRange nombre de cases de déplacement
     * @param units contexte de toutes les unités sur le plateau
     */
    moveTowards(target: Position, movementRange: number, units: Unit[]) {
        if (isAdjacentToGoal(this.position, target)) return; // Already adjacent

        const closestPosition = this.findClosestAdjacent(target, units);
        if (!closestPosition) return;

        let path = [];
        let currentPos = { ...this.position };

        while (path.length < movementRange && !isAdjacentToGoal(currentPos, closestPosition)) {
            let dx = Math.sign(closestPosition.col - currentPos.col);
            let dy = Math.sign(closestPosition.row - currentPos.row);

            let nextPosition = { row: currentPos.row + dy, col: currentPos.col + dx };

            if (!isOccupied(nextPosition, units)) {
                path.push(nextPosition);
                currentPos = nextPosition;
            } else {
                break;
            }
        }

        if (path.length > 0) {
            this.position = path[path.length - 1];
        }
    }

    /**
     * Fuis l'unité de @movementRange cases dans la direction opposée de la position @target
     * 
     * @param target la position à fuir
     * @param movementRange nombre de cases de déplacement
     * @param units contexte de toutes les unités sur le plateau
     */
    moveAwayFrom(target: Position, movementRange: number, units: Unit[]) {
        let currentPos = { ...this.position };
        let path = [];

        for (let i = 0; i < movementRange; i++) {
            let dx = Math.sign(currentPos.col - target.col);
            let dy = Math.sign(currentPos.row - target.row);

            let nextPosition = { row: currentPos.row + dy, col: currentPos.col + dx };

            if (!isOccupied(nextPosition, units)) {
                path.push(nextPosition);
                currentPos = nextPosition;
            } else {
                break;
            }
        }

        if (path.length > 0) {
            this.position = path[path.length - 1];
        }
    }

    /**
     * 
     * @returns True si l'unité n'a plus de PV
     */
    isDead(): boolean {
        return this.currentHp === 0;
    }

    abstract attack(target: Unit, roll: number, critRoll: number | 0): string[];

    protected calculateDamageMultiplier(element: string, target: Unit): number {
        let damageMultiplier = 1;
        if (target.immunity.includes(element)) {
            damageMultiplier = 0;
        } else if (target.resistance.includes(element)) {
            damageMultiplier = 0.5;
        } else if (target.weakness.includes(element)) {
            damageMultiplier = 2;
        }
        return damageMultiplier;
    }

    protected messageDamageMultiplier(damageMultiplier: number): string {
        let message = "";
        switch (damageMultiplier) {
            case 0: {
                message = "C'est sans effet !"; 
                break;
            }
            case 0.5 : {
                message = "Ce n'est pas très efficace !"; 
                break;
            }
            case 2 : {
                message = "C'est super efficace !"; 
                break;
            }
        }
        return message;
    }

    manageStatus(status: Status, target: Unit, roll: number, resultArray: string[]): void {
        const index = target.status.findIndex(s => s.name === "Barrière");
        // Si la cible n'est pas sous Barrière, elle peut être affectée par un statut
        if (index !== -1) {
            switch (status.name) {
                case 'Mort': {
                    //formule de mort à appliquer (20%), si true, tue l'ennemi on break
                    if (Math.random() <= 0.2) {
                        target.currentHp = 0;
                        resultArray.push(`${target.name} meurt instantanement`);
                    } else {
                        resultArray.push(`${target.name} réchappe à la mort`);
                    }
                    break;
                } case 'Supplice': {
                    // Mort si roll = 6
                    if (roll === 6) {
                        target.currentHp = 0;
                        resultArray.push(`${target.name} meurt instantanement`);
                    } else {
                        //applique le poison
                        target.status.push({ name: 'Poison', nbTurnEffect: null });
                        resultArray.push(`${target.name} est empoisonné`);
                    }
                    break;
                } case 'Esuna': {
                    target.status = target.status.filter(statut => statut.unitType === "ally");
                    resultArray.push(`${target.name} n'est plus affecté par aucun malus`);
                    break;
                } case 'Saignée': {
                    const drain = target.currentHp * 0.2;
                    target.currentHp -= drain;
                    const healthRegened = Math.round(drain/2);
                    this.currentHp = Math.max(this.currentHp+healthRegened, this.maxHp);
                    resultArray.push(`${target.name} est drainé de ${drain}PV`);
                    break;
                } case 'Renvoi': {
                    //appliquer l'utilisation de la corde sortie
                    resultArray.push('Cela met fin au combat');
                    break;
                } case 'Dissipation': {
                    const lastBoonIndex = target.status.length - 1 - target.status.slice().reverse().findIndex(statut => statut.unitType === "ally");
                    if (lastBoonIndex !== -1) {
                        const boon = target.status[lastBoonIndex];
                        target.status.splice(lastBoonIndex, 1); // Supprime le dernier statut bénéfique
                        resultArray.push(`Enlève le ${boon} statut de ${target.name}`);
                    }
                    break;
                } default: {
                    // Si le statut affecte déjà la cible, on réinitialise son compteur sinon on ajoute le statut
                    const index = target.status.findIndex(s => s.name === status.name);
                    if (index !== -1) {
                        target.status[index].nbTurnEffect = status.nbTurnEffect;
                    } else {
                        target.status.push({ name: status.name, unitType: status.unitType, counterItem: status.counterItem, nbTurnEffect: status.nbTurnEffect });
                    }
                }
            }
        } else {
            resultArray.push(`Une barrière protège ${target.name} des statuts`);
        }
    }
};
