import { CombatState, BattleResult, GRID_SIZE, DiceRoller } from "./CombatState";
import { PhaseSystem } from "./PhaseSystem";
import { Unit } from "../UnitTypes/Unit";
import { Character } from "../UnitTypes/Character";
import { Monster } from "../UnitTypes/Monster";
import { Demon } from "../UnitTypes/Demon";
import { Eon } from "../UnitTypes/Eon";
import { BlackMage, DEMON_SUMMON_COST } from "../Jobs/BlackMage";
import { BlueMage } from "../Jobs/BlueMage";
import { Position } from "../Types";
import { AIService } from "../../services/Battle/AIService";

// Ré-exporté pour l'API publique : BattleManager est l'entrée qui reçoit le roller.
export type { DiceRoller };

const defaultRoller: DiceRoller = () => Math.floor(Math.random() * 6) + 1;

/**
 * Orchestre un combat de bout en bout.
 *
 * Responsabilités :
 *  - piloter la boucle de tours (ordre d'action, phases début/fin)
 *  - exécuter les actions (déplacement, attaque, sort, compétence, objet)
 *  - tirer les dés (roll + roll critique)
 *  - déterminer la fin de combat
 *
 * En mode automatique (par défaut), les héros comme les ennemis sont pilotés
 * par l'IA : cela permet de simuler un combat complet en console et en test.
 * Les méthodes `moveUnit` / `performPlayerAction` préparent le contrôle
 * joueur (Phase 4 — temps réel).
 */
export class BattleManager {
    private state: CombatState;
    private phases: PhaseSystem;
    private ai: AIService;
    private rollDice: DiceRoller;

    constructor(units: Unit[], rollDice: DiceRoller = defaultRoller) {
        this.state = new CombatState(units);
        this.phases = new PhaseSystem(this.state);
        this.ai = new AIService(this.state, rollDice);
        this.rollDice = rollDice;
        this.state.buildActionOrder();
    }

    /** Accès à l'état du combat (lecture). */
    get combatState(): CombatState {
        return this.state;
    }

    /** Résultat courant du combat. */
    get result(): BattleResult {
        return this.state.result;
    }

    /** Le combat est-il terminé ? */
    get isOver(): boolean {
        return this.state.isOver;
    }

    /** Tire un dé de 1 à 6. */
    roll(): number {
        return this.rollDice();
    }

    /**
     * Tire le multiplicateur de coup critique.
     * Règle du livret : si roll = 6, compteur = 5 + reroll.
     * On approxime par un multiplicateur entre 2 et 4 pour un équilibrage raisonnable.
     */
    rollCrit(): number {
        return this.rollDice() + 1; // 2 à 7
    }

    /**
     * Déplace une unité vers une position, si elle n'a pas encore bougé ce tour.
     * @returns le message de résultat.
     */
    moveUnit(unit: Unit, newPosition: Position): string {
        if (unit.isDead()) return `${unit.name} est KO et ne peut pas se déplacer.`;
        if (newPosition.row < 0 || newPosition.row >= GRID_SIZE || newPosition.col < 0 || newPosition.col >= GRID_SIZE) {
            return "Position hors du plateau.";
        }
        const occupant = this.state.units.find(
            (u) => u !== unit && u.position.row === newPosition.row && u.position.col === newPosition.col
        );
        if (occupant) return `La case est occupée par ${occupant.name}.`;

        const previous = { ...unit.position };
        unit.position = newPosition;
        return `${unit.name} se déplace de (${previous.row},${previous.col}) à (${newPosition.row},${newPosition.col}).`;
    }

