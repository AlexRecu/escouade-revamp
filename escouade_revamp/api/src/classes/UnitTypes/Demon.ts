import { Item } from "../Items/Item";
import { Position, Spell, Statistics } from "../Types";
import { Unit } from "../UnitTypes/Unit";
import demonData from "../../config/demons_data.json";
import spellData from "../../config/spells_data.json";
import { calculateDamageMultiplier, messageDamageMultiplier } from "../../utils/DamageUtils";
import { applyStatus } from "../../utils/StatusUtils";

export class Demon extends Unit {
    actions: string[];
    currentTurn: number;
    stats: Statistics;

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
            throw new Error("Impossible d'invoquer ce démon");
        }
    }

    act(allUnits: Unit[]): string[] {
        let resultArray: string[] = [];
        if (this.currentTurn < this.stats.endurance) {
            resultArray.push(`${this.name} exécute : ${this.actions[this.currentTurn]}`);
            
            const spell = spellData.find(spell => spell.name === this.actions[this.currentTurn]) as Spell;
            // TODO faire porter l'attribut target single/multi sur le spell et refacto useSpell avec allUnits ?
            // Trop cheaté les dégats de spell multi, NOGO
            if(spell){
                let targets: Unit[] = []
                if(spell.hp){ // Soin + et Soin X
                    targets = allUnits.filter(unit => unit.type === this.type);
                }else{
                    targets = allUnits.filter(unit => unit.type !== this.type);
                }
                for(const target of targets){
                    resultArray.push(...this.useSpell(spell, target, 6));
                }
            }else{
                const closestUnit = this.getClosestUnit("Enemy", allUnits);
                // TODO faire les attack
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
            return false; // Le démon disparaît TODO rendre la place au démoniste
        }
        return true;
    }

    attack(target: Unit, roll: number, critRoll: number | 0, bonus: number | 0): string[] {
        throw new Error("Method not implemented.");
    }

    useSpellFromName(spellName: string, target: Unit, roll: number, critRoll: number): string[] {
        throw new Error("Method not implemented.");
    }

    useSpell(spell: Spell, target: Unit, roll: number): string[] {
        let resultArray: string[] = [];
        let damage = 0;
        
        if (spell.mpCost) {
            // Offensive spells
            if (spell.power) {
                    const damageMultiplier = calculateDamageMultiplier(this, spell.element, target);
                    damage += (Math.pow(spell.power + this.stats.intelligence, 2) / 2) * damageMultiplier;
                    resultArray.push(messageDamageMultiplier(damageMultiplier));
                    damage = Math.round(damage);
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
            resultArray.push(messageDamageMultiplier(damageMultiplier));
        }
        // Gestion des statuts 
        if (spell.status) {
            applyStatus(this, spell.status, target, roll, resultArray);
        }
        target.currentHp = Math.max(target.currentHp - damage, 0);
        return resultArray;
    }
    useAbility(skillName: string, allUnits: Unit[]): string[] {
        throw new Error("Method not implemented.");
    }
    useItem(item: Item, target: Unit): string[] {
        throw new Error("Method not implemented.");
    }

}