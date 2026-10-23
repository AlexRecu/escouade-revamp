import { CombatState, DiceRoller } from "../../classes/Combat/CombatState";
import { Unit } from "../../classes/UnitTypes/Unit";
import { Character } from "../../classes/UnitTypes/Character";
import { Monster } from "../../classes/UnitTypes/Monster";
import { Eon } from "../../classes/UnitTypes/Eon";
import { Position } from "../../classes/Types";
import { isAdjacentToGoal, isOccupied } from "../../utils/PositionUtils";

/**
 * Service d'intelligence artificielle pour le combat.
 *
 * - `executeEnemyAction` : fait agir un monstre (se rapprocher de la cible la
 *   plus proche, puis attaquer ; ou utiliser une compétence de monstre).
 * - `executeHeroAction` : fait agir un héros en mode automatique (simulation) :
 *   attaque la cible la plus proche, ou soigne un allié blessé si mage.
 *
 * Les dés sont tirés par le `BattleManager` via les méthodes d'unité ; ici on
 * tire simplement des rolls aléatoires pour alimenter les attaques.
 */
export class AIService {
    private rollDice: DiceRoller;

    constructor(private state: CombatState, rollDice: DiceRoller = () => Math.floor(Math.random() * 6) + 1) {
        this.rollDice = rollDice;
    }

    private roll(): number {
        return this.rollDice();
    }

    private rollCrit(): number {
        return this.rollDice() + 1;
    }

    /**
     * Fait agir un monstre : se déplace vers sa cible puis l'attaque (ou
     * utilise une de ses compétences si disponible).
     *
     * Choix de la cible : un héros sous **Provoque** (`isTargeted = true`)
     * attire toute l'attention des ennemis → il est ciblé en priorité, même
     * s'il n'est pas le plus proche. Sinon, l'ennemi vise le héros le plus
     * proche (comportement par défaut).
     */
    executeEnemyAction(monster: Monster): void {
        const provoked = this.state.aliveHeroes.find(
            (u) => u instanceof Character && u.isTargeted
        );
        const target = provoked ?? monster.getClosestUnit("Hero", this.state.units);
        if (!target) return;

        const inMeleeRange = isAdjacentToGoal(monster.position, target.position);

        // ── 1. Déplacement ────────────────────────────────────────────────
        // Physique : se rapproche de la cible (pour pouvoir l'atteindre à
        // portée 1). Magique : garde la distance — s'il est collé à un héros
        // il s'immobilise, sinon il recule tous les 2-3 tours s'il le peut.
        if (monster.attackType === "Physique") {
            if (!inMeleeRange) {
                monster.moveTowards(target.position, monster.getMovementRange(), this.state.units);
            }
        } else {
            const heroAdjacent = this.state.aliveHeroes.some(
                (u) => u instanceof Character && isAdjacentToGoal(u.position, monster.position)
            );
            if (!heroAdjacent && monster.turnCount % 3 === 0) {
                monster.moveAwayFrom(target.position, monster.getMovementRange(), this.state.units);
            }
        }

        // Snapshot des PV avant l'action : le diff donne les unités réellement
        // affectées (les attaques de zone touchent plusieurs héros).
        const before = new Map<string, number>();
        for (const u of this.state.units) before.set(u.id, u.currentHp);

        // ── 2. Capacité spéciale (PV < 33%) : Appel à la meute / Explosion ─
        if (monster.currentHp < monster.maxHp / 3) {
            const special = monster.getReadyAbilities().find(
                (n) => monster.isSummonAbility(n) || monster.isExplosionAbility(n)
            );
            if (special) {
                this.executeAbility(monster, special, target, before);
                return;
            }
        }

        // ── 3. Choix de l'action ──────────────────────────────────────────
        // Le monstre alterne entre son attaque normale et ses capacités : une
        // capacité prête est utilisée avec 50% de chance, sinon attaque
        // normale. Au début du combat (tour 1), s'il ne peut pas toucher à
        // portée, il privilégie une capacité à distance (sort) ou de
        // rapprochement (Rapace, Ruée mortelle…).
        const ready = monster.getUsableAbilities(this.state.units).filter(
            (n) => !monster.isSummonAbility(n) && !monster.isExplosionAbility(n)
        );
        let ability: string | null = null;
        if (ready.length > 0) {
            if (monster.turnCount === 1 && !inMeleeRange) {
                const ranged = ready.find((n) => monster.isRangedAbility(n));
                const approach = ready.find((n) => monster.isApproachAbility(n));
                ability = ranged ?? approach ?? (Math.random() < 0.5 ? ready[0] : null);
            } else {
                ability = Math.random() < 0.5 ? ready[Math.floor(Math.random() * ready.length)] : null;
            }
        }

        if (ability) {
            this.executeAbility(monster, ability, target, before);
        } else {
            this.executeBasicAttack(monster, target, before);
        }
    }