    /**
     * Exécute une action pour une unité (héros ou ennemi).
     * @param unit l'unité qui agit
     * @param action type d'action
     * @param targets cibles
     * @param extra paramètres (roll, critRoll, bonus, spell, skill, item)
     * @returns le log de l'action.
     */
    performAction(
        unit: Unit,
        action: "attack" | "spell" | "skill" | "item" | "combo",
        targets: Unit[],
        extra: { roll?: number; critRoll?: number; bonus?: number; spell?: { name: string }; skill?: { name: string }; item?: any; combo?: string[] } = {}
    ): string[] {
        if (unit.isDead()) return [`${unit.name} est KO.`];
        // Un combo résout ses propres cibles (getValidTargets) : pas de cible
        // explicite requise à l'appel.
        if (targets.length === 0 && action !== "combo") return ["Aucune cible."];

        const roll = extra.roll ?? this.roll();
        const critRoll = extra.critRoll ?? this.rollCrit();
        const bonus = extra.bonus ?? 0;
        const result: string[] = [];

        switch (action) {
            case "attack":
                result.push(...unit.attack(targets[0], roll, critRoll, bonus));
                break;
            case "combo":
                if (extra.combo) {
                    result.push(...unit.useCombo(extra.combo, this.state.units));
                } else {
                    result.push("Aucun combo spécifié.");
                }
                break;
            case "spell":
                if (extra.spell) {
                    result.push(...unit.useSpellFromName(extra.spell.name, targets[0], roll, critRoll));
                } else {
                    result.push("Aucun sort spécifié.");
                }
                break;
            case "skill":
                if (extra.skill) {
                    result.push(...unit.useAbilityByName(extra.skill.name, this.state.units));
                } else {
                    result.push("Aucune compétence spécifiée.");
                }
                break;
            case "item":
                if (extra.item) {
                    result.push(...unit.useItem(extra.item, targets[0]));
                } else {
                    result.push("Aucun objet spécifié.");
                }
                break;
        }

        this.state.pushLogMany(result);
        this.state.checkEnd();
        return result;
    }

    /**
     * Invoque un démon **à la place du démoniste** (cf. livret : "amenés sur le
     * terrain à la place de leur démoniste").
     *
     * Mécanique (mode auto) :
     *  - le démoniste est **masqué** (`isReplaced`) : il reste vivant (compte
     *    pour la défaite) mais ne peut ni agir ni être ciblé ;
     *  - le démon est ajouté au plateau à sa position et joue **tout seul**
     *    (`act()`) jusqu'à épuisement de ses tours ;
     *  - quand le démon est épuisé, `cleanupFinishedInvocations` le renvoie et le
     *    démoniste **reprend sa place** (dénasqué).
     *
     * C'est le point d'entrée du **choix du joueur** (quand + quel démon) ; en
     * mode auto, `trySummonDemon` l'appelle avec le premier démon pactisé.
     *
     * @param demonist Le Démoniste qui invoque.
     * @param demonName Nom exact du démon pactisé à invoquer.
     * @returns Le log de l'invocation.
     */
    summonDemon(demonist: Character, demonName: string): string[] {
        const logs: string[] = [];
        if (!(demonist.job instanceof BlackMage)) {
            return ["Seul un Démoniste peut invoquer un démon."];
        }
        if (demonist.isReplaced) {
            return [`${demonist.name} a déjà un démon invoqué.`];
        }
        try {
            const demon = (demonist.job as BlackMage).summonDemon(demonName, demonist);
            demon.summoner = demonist;
            demonist.isReplaced = true;
            this.state.units.push(demon);
            logs.push(`${demonist.name} invoque ${demon.name} à sa place.`);
        } catch (e: any) {
            logs.push(e.message);
        }
        return logs;
    }

    /**
     * Un Démoniste invoque un démon pactisé s'il en a un
     * et s'il a assez de Mana.
     * @returns true si un démon a été invoqué.
     */
    private trySummonDemon(demonist: Character, demon?: Demon): boolean {
        if (!(demonist.job instanceof BlackMage)) return false;
        const bm = demonist.job as BlackMage;
        const pactized = bm.listDemon();
        if (pactized.length === 0) return false;
        // Si un démon spécifique est demandé, il doit être pactisé ; sinon
        // (mode auto), on invoque le premier pactisé.
        const demonName = demon ? demon.name : pactized[0];
        if (!pactized.includes(demonName)) return false;
        if (demonist.currentMp < DEMON_SUMMON_COST) return false;
        const logs = this.summonDemon(demonist, demonName);
        this.state.pushLogMany(logs);
        return true;
    }

