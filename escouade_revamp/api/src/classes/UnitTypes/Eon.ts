import { Item } from "../Items/Item";
import { EonSkill, Skill } from "../Types";
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
    /** L'Invocateur qui a invoqué cet Eon (null pour un Eon de zone). */
    summoner: Character | null = null;
    /** true quand les points de transe sont épuisés : l'invocation se termine. */
    invocationEnded: boolean = false;
    /**
     * PV de l'Eon au début de son dernier tour. Utilisé par "Prestesse pérenne"
     * pour annuler les dégâts subis depuis le début du tour.
     */
    hpAtTurnStart: number = 0;
    /**
     * Garde-fou pour les compétences multi-cibles qui soignent les alliés
     * (ex. "Feu résurrecteur") : le soin n'est appliqué qu'une fois par usage,
     * même si la formule est évaluée pour chaque cible.
     */
    healAppliedThisUse: boolean = false;

    constructor(initialCharacter: Character, eonName: string) {
        super(initialCharacter.id, initialCharacter.name+"/"+eonName, initialCharacter.type, initialCharacter.position, initialCharacter.maxHp, initialCharacter.maxHp, [], initialCharacter.bag);
        const eon = eonData.find(eon => eon.name === eonName);
        if (eon) {
            this.initialCharacter = initialCharacter;
            this.stats = initialCharacter.stats;
            this.element = eon.element;
            this.skills = eon.skills;
            this.hpAtTurnStart = initialCharacter.maxHp;
        } else {
            throw new Error("Eon.constructor : Cannot invoke this eon");
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

    useAbilityByName(skillName: string, allUnits: Unit[]): string[] {
        let resultArray: string[] = [];
        let damage = 0;
        this.healAppliedThisUse = false;
        const skill: EonSkill = this.skills.find(skill => skill.name === skillName) as EonSkill;

        const targets = getValidTargets(this, skill, allUnits);
        for(let target of targets){  
            const damageMultiplier = calculateDamageMultiplier(this,this.element,target)
  
            // Particular skill
            if (skill.formula) {
                this.executeFormula(skill, target, allUnits, resultArray);
            }
            // Offensive skill 
            else if (skill.power) {
                damage = (Math.pow(this.stats.intelligence+skill.power, 2) / 2) * damageMultiplier;
                resultArray.push(messageDamageMultiplier(damageMultiplier));
                damage = Math.round(damage);
                resultArray.push(`${target.name} perd ${damage}PV`);
            } else {
                //no skillpower and empty formula
                throw new Error("Eon:useAbility : No skill.power and empty formula for skill:"+skillName);
            } 
            // Applique les dégâts une seule fois (respecte le blocage éventuel de la cible)
            target.applyDamage(damage, resultArray);
        }
        this.currentTransePoint = Math.max(this.currentTransePoint - skill.tp,0);
        if(this.currentTransePoint === 0 && !this.invocationEnded){
            this.invocationEnded = true;
            resultArray.push(`${this.name} retourne auprès de son invocateur.`);
        }
        return resultArray;
    }

    /**
     * Un Eon "disparaît" quand ses PV tombent à 0 OU quand son invocation
     * se termine (points de transe épuisés).
     */
    isDead(): boolean {
        return super.isDead() || this.invocationEnded;
    }

    /** Eons cannot use items */
    useItem(item: Item, target: Unit): string[] {
        throw new Error("Method not implemented.");
    }

    /**
     * Surcharge de Unit.executeFormula : les formules des Eons utilisent
     * `damageMultiplier` et `skill` directement, qui ne sont pas exposés par
     * le contexte de base. On les ajoute ici pour que l'eval fonctionne.
     */
    protected executeFormula(skill: Skill | EonSkill, target: Unit, allUnits: Unit[], resultArray: string[]): void {
        const damageMultiplier = calculateDamageMultiplier(this, this.element, target);
        const context = {
            user: this,
            target: target,
            allUnits: allUnits,
            skill: skill,
            damageMultiplier: damageMultiplier
        };

        const safeFormula = skill.formula
            .replace(/this\./g, "context.user.")
            .replace(/target\./g, "context.target.")
            .replace(/allUnits\./g, "context.allUnits.");

        try {
            eval(safeFormula);
        } catch (error) {
            resultArray.push("Erreur lors de l'exécution de la formule: " + error);
            console.error("Erreur lors de l'exécution de la formule: ", error);
        }
    }

}