    /**
     * Exécute une capacité du monstre (skill ou sort), déclenche son cooldown
     * et enregistre l'action pour l'animation front.
     */
    private executeAbility(monster: Monster, name: string, target: Unit, before: Map<string, number>): void {
        const info = monster.getAbilityInfo(name);
        if (!info) return;

        // "Appel à la meute" : fait apparaître un congénère sur une case libre.
        if (monster.isSummonAbility(name)) {
            const log = monster.useAbilityByName(name, this.state.units);
            this.state.pushLogMany(log);
            this.trySummonAlly(monster);
            // Cooldown : sans ça, le monstre (toujours sous 33% PV) réutiliserait
            // la capacité au tour suivant et invoquerait un 2e congénère.
            monster.startCooldown(name);
            this.state.recordAction(monster.id, target.id, [target.id], "skill", name);
            return;
        }

        let log: string[];
        let kind: "skill" | "spell";
        if (info.kind === "spell") {
            log = monster.useSpellFromName(name, target, this.roll(), this.rollCrit());
            kind = "spell";
        } else {
            log = monster.useAbilityByName(name, this.state.units);
            kind = "skill";
        }
        this.state.pushLogMany(log);
        monster.startCooldown(name);
        const affected = this.state.units
            .filter((u) => {
                const b = before.get(u.id);
                return b !== undefined && u.currentHp !== b;
            })
            .map((u) => u.id);
        this.state.recordAction(monster.id, target.id, affected.length ? affected : [target.id], kind, name);
    }

    /**
     * Attaque normale du monstre (portée 1). Un monstre "Physique" ne touche
     * que si la cible est à portée ; un "Magique" frappe à distance (kind
     * "spell" → projectile côté front).
     */
    private executeBasicAttack(monster: Monster, target: Unit, before: Map<string, number>): void {
        const inMeleeRange = isAdjacentToGoal(monster.position, target.position);
        if (monster.attackType !== "Magique" && !inMeleeRange) {
            this.state.pushLog(`${monster.name} est hors de portée de ${target.name}.`);
            this.state.recordAction(monster.id, target.id, [target.id], "attack");
            return;
        }
        if (this.tryProtect(target)) {
            return;
        }
        const log = monster.attack(target, this.roll(), this.rollCrit());
        this.state.pushLogMany(log);
        const affected = this.state.units
            .filter((u) => {
                const b = before.get(u.id);
                return b !== undefined && u.currentHp !== b;
            })
            .map((u) => u.id);
        const kind = monster.attackType === "Magique" ? "spell" : "attack";
        this.state.recordAction(monster.id, target.id, affected.length ? affected : [target.id], kind);
    }

    /**
     * "Appel à la meute" : fait apparaître un congénère (même nom, même niveau
     * de zone) sur une case libre du plateau.
     */
    private trySummonAlly(monster: Monster): void {
        const pos = this.findFreePosition();
        if (!pos) {
            this.state.pushLog(`${monster.name} n'a pas d'espace pour appeler un congénère.`);
            return;
        }
        const ally = new Monster(monster.name, pos, "Enemy", monster.zoneLevel);
        this.state.units.push(ally);
        this.state.pushLog(`${monster.name} appelle un congénère à la meute !`);
    }