    /**
     * Invoque un Eon **à la place de l'Invocateur** (cf. livret : "la créature
     * est possédée par le lanceur").
     *
     * Mécanique (mode coopératif) :
     *  - l'Invocateur est **masqué** (`isReplaced`) : il reste vivant (compte
     *    pour la défaite) mais ne peut ni agir ni être ciblé ;
     *  - l'Eon est ajouté au plateau à sa position, avec les stats de
     *    l'invocateur (dégâts basés sur son Intelligence) et 10 points de
     *    transe (TP) ;
     *  - contrairement au démon (autonome), l'Eon est **piloté par le joueur** :
     *    il ne peut sélectionner que les actions de l'Eon (`useAbilityByName`),
     *    pas ses sorts/compétences habituels ;
     *  - l'invocation se termine si l'invocateur n'a plus de PV ou de TP ;
     *    `cleanupFinishedInvocations` renvoie alors l'Eon et l'Invocateur
     *    **reprend sa place** (dénasqué).
     *
     * C'est le point d'entrée du **choix du joueur** (quand + quel Eon) ; en
     * mode auto, `trySummonEon` l'appelle avec le premier Eon du bestiaire.
     *
     * @param invoker L'Invocateur qui invoque.
     * @param eonName Nom exact de l'Eon à invoquer.
     * @returns Le log de l'invocation.
     */
    summonEon(invoker: Character, eonName: string): string[] {
        const logs: string[] = [];
        if (!(invoker.job instanceof BlueMage)) {
            return ["Seul un Invocateur peut invoquer un Eon."];
        }
        if (invoker.isReplaced) {
            return [`${invoker.name} a déjà un Eon invoqué.`];
        }
        try {
            const eon = (invoker.job as BlueMage).summonEon(eonName, invoker);
            eon.summoner = invoker;
            invoker.isReplaced = true;
            this.state.units.push(eon);
            logs.push(`${invoker.name} invoque ${eon.name} à sa place.`);
        } catch (e: any) {
            logs.push(e.message);
        }
        return logs;
    }

    /**
     * Mode auto : un Invocateur invoque le premier Eon du bestiaire.
     * (Le choix de l'Eon est simplifié en auto.)
     * @returns true si un Eon a été invoqué.
     */
    private trySummonEon(invoker: Character): boolean {
        if (!(invoker.job instanceof BlueMage)) return false;
        const eons = (invoker.job as BlueMage).listEon();
        if (eons.length === 0) return false;
        const logs = this.summonEon(invoker, eons[0]);
        this.state.pushLogMany(logs);
        return true;
    }

    /**
     * Renvoie les invocations **terminées** (démons épuisés, Eons dont
     * l'invocation s'est achevée) : ils sont retirés du plateau et leur
     * invocateur **reprend sa place** (dénasqué).
     *
     * Un démon est épuisé quand il a joué tous ses tours (de lui-même ou
     * touché). Un Eon est terminé quand ses PV tombent à 0 ou que ses points
     * de transe sont épuisés (`invocationEnded`).
     */
    private cleanupFinishedInvocations(): void {
        for (const unit of this.state.units) {
            if ((unit instanceof Demon || unit instanceof Eon) && unit.isDead()) {
                this.state.units.splice(this.state.units.indexOf(unit), 1);
                this.state.pushLog(`${unit.name} est renvoyé auprès de son invocateur.`);
                if (unit.summoner) {
                    unit.summoner.isReplaced = false;
                    this.state.pushLog(`${unit.summoner.name} reprend sa place.`);
                }
            }
        }
    }

