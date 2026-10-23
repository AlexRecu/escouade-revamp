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
    /**
     * true quand l'unité est **remplacée sur le plateau** par une invocation
     * (ex. un Démoniste invoqué : son démon occupe sa place). L'unité reste
     * vivante (compte pour la défaite) mais ne peut ni agir ni être ciblée.
     */
    isReplaced: boolean = false;
    /**
     * true quand l'unité bloque les dégâts qu'elle reçoit (ex. Eon "Blocage de Titan",
     * "Onde incendiaire", "Virevolte captivante"). Les dégâts sont annulés jusqu'au
     * prochain tour de l'unité (reset dans `PhaseSystem.startUnitTurn`).
     */
    damageBlocked: boolean = false;

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
            // Les unités remplacées (hors champ, ex. Démoniste invoqué) ne sont
            // pas ciblables : c'est leur invocation qui est sur le plateau.
            if (unit.type === type && unit !== this && !unit.isReplaced) {
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
     * Renvoie l'unité **adverse** (camp opposé) la plus proche.
     *
     * Contrairement à `getClosestUnit('Enemy')` — qui cherche un autre
     * *ennemi* et retourne `null` quand l'appelant est le seul ennemi — cette
     * méthode cherche l'unité du camp **opposé** à l'appelant : un monstre
     * (Enemy) vise les héros, un héros (Hero) vise les monstres. C'est la
     * sémantique attendue par les formules de charge des monstres (« Ruée
     * mortelle », « Rapace », « Saut »…).
     * @returns l'unité adverse la plus proche, ou null si aucune.
     */
    getClosestOpponent(units: Unit[]): Unit | null {
        let closest: Unit | null = null;
        let minDistance = Infinity;
        for (const unit of units) {
            if (unit.type !== this.type && unit !== this && !unit.isReplaced && !unit.isDead()) {
                const distance = Math.abs(unit.position.row - this.position.row) + Math.abs(unit.position.col - this.position.col);
                if (distance < minDistance) {
                    minDistance = distance;
                    closest = unit;
                }
            }
        }
        return closest;
    }

    /**
     * Renvoie l'unité **adverse** (camp opposé) la plus éloignée.
     * Sémantique opposée de `getClosestOpponent` (utilisée par « Saut »).
     * @returns l'unité adverse la plus éloignée, ou null si aucune.
     */
    getFarthestOpponent(units: Unit[]): Unit | null {
        let farthest: Unit | null = null;
        let maxDistance = -1;
        for (const unit of units) {
            if (unit.type !== this.type && unit !== this && !unit.isReplaced && !unit.isDead()) {
                const distance = Math.max(
                    Math.abs(unit.position.row - this.position.row),
                    Math.abs(unit.position.col - this.position.col)
                );
                if (distance > maxDistance) {
                    maxDistance = distance;
                    farthest = unit;
                }
            }
        }
        return farthest;
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

    /**
     * Nombre de cases que l'unité peut se déplacer en combat.
     * Règle de base : 1 case/tour. Les classes peuvent surcharger
     * (ex. le Moine "Maître" avec Pied véloce : déplacement × Dextérité).
     */
    getMovementRange(): number {
        return 1;
    }

    /**
     * Portée d'attaque de l'unité en combat (distance de Chebyshev max pour
     * toucher une cible). Règle de base : 1 case (corps-à-corps). Les classes
     * surchargent selon l'arme équipée (ex. lance = 2, arc = 3).
     */
    getAttackRange(): number {
        return 1;
    }

    isDead(): boolean {
        return this.currentHp === 0;
    }

    /**
     * Consomme le statut "Bunshin" si présent : le clone encaisse l'attaque à la place
     * de l'unité (cf. outil ninja Bunshin). Le statut est retiré après usage.
     * @returns true si le clone a absorbé l'attaque (l'unité n'encaisse aucun dégât)
     */
    consumeBunshin(resultArray: string[]): boolean {
        const index = this.status.findIndex(s => s.name === "Bunshin");
        if (index !== -1) {
            this.status.splice(index, 1);
            resultArray.push(`Le clone de ${this.name} encaisse l'attaque à sa place et se dissipe !`);
            return true;
        }
        return false;
    }

    /**
     * Applique des dégâts à l'unité en respectant le blocage éventuel
     * (`damageBlocked`, ex. "Blocage de Titan"). Centralise la soustraction de PV
     * pour que le blocage soit appliqué de façon cohérente quel que soit l'attaquant.
     * @param damage Les dégâts bruts à infliger
     * @param resultArray Le log à enrichir
     * @returns Les dégâts réellement infligés (0 si bloqués)
     */
    applyDamage(damage: number, resultArray: string[]): number {
        if (damage > 0 && this.damageBlocked) {
            resultArray.push(`${this.name} bloque les dégâts !`);
            return 0;
        }
        this.currentHp = Math.max(this.currentHp - damage, 0);
        return damage;
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
     * Point d'entrée unique et polymorphe pour utiliser une compétence depuis son nom.
     * Chaque sous-classe résout le nom dans SON registre (job.skills pour un Character,
     * le registre partagé pour un Monster, eon.skills pour un Eon) puis délègue à useAbility.
     * @param name Le nom de la compétence
     * @param allUnits Le contexte de toutes les unités
     * @returns Le log de toutes les actions effectuées
     */
    abstract useAbilityByName(name: string, allUnits: Unit[]): string[];
    /**
     * Utilise une compétence (objet Skill) — moteur d'exécution commun.
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

        // Seul un Character possède currentAp/currentMp (test structurel pour éviter l'import circulaire Unit<->Character)
        if ("currentAp" in this && "currentMp" in this) {// Gestion du coût
            const character = this as { currentAp: number; currentMp: number };
            if (character.currentAp < skill.apCost) {
                resultArray.push("Pas assez d'AP");
                return resultArray;
            }
            if (character.currentMp < skill.mpCost) {
                resultArray.push("Pas assez de MP");
                return resultArray;
            }
            character.currentAp -= skill.apCost;
            character.currentMp -= skill.mpCost;
        }

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

        // Les formules appellent directement ces helpers (ex. `isAdjacentToGoal`
        // dans « Rapace », « Ruée mortelle », « Glissade gelée »). Après
        // compilation CommonJS, les imports ne sont pas visibles dans l'`eval`,
        // on les expose donc comme variables locales du scope.
        const isAdjacentToGoal = (a: Position, b: Position): boolean =>
            Math.abs(a.row - b.row) <= 1 && Math.abs(a.col - b.col) <= 1;

        const safeFormula = skill.formula.replace(/this\./g, "context.user.").replace(/target\./g, "context.target.").replace(/allUnits\./g, "context.allUnits.");

        try {
            eval(safeFormula);
        } catch (error) {
            resultArray.push("Erreur lors de l'exécution de la formule: " + error);
            console.error("Erreur lors de l'exécution de la formule: ", error);
        }
    }

    /**
     * Exécute un **combo** (enchaînement de compétences). Par défaut, une unité
     * ne peut pas enchaîner de compétences (seul le Samouraï, via le passif
     * Bushido, le peut — surchargé dans `Character`).
     * @param combo Noms des compétences à enchaîner.
     * @param allUnits Le contexte de toutes les unités.
     * @returns Le log de l'action.
     */
    useCombo(combo: string[], allUnits: Unit[]): string[] {
        return [`${this.name} ne peut pas enchaîner de compétences.`];
    }

    /**
     * Utilise un objet de type Consumable ou Tools sur une cible
     * @param item 
     * @param target 
     */
    abstract useItem(item: Item, target: Unit): string[];
};