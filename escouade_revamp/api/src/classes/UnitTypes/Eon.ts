import { Item } from "../Items/Item";
import { EonSkill } from "../Types";
import eonData from "../../config/eons_data.json";
import { Character } from "./Character";
import { Unit } from "./Unit";
import { calculateDamageMultiplier, getValidTargets, messageDamageMultiplier } from "../../utils/DamageUtils";
import { applyStatus } from "../../utils/StatusUtils";

export class Eon extends Unit {
    initialCharacter: Character;
    element: string;
    skills: EonSkill[];
    currentTransePoint: number = 10;

    constructor(initialCharacter: Character, eonName: string) {
        super(initialCharacter.id, initialCharacter.name+"/"+eonName, initialCharacter.type, initialCharacter.position, initialCharacter.maxHp, initialCharacter.maxHp, [], initialCharacter.bag);
        const eon = eonData.find(eon => eon.name === eonName);
        if (eon) {
            this.initialCharacter = initialCharacter;
            this.stats = initialCharacter.stats;
            this.element = eon.element;
            this.skills = eon.skills;
        } else {
            throw new Error("Impossible d'invoquer cet éon");
        }
    }

    /** Eons cannot use simple attack */
    attack(target: Unit, roll: number, critRoll: number | 0, bonus: number | 0): string[] {
        throw new Error("Method not implemented.");
    }
    /** Eons cannot use spells */
    useSpellFromName(spellName: string, target: Unit, roll: number, critRoll: number): string[] {
        throw new Error("Method not implemented.");
    }

    useAbility(skillName: string, allUnits: Unit[]): string[] {
        let resultArray: string[] = [];
        let damage = 0;
        const skill: EonSkill = this.skills.find(skill => skill.name === skillName) as EonSkill;

        const targets = getValidTargets(this, skill, allUnits);
        for(let target of targets){  
            const damageMultiplier = calculateDamageMultiplier(this,this.element,target)
  
            // Particular skill
            if (skill.formula) {
                const context = {
                    user: this,
                    target: target,
                    allUnits: allUnits
                };
                const safeFormula = skill.formula.replace(/this\./g, "context.user.").replace(/target\./g, "context.target.").replace(/allUnits\./g, "context.allUnits.");
                try {
                    eval(safeFormula);
                } catch (error) {
                    resultArray.push("Erreur lors de l'exécution de la formule: " + error);
                    console.error("Erreur lors de l'exécution de la formule: ", error);
                }
            }
            // Offensive skill 
            else if (skill.power) {
                damage = (Math.pow(this.stats.intelligence+skill.power, 2) / 2) * damageMultiplier;
                resultArray.push(messageDamageMultiplier(damageMultiplier));
                damage = Math.round(damage);
                resultArray.push(`${target.name} perd ${damage}PV`);
            } else {
                //no skillpower and empty formula
                throw new Error("Eon:useAbility No skill.power and empty formula for skill:"+skillName);
            } 
            target.currentHp = Math.max(target.currentHp - damage, 0);
        }
        this.currentTransePoint = Math.max(this.currentTransePoint - skill.tp,0);
        if(this.currentTransePoint === 0){
            //TODO: end invocation
            
        }
        return resultArray;
    }

    /** Eons cannot use items */
    useItem(item: Item, target: Unit): string[] {
        throw new Error("Method not implemented.");
    }

}