    /**
     * Exécute l'action d'un acteur (héros ou ennemi) via l'IA.
     * Utilisé en mode automatique (simulation / tests).
     */
    private executeActorAction(unit: Unit): void {
        if (unit instanceof Monster) {
            this.ai.executeEnemyAction(unit);
        } else if (unit instanceof Character) {
            // Un Démoniste invoque un démon (mode auto) s'il en a un pactisé.
            if (this.trySummonDemon(unit)) {
                return;
            }
            // Un Invocateur invoque un Eon (mode auto) s'il est évolué.
            if (this.trySummonEon(unit)) {
                return;
            }
            // Un Samouraï enchaîne ses Hissatsu (passif Bushido) au lieu
            // d'attaquer simplement.
            if (unit.job.name === "Samouraï") {
                this.ai.executeSamuraiAction(unit);
                return;
            }
            this.ai.executeHeroAction(unit);
        } else if (unit instanceof Demon) {
            // Le démon ne se déplace pas : il exécute sa séquence d'actions prédéfinie.
            const log = unit.act(this.state.units);
            this.state.pushLogMany(log);
        } else if (unit instanceof Eon) {
            // L'Eon est coopératif : en mode auto, l'IA choisit une de ses
            // compétences (au moins 1 TP/tour). En mode joueur, c'est le
            // joueur qui sélectionne l'action via `performAction`.
            this.ai.executeEonAction(unit);
        }
        this.state.checkEnd();
    }

    /**
     * Traite un round complet : chaque unité vivante agit dans l'ordre de vitesse.
     * @returns true si au moins une unité a agi (évite une boucle infinie).
     */
    private processRound(): boolean {
        let acted = false;

        while (this.state.currentActor && !this.state.isOver) {
            const unit = this.state.currentActor;
            this.state.nextActor();

            if (unit.isDead()) continue;

            this.phases.startUnitTurn(unit);

            if (!this.phases.canAct(unit)) {
                this.state.pushLog(`${unit.name} ne peut pas agir ce tour.`);
                this.phases.endUnitTurn(unit);
                continue;
            }

            const actionCount = this.phases.getActionCount(unit);
            for (let i = 0; i < actionCount; i++) {
                if (unit.isDead() || this.state.isOver) break;
                this.executeActorAction(unit);
                acted = true;
            }

            this.phases.endUnitTurn(unit);
        }

        // Renvoie les invocations terminées (démons épuisés, Eons épuisés) :
        // leur invocateur reprend sa place.
        this.cleanupFinishedInvocations();

        if (!this.state.isOver) {
            this.state.nextTurn();
        }
        return acted;
    }

    /**
     * Tente la fuite (décision commune de l'escouade).
     * Règle du livret : tous les héros vivants rollent un dé ; si personne ne
     * fait 1, la fuite réussit et le combat se termine.
     * @returns true si la fuite a réussi (combat terminé, résultat "fled").
     */
    attemptFlee(): boolean {
        if (this.state.isOver) return false;

        const heroes = this.state.aliveHeroes;
        if (heroes.length === 0) return false;

        this.state.pushLog("🏃 L'escouade tente de fuir !");
        let success = true;
        for (const hero of heroes) {
            const roll = this.roll();
            if (roll === 1) {
                success = false;
                this.state.pushLog(`${hero.name} rate sa fuite (roll 1).`);
            } else {
                this.state.pushLog(`${hero.name} s'échappe (roll ${roll}).`);
            }
        }

        if (success) {
            this.state.result = "fled";
            this.state.pushLog("💨 La fuite est un succès, l'escouade s'échappe du combat !");
        } else {
            this.state.pushLog("❌ La fuite échoue, le combat continue !");
        }
        return success;
    }

    /**
     * Simule le combat de bout en bout (mode automatique, IA vs IA).
     * @param maxTurns garde-fou anti boucle infinie.
     * @returns le résultat final du combat.
     */
    run(maxTurns: number = 50): BattleResult {
        let safety = 0;
        while (!this.state.isOver && safety < maxTurns) {
            const acted = this.processRound();
            if (!acted) break;
            safety++;
        }
        if (!this.state.isOver) {
            this.state.result = "defeat";
            this.state.pushLog("⏱️ Fin du combat par dépassement du nombre de tours.");
        }
        return this.state.result;
    }
}
