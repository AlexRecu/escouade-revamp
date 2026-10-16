import { CombatState } from "./CombatState";
import { Unit } from "../UnitTypes/Unit";
import { Character } from "../UnitTypes/Character";
import { Eon } from "../UnitTypes/Eon";
import { manageStatusBeforePhase, manageStatusAfterPhase } from "../../utils/StatusUtils";

/**
 * Gère les phases d'un tour de combat :
 *  - début de tour : application des statuts d'ouverture (Sommeil, Fossile, Mutisme, ...)
 *  - phase d'action : l'unité agit (déplacement + 1 action)
 *  - fin de tour : application des statuts de fin (Poison, Grâce, ...) et décrément des durées
 *
 * Gère également la règle de la double attaque : si la vitesse d'un ennemi est
 * inférieure à 2 fois la Dextérité totale de l'équipe, cet ennemi agit deux fois
 * par tour.
 */
export class PhaseSystem {
    constructor(private state: CombatState) {}

    /**
     * Début de tour d'une unité : applique les statuts d'ouverture,
     * réinitialise sa capacité d'action et régénère ses AP.
     * @returns le log généré.
     */
    startUnitTurn(unit: Unit): string[] {
        const log = manageStatusBeforePhase(unit);
        this.state.pushLogMany(log);
        // Le blocage de dégâts d'un Eon (Blocage de Titan, barrières) ne dure
        // qu'un tour : il est levé au début du prochain tour de l'Eon.
        if (unit instanceof Eon && unit.damageBlocked) {
            unit.damageBlocked = false;
            log.push(`${unit.name} : le blocage de dégâts se dissipe.`);
        }
        this.regenerateAp(unit);
        return log;
    }

    /**
     * Régénère les AP d'un héros au début de son tour.
     * Règle du livret : +1 AP par tour, plafonné au maximum.
     */
    regenerateAp(unit: Unit): void {
        if (unit.type !== "Hero") return;
        if ("currentAp" in unit && "maxAp" in unit) {
            const hero = unit as { currentAp: number; maxAp: number };
            hero.currentAp = Math.min(hero.maxAp, hero.currentAp + 1);
        }
    }

    /**
     * Fin de tour d'une unité : applique les statuts de fin de phase
     * (Poison, Grâce, ...) et décrémente les durées.
     * @returns le log généré.
     */
    endUnitTurn(unit: Unit): string[] {
        const log = manageStatusAfterPhase(unit);
        this.state.pushLogMany(log);
        // Un statut de fin de phase (ex. Poison) peut tuer l'unité.
        if (unit.isDead()) {
            this.state.pushLog(`☠️ ${unit.name} succombe à ses blessures.`);
            this.state.checkEnd();
        }
        // Snapshot des PV de l'Eon en fin de tour : c'est la référence pour
        // "Prestesse pérenne" (annule les dégâts subis depuis, c'est-à-dire
        // ceux infligés par les ennemis avant le prochain tour de l'Eon).
        if (unit instanceof Eon) {
            unit.hpAtTurnStart = unit.currentHp;
        }
        return log;
    }

    /**
     * Détermine le nombre d'actions qu'une unité peut effectuer ce tour.
     * Règle : un ennemi dont la vitesse est inférieure à 2 fois la Dextérité
     * totale de l'équipe attaque deux fois par tour.
     */
    getActionCount(unit: Unit): number {
        if (unit.type !== "Enemy") return 1;

        const teamDex = this.state.aliveHeroes.reduce(
            (sum, hero) => sum + (hero instanceof Character ? hero.stats.dexterity : 0),
            0
        );

        const speed = this.state.getSpeed(unit);
        return speed < teamDex * 2 ? 2 : 1;
    }

    /**
     * Indique si une unité peut agir (pas endormie, pas fossilisée, ...).
     */
    canAct(unit: Unit): boolean {
        return unit.canAct && !unit.isDead();
    }
}
