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
                let targets: Unit[] = []
                if(spell.hp){ // Soin + et Soin X
                    targets = allUnits.filter(unit => unit.type === this.type);
                }else{
                    targets = allUnits.filter(unit => unit.type !== this.type);
                }
                // Un sort qui frappe plusieurs cibles inflige la moitié des dégâts par cible (équilibrage)
                const damageDivisor = targets.length > 1 ? 2 : 1;
                for(const target of targets){
                    resultArray.push(...this.useSpell(spell, target, 6, damageDivisor));
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