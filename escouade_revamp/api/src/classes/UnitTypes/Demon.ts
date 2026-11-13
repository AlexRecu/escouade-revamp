import { Item } from "../Items/Item";
import { Position, Spell, Statistics } from "../Types";
import { Unit } from "../UnitTypes/Unit";
import { Character } from "./Character";
import demonData from "../../config/demons_data.json";
import spellData from "../../config/spells_data.json";
import { calculateDamageMultiplier, messageDamageMultiplier } from "../../utils/DamageUtils";
import { applyStatus } from "../../utils/StatusUtils";

export class Demon extends Unit {
    actions: string[];
    currentTurn: number;
    stats: Statistics;
    /** Le Démoniste qui a invoqué ce démon (null pour un démon de zone). */
    summoner: Character | null = null;

    constructor(name: string, type: "Hero" | "Enemy", position: Position) {
        const demon = demonData.find(demon => demon.name === name);
        if (demon) {
            super(demon.id, demon.name, type, position, 9999, 9999, [], []);
            this.actions = demon.actions;
            this.currentTurn = 0;
            this.stats = {
                strength: demon.strength,
                dexterity: 0,
                endurance: demon.endurance,
                mana: 0,
                intelligence: demon.intelligence,
                perception: 0,
                charisma: 0
            }
        }else{
            throw new Error("Demon.constructor : Cannot invoke such demon");
        }
    }

    act(allUnits: Unit[]): string[] {
        let resultArray: string[] = [];
        if (this.currentTurn < this.stats.endurance) {
            resultArray.push(`${this.name} exécute : ${this.actions[this.currentTurn]}`);
            
            const spell = spellData.find(spell => spell.name === this.actions[this.currentTurn]) as Spell;
            if(spell){
                // Les sorts des démons sont **mono-cible** (comme dans le livret) :
                // - Sorts offensifs/statuts → le héros le plus proche.
                // - Sorts de soin → l'allié le plus blessé (ou soi-même).
                let target: Unit | null;
                if (spell.hp) {
                    // Soin : cible l'allié le plus blessé (PV les plus bas).
                    const allies = allUnits.filter(u => u.type === this.type && !u.isDead());
                    target = allies.sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp)[0] ?? this;
                } else {
                    // Offensif / statut : cible l'unité du **camp adverse** la plus
                    // proche. Le camp adverse dépend du type du démon : un démon
                    // de zone (type "Enemy") cible les héros ; un démon invoqué
                    // (type "Hero", au service du héros) cible les ennemis.
                    const enemyType = this.type === "Hero" ? "Enemy" : "Hero";
                    target = this.getClosestUnit(enemyType, allUnits);
                }
                if (target) {
                    resultArray.push(...this.useSpell(spell, target, 6));
                }
            }else{
                // Action "Attaque" : frappe l'ennemi le plus proche
                const closestUnit = this.getClosestUnit("Enemy", allUnits);
                if (closestUnit) {
                    const damage = this.stats.strength;
                    const actualDamage = closestUnit.applyDamage(damage, resultArray);
                    resultArray.push(`${this.name} frappe ${closestUnit.name}. ${closestUnit.name} perd ${actualDamage}PV !`);
                }
            }
            this.currentTurn++;
        } else {
            resultArray.push(`${this.name} a terminé son invocation.`);
        }
        return resultArray;
    }

    takeDamage(resultArray: string[]): boolean {
        this.stats.endurance--;
        resultArray.push(`${this.name} perd 1 point d'endurance ! Endurance restante : ${this.stats.endurance}`);
        if (this.stats.endurance <= 0) {
            resultArray.push(`${this.name} disparaît !`);
            // Le swap retour au démoniste est géré par BattleManager.cleanupFinishedInvocations.
            return false;
        }
        return true;
    }

    /**
     * Les démons n'ont pas de PV : chaque attaque infligée leur fait perdre
     * **1 point d'endurance** (cf. livret), ce qui réduit leur nombre de tours.
     * Le blocage de dégâts ne s'applique pas (pas de PV à bloquer).
     */
    applyDamage(damage: number, resultArray: string[]): number {
        if (this.stats.endurance <= 0) return 0;
        this.takeDamage(resultArray);
        return 1;
    }

    /**
     * Un démon est **épuisé** (renvoyé auprès de son démoniste) quand :
     *  - son endurance est épuisée (il a été touché et n'a plus de tours), OU
     *  - il a joué tous ses tours de lui-même (`currentTurn >= endurance`).
     */
    isDead(): boolean {
        return this.stats.endurance <= 0 || this.currentTurn >= this.stats.endurance;
    }

    attack(target: Unit, roll: number, critRoll: number | 0, bonus: number | 0): string[] {
        throw new Error("Method not implemented.");
    }

    useSpellFromName(spellName: string, target: Unit, roll: number, critRoll: number): string[] {
        throw new Error("Method not implemented.");
    }

    /**
     * Les démons n'ont pas de compétences (Skill) : ils exécutent une séquence
     * de sorts prédéfinie via `act`. Cette méthode est donc inapplicable.
     */
    useAbilityByName(name: string, allUnits: Unit[]): string[] {
        return [`${this.name} (démon) n'a pas de compétence "${name}".`];
    }

    useSpell(spell: Spell, target: Unit, roll: number, damageDivisor: number = 1): string[] {
        let resultArray: string[] = [];
        let damage = 0;
        // **Immunité magie** : la cible est insensible aux sorts.
        if (target.status.some(s => s.name === 'Immunité magie')) {
            resultArray.push(`${target.name} est immunisé contre la magie !`);
            return resultArray;
        }
        if (spell.mpCost) {
            // Offensive spells
            if (spell.power) {
                    const damageMultiplier = calculateDamageMultiplier(this, spell.element, target);
                    damage += (Math.pow(spell.power + this.stats.intelligence, 2) / 2) * damageMultiplier;
                    resultArray.push(messageDamageMultiplier(damageMultiplier));
                    damage = Math.round(damage / damageDivisor);
                    resultArray.push(`${target.name} perd ${damage}PV`);
            // Defensive spells	
            } else { // Defensive spells
                if (spell.hp && target.currentHp) { //Variantes de Soin, Grace et Vie
                    if (spell.name.startsWith('Soin') && target.currentHp > 0) {
                        target.currentHp = Math.min(target.currentHp + spell.hp, target.maxHp);
                        resultArray.push(`${target.name} récupère ${spell.hp}PV`);
                    } if (spell.name.startsWith('Grace') && target.currentHp > 0) {
                        target.currentHp = Math.min(target.currentHp + spell.hp, target.maxHp);
                        resultArray.push(`${target.name} récupère ${spell.hp}PV`);
                        //applyStatus push le statut
                    } if (spell.name.startsWith('Vie') && target.currentHp === 0) {
                        target.currentHp = spell.hp;
                        resultArray.push(`${target.name} revient à la vie avec ${spell.hp}PV !`);
                    }
                }
            }
        } else {  // Darkness!!!
            const damageMultiplier = calculateDamageMultiplier(this, spell.element, target);
            damage += (target.currentHp / 2) * damageMultiplier;
            damage = Math.round(damage / damageDivisor);
            resultArray.push(messageDamageMultiplier(damageMultiplier));
        }
        // Gestion des statuts 
        if (spell.status) {
            applyStatus(this, spell.status, target, roll, resultArray);
        }
        target.applyDamage(damage, resultArray);
        return resultArray;
    }

    useItem(item: Item, target: Unit): string[] {
        throw new Error("Method not implemented.");
    }

}