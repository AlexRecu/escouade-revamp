import { CombatState } from "./CombatState";
import { Unit } from "../UnitTypes/Unit";
import { Eon } from "../UnitTypes/Eon";
import { Monster } from "../UnitTypes/Monster";
import { manageStatusBeforePhase, manageStatusAfterPhase } from "../../utils/StatusUtils";

/**
 * Gère les phases d'un tour de combat :
 *  - début de tour : application des statuts d'ouverture (Sommeil, Fossile, Mutisme, ...)
 *  - phase d'action : l'unité agit (déplacement + 1 action)
 *  - fin de tour : application des statuts de fin (Poison, Grâce, ...) et décrément des durées
 *
 * Gère également la règle de la double action : une unité (héros ou monstre)
 * dont la vitesse est strictement supérieure à 2 fois la somme des vitesses du
 * groupe adverse agit deux fois par tour (2e entrée en fin de file).
 */
export class PhaseSystem {
    /** Ids des unités dont le tour a déjà démarré ce tour (anti double
     *  `turnCount`/`tickCooldowns` pour les monstres qui agissent 2×). */
    private startedThisTurn = new Set<string>();
    /** Ids des unités dont la fin de tour a déjà été traitée ce tour (anti
     *  double poison/Grâce pour les monstres qui agissent 2×). */
    private endedThisTurn = new Set<string>();
    /** Numéro de tour pour lequel les Sets ci-dessus sont à jour. */
    private trackedTurn = 0;

    constructor(private state: CombatState) {}

    /** Réinitialise les Sets de suivi quand le tour change. */
    private resetForTurnIfNeeded(): void {
        if (this.state.turn !== this.trackedTurn) {
            this.trackedTurn = this.state.turn;
            this.startedThisTurn.clear();
            this.endedThisTurn.clear();
        }
    }

    /**
     * Début de tour d'une unité : applique les statuts d'ouverture,
     * réinitialise sa capacité d'action et régénère ses AP.
     *
     * Une unité qui agit deux fois (rapide) apparaît deux fois dans la file :
     * tout le corps du début de tour (statuts d'ouverture, régénération d'AP,
     * compteur de tour / cooldowns du monstre) ne doit se faire qu'**une fois**
     * par tour (garde-fou `startedThisTurn`). La 2e entrée est un no-op.
     * @returns le log généré.
     */
    startUnitTurn(unit: Unit): string[] {
        this.resetForTurnIfNeeded();
        if (this.startedThisTurn.has(unit.id)) return [];
        this.startedThisTurn.add(unit.id);

        const log = manageStatusBeforePhase(unit);
        this.state.pushLogMany(log);
        // Le blocage de dégâts d'un Eon (Blocage de Titan, barrières) ne dure
        // qu'un tour : il est levé au début du prochain tour de l'Eon.
        if (unit instanceof Eon && unit.damageBlocked) {
            unit.damageBlocked = false;
            log.push(`${unit.name} : le blocage de dégâts se dissipe.`);
        }
        // Monstre : on compte son tour (comportement "reculer tous les 2-3
        // tours") et on fait avancer ses cooldowns de capacités.
        if (unit instanceof Monster) {
            unit.turnCount += 1;
            unit.tickCooldowns();
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
     *
     * Un monstre qui agit deux fois apparaît deux fois dans la file : les
     * statuts de fin de phase (Poison, Grâce…) ne doivent se déclencher
     * qu'**une fois** par tour (garde-fou `endedThisTurn`).
     * @returns le log généré.
     */
    endUnitTurn(unit: Unit): string[] {
        this.resetForTurnIfNeeded();
        // Un monstre qui agit deux fois apparaît deux fois dans la file : les
        // statuts de fin de phase (Poison, Grâce…) ne se déclenchent qu'**une
        // fois** par tour. La 2e entrée est un no-op.
        if (this.endedThisTurn.has(unit.id)) return [];
        this.endedThisTurn.add(unit.id);

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
     * Indique si une unité peut agir (pas endormie, pas fossilisée, ...).
     */
    canAct(unit: Unit): boolean {
        return unit.canAct && !unit.isDead();
    }
}
