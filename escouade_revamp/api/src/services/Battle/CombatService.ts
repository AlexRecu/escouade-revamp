// src/services/Battle/CombatService.ts
import { Encounter } from "../../classes/Exploration/Encounter";
import { Party } from "../../classes/Exploration/Party";
import { BattleManager, DiceRoller } from "../../classes/Combat/BattleManager";
import { BattleResult } from "../../classes/Combat/CombatState";
import { Character } from "../../classes/UnitTypes/Character";
import { Monster } from "../../classes/UnitTypes/Monster";

/**
 * Résultat d'un combat résolu.
 */
export interface CombatOutcome {
    result: BattleResult;
    /** Ennemis vaincus (pour le butin). */
    defeated: Monster[];
    /** Héros survivants (pour la distribution du butin). */
    survivors: Character[];
    /** Log complet du combat. */
    log: string[];
}

const defaultRoller: DiceRoller = () => Math.floor(Math.random() * 6) + 1;

/**
 * Pont entre l'exploration et le moteur de combat (Phase 1).
 *
 * Transforme une `Encounter` (ennemis) + une `Party` (héros) en un
 * `BattleManager` prêt à être piloté, et résout le combat en mode
 * automatique (IA) pour la Phase 2.
 */
export class CombatService {
    /**
     * Construit un `BattleManager` à partir d'une rencontre d'exploration.
     *
     * Les héros vivants sont placés en bas du plateau (rows 6-7) et les
     * ennemis selon leurs placements de rencontre.
     *
     * @param encounter la rencontre courante (fournit les ennemis).
     * @param party l'escouade (fournit les héros).
     * @param rollDice tireur de dés injectable (déterminisme en test).
     */
    static buildBattle(
        encounter: Encounter,
        party: Party,
        rollDice: DiceRoller = defaultRoller
    ): BattleManager {
        const units: (Character | Monster)[] = [];

        // Héros vivants en bas du plateau.
        const aliveHeroes = party.getAliveMembers();
        aliveHeroes.forEach((hero, i) => {
            hero.position = { row: 6 + Math.floor(i / 4), col: i % 4 };
            units.push(hero);
        });

        // Ennemis selon leurs placements.
        for (const { monster, position } of encounter.getEnemyPlacements()) {
            monster.position = position;
            units.push(monster);
        }

        return new BattleManager(units, rollDice);
    }

    /**
     * Résout le combat de bout en bout (mode automatique) et retourne le
     * résultat : vaincus, survivants, log.
     *
     * Si le combat est déjà terminé (piloté manuellement), `run()` retourne
     * immédiatement le résultat courant.
     */
    static runCombat(battle: BattleManager, maxTurns = 50): CombatOutcome {
        const result = battle.run(maxTurns);
        const state = battle.combatState;
        return {
            result,
            defeated: state.enemies.filter((m) => m.isDead()) as Monster[],
            survivors: state.heroes.filter((h) => !h.isDead()) as Character[],
            log: state.log,
        };
    }
}
