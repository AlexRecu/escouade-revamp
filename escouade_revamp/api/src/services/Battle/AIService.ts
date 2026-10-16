import { CombatState, DiceRoller } from "../../classes/Combat/CombatState";
import { Unit } from "../../classes/UnitTypes/Unit";
import { Character } from "../../classes/UnitTypes/Character";
import { Monster } from "../../classes/UnitTypes/Monster";
import { Eon } from "../../classes/UnitTypes/Eon";

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
     * Fait agir un monstre : se déplace vers le héros le plus proche puis
     * l'attaque (ou utilise une de ses compétences si disponible).
     */
    executeEnemyAction(monster: Monster): void {
        const target = monster.getClosestUnit("Hero", this.state.units);
        if (!target) return;

        // Se rapprocher de la cible (déplacement dépendant de la classe).
        monster.moveTowards(target.position, monster.getMovementRange(), this.state.units);

        // Utiliser une compétence de monstre si disponible, sinon attaque simple.
        if (monster.monsterSkills && monster.monsterSkills.length > 0 && Math.random() < 0.3) {
            const log = monster.useRandomAbility(this.state.units);
            this.state.pushLogMany(log);
        } else {
            // Un allié sous "Bouclier impénétrable" peut intercepter l'attaque.
            if (this.tryProtect(target)) {
                return;
            }
            const log = monster.attack(target, this.roll(), this.rollCrit());
            this.state.pushLogMany(log);
        }
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