    /** Trouve une case libre sur le plateau 8x8 (ou null si saturé). */
    private findFreePosition(): Position | null {
        const free: Position[] = [];
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const pos = { row, col };
                if (!isOccupied(pos, this.state.units)) free.push(pos);
            }
        }
        if (free.length === 0) return null;
        return free[Math.floor(Math.random() * free.length)];
    }

    /**
     * Tente de faire protéger la cible par un allié sous "Bouclier impénétrable".
     * Le protecteur (Guerrier, ou Paladin avec double roll) se place à la place
     * de la cible et encaisse l'attaque à sa place.
     * @returns true si l'attaque a été interceptée.
     */
    private tryProtect(target: Unit): boolean {
        if (!(target instanceof Character)) return false;

        const protector = this.state.aliveHeroes.find(
            (u) =>
                u instanceof Character &&
                u !== target &&
                u.job.name !== "Chevalier Noir" &&
                u.status.some((s) => s.name === "Bouclier impénétrable")
        ) as Character | undefined;

        if (!protector) return false;

        const isPaladin = protector.job.specialAbility.startsWith("Protection divine");
        const roll = this.roll();
        const doubleRoll = isPaladin ? this.roll() : 0;
        const log: string[] = [];
        return protector.protectTarget(target, roll, doubleRoll, log);
    }

    /**
     * Fait agir un héros en mode automatique (simulation / tests).
     * Stratégie simple :
     *  - si mage et un allié est blessé, tenter un soin ;
     *  - sinon attaquer l'ennemi le plus proche.
     */
    executeHeroAction(hero: Character): void {
        const enemy = hero.getClosestUnit("Enemy", this.state.units);
        if (!enemy) return;

        // Se rapprocher de l'ennemi le plus proche (déplacement dépendant de la classe).
        hero.moveTowards(enemy.position, hero.getMovementRange(), this.state.units);

        // Un héros "soigneur" (Mage blanc) soigne un allié très blessé.
        if (hero.job.name === "Mage blanc") {
            const woundedAlly = this.state.aliveHeroes
                .filter((u) => u instanceof Character && u.currentHp < u.maxHp * 0.4)
                .sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp)[0];
            const healSpell = hero.getAvailableSpells().find((s) => s.name.startsWith("Soin"));
            if (woundedAlly && healSpell) {
                const log = hero.useSpellFromName(healSpell.name, woundedAlly, this.roll(), this.rollCrit());
                this.state.pushLogMany(log);
                return;
            }
        }

        const log = hero.attack(enemy, this.roll(), this.rollCrit());
        this.state.pushLogMany(log);
    }

    /**
     * Fait agir un Samouraï en mode automatique (simulation / tests).
     *
     * Le Samouraï (passif Bushido) **enchaîne ses Hissatsu** (compétences d'AP)
     * au lieu d'attaquer simplement : il se rapproche de l'ennemi le plus
     * proche, puis enchaîne ses Hissatsu débloqués tant qu'il a de l'AP
     * (via `useCombo`).
     *
     * NB : *Zeninage* est exclu de l'enchaînement auto — c'est une décision
     * stratégique (sacrifier son or) que le joueur prend en mode manuel.
     */
    executeSamuraiAction(samurai: Character): void {
        const enemy = samurai.getClosestUnit("Enemy", this.state.units);
        if (!enemy) return;

        // Se rapprocher de l'ennemi le plus proche.
        samurai.moveTowards(enemy.position, samurai.getMovementRange(), this.state.units);

        // Hissatsu débloqués (par niveau), sauf Zeninage (décision stratégique).
        const hissatsu = samurai
            .getAvailableAbilities()
            .map((s) => s.name)
            .filter((name) => name !== "Zeninage");

        if (hissatsu.length === 0) {
            // Aucun Hissatsu débloqué : attaque simple.
            const log = samurai.attack(enemy, this.roll(), this.rollCrit());
            this.state.pushLogMany(log);
            return;
        }

        const log = samurai.useCombo(hissatsu, this.state.units);
        this.state.pushLogMany(log);
    }

    /**
     * Fait agir un Eon en mode automatique (simulation / tests).
     *
     * L'Eon est **coopératif** : en mode joueur, c'est le joueur qui choisit
     * l'action (via `performAction` → `useAbilityByName`). En mode auto, l'IA
     * choisit une compétence à sa place.
     *
     * Règle du livret : "Au moins 1 TP/Tour" — l'Eon doit dépenser au moins
     * 1 point de transe par tour (pas de tour "passé"). L'IA choisit donc une
     * compétence de coût ≥ 1 TP, en privilégiant la plus puissante (power max).
     * L'Eon ne se déplace pas : il est possédé par l'invocateur à sa position.
     */
    executeEonAction(eon: Eon): void {
        const usable = eon.skills.filter((s) => s.tp >= 1);
        if (usable.length === 0) return;
        const skill = usable
            .slice()
            .sort((a, b) => (b.power ?? 0) - (a.power ?? 0))[0];
        const log = eon.useAbilityByName(skill.name, this.state.units);
        this.state.pushLogMany(log);
    }
}
