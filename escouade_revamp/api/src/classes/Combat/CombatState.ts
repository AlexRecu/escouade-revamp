import { Unit } from "../UnitTypes/Unit";
import { Character } from "../UnitTypes/Character";
import { Monster } from "../UnitTypes/Monster";

/**
 * Taille du plateau de combat (grille 8x8).
 */
export const GRID_SIZE = 8;

/**
 * Fonction de tirage de dés (1 à 6). Injectée pour rendre les tests déterministes.
 */
export type DiceRoller = () => number;

/**
 * Résultat global d'un combat.
 */
export type BattleResult = "victory" | "defeat" | "fled" | "ongoing";

/**
 * Métadonnées de la **dernière action** exécutée (pour l'animation côté front).
 * Le front compare ce champ entre deux états successifs pour déclencher le
 * bon effet visuel (potion, sort, compétence, attaque de zone, etc.).
 */
export interface LastAction {
    /** Id de l'unité qui agit. */
    actorId: string;
    /** Id de la cible principale (null si auto/zone). */
    targetId: string | null;
    /** Ids de **toutes** les cibles affectées (pour les attaques de zone). */
    targetIds: string[];
    /** Nature de l'action. */
    kind: "attack" | "spell" | "skill" | "item" | "combo";
    /** Nom de l'action (sort/compétence/objet) pour l'affichage. */
    name?: string;
    /** Compteur croissant pour que le front détecte un changement même si
     *  deux actions identiques se suivent. */
    seq: number;
}

/**
 * Représente l'état complet d'un combat : plateau, unités, tour courant,
 * log des événements et résultat.
 *
 * C'est la source de vérité du moteur de combat. `BattleManager` et
 * `PhaseSystem` opèrent sur cette instance.
 */
export class CombatState {
    /** Toutes les unités présentes sur le plateau (héros + ennemis). */
    units: Unit[];
    /** Numéro du tour courant (commence à 1). */
    turn: number;
    /** Index dans l'ordre d'action du tour (acteurs triés par vitesse). */
    actionIndex: number;
    /** Ordre d'action du tour courant (unités vivantes triées par vitesse décroissante). */
    actionOrder: Unit[];
    /** Log chronologique des événements du combat. */
    log: string[];
    /** Résultat du combat. */
    result: BattleResult;
    /** Métadonnées de la dernière action exécutée (animation front). */
    lastAction: LastAction | null;
    /**
     * **Dernier héros tombé** (pour l'écran de récap de game over en mode
     * difficile) : le héros qui est mort en dernier + l'ennemi qui l'a tué.
     * Mis à jour à chaque fois qu'un héros passe de vivant à mort.
     */
    lastHeroDeath: { heroId: string; heroName: string; heroJob: string; killerId: string; killerName: string } | null;
    /** Compteur de séquence des actions (croît à chaque action). */
    private actionSeq: number;

    constructor(units: Unit[]) {
        this.units = units;
        this.turn = 1;
        this.actionIndex = 0;
        this.actionOrder = [];
        this.log = [];
        this.result = "ongoing";
        this.lastAction = null;
        this.lastHeroDeath = null;
        this.actionSeq = 0;
    }

    /**
     * Enregistre les métadonnées de la dernière action exécutée (pour
     * l'animation front). Incrémente le compteur de séquence.
     */
    recordAction(
        actorId: string,
        targetId: string | null,
        targetIds: string[],
        kind: LastAction["kind"],
        name?: string
    ): void {
        this.lastAction = {
            actorId,
            targetId,
            targetIds,
            kind,
            name,
            seq: ++this.actionSeq,
        };
    }

    /** Les héros (unités de type "Hero"). */
    get heroes(): Unit[] {
        return this.units.filter((u) => u.type === "Hero");
    }

    /** Les ennemis (unités de type "Enemy"). */
    get enemies(): Unit[] {
        return this.units.filter((u) => u.type === "Enemy");
    }

    /** Unités encore en vie. */
    get aliveUnits(): Unit[] {
        return this.units.filter((u) => !u.isDead());
    }

    /** Héros encore en vie. */
    get aliveHeroes(): Unit[] {
        return this.heroes.filter((u) => !u.isDead());
    }

    /** Ennemis encore en vie. */
    get aliveEnemies(): Unit[] {
        return this.enemies.filter((u) => !u.isDead());
    }

    /** Renvoie l'unité à l'index donné dans l'ordre d'action, ou null. */
    get currentActor(): Unit | null {
        if (this.actionIndex < this.actionOrder.length) {
            return this.actionOrder[this.actionIndex];
        }
        return null;
    }

    /** Le combat est-il terminé ? */
    get isOver(): boolean {
        return this.result !== "ongoing";
    }

    /**
     * Vérifie la fin de combat et met à jour `result` si nécessaire.
     * @returns true si le combat vient de se terminer.
     */
    checkEnd(): boolean {
        if (this.result !== "ongoing") return true;

        if (this.aliveEnemies.length === 0) {
            this.result = "victory";
            this.pushLog("🏆 Victoire ! Tous les ennemis ont été vaincus.");
            return true;
        }
        if (this.aliveHeroes.length === 0) {
            this.result = "defeat";
            this.pushLog("💀 Défaite... L'escouade a été anéantie.");
            return true;
        }
        return false;
    }

    /** Ajoute une entrée au log. */
    pushLog(message: string): void {
        this.log.push(message);
    }

    /** Ajoute plusieurs entrées au log. */
    pushLogMany(messages: string[]): void {
        for (const m of messages) this.pushLog(m);
    }

    /**
     * Renvoie la vitesse (Dextérité) d'une unité pour l'ordre d'action.
     * Les héros utilisent leur Dextérité ; les monstres n'ont pas de stats,
     * on utilise donc leur rang comme approximation de vitesse.
     */
    getSpeed(unit: Unit): number {
        if (unit instanceof Character) {
            return unit.stats.dexterity;
        }
        if (unit instanceof Monster) {
            return unit.rank;
        }
        return 1;
    }

    /**
     * Construit l'ordre d'action du tour : unités vivantes triées par
     * vitesse décroissante (stabilité préservée en cas d'égalité).
     */
    buildActionOrder(): Unit[] {
        // Les unités remplacées (ex. Démoniste invoqué) ne sont pas sur le
        // plateau : elles n'agissent pas (c'est leur invocation qui agit).
        this.actionOrder = this.aliveUnits
            .filter((u) => !u.isReplaced)
            .slice()
            .sort((a, b) => this.getSpeed(b) - this.getSpeed(a));
        this.actionIndex = 0;
        this.pushLog(`--- Tour ${this.turn} ---`);
        return this.actionOrder;
    }

    /** Passe à l'acteur suivant dans l'ordre d'action. */
    nextActor(): Unit | null {
        this.actionIndex++;
        return this.currentActor;
    }

    /** Passe au tour suivant et reconstruit l'ordre d'action. */
    nextTurn(): void {
        this.turn++;
        this.buildActionOrder();
    }
}
