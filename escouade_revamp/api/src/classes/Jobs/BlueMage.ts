import { Job } from "./Job";
import { Statistics } from "../Types";
import { Monster } from "../UnitTypes/Monster";
import { Character } from "../UnitTypes/Character";
import spellData from '../../config/spells_data.json'; // Charger le fichier JSON
import skillData from '../../config/blueMage_skills_data.json'; // Charger le fichier JSON
import { Monstronomicon } from "../Items/Monstronomicon";
import { IdGenerator } from "../../utils/IdGeneratorUtils";
import { Unit } from "../UnitTypes/Unit";


export class BlueMage extends Job {
    monstronomicon = new Monstronomicon("BM_Monstronomicon_" + IdGenerator.generateId());
    private _trancePoints?: number;

    constructor() {
        super(
            "Mage Bleu",
            "Classe qui apprend les compéteces et sorts de ses ennemis",
            ['epee', 'lance', 'dague', 'sceptre'],
            [],
            10,
            [
                {
                    level: 1, skill: {
                        name: "Scan",
                        formula: "this.job.scan(target, resultArray);", //Ajoute le monstre au monstronomicon
                        target: 'enemy',
                        type: "single",
                        range: 0,
                        apCost: 1,
                        mpCost: 0,
                        hpCost: 0,
                        roll: 0,
                        status: [],
                        element: "",
                        description: "étudie son adversaire",
                        move: 0
                    }
                },
                {
                    level: 1, skill: {
                        name: "Apprendre",
                        formula: "resultArray.push(this.job.learnFrom(target));", //Apprendre une monsterAttack
                        target: 'enemy',
                        type: "single",
                        range: 0,
                        apCost: 1,
                        mpCost: 0,
                        hpCost: 0,
                        roll: 0,
                        status: [],
                        element: "",
                        description: "étudie les mouvements de son adversaire",
                        move: 0
                    }
                }
            ],
            [],
            [
                {
                    name: "Sage Bleu",
                    requirements: {
                        level: 20
                    },
                    specialAbility: "",
                    bonuses: {
                        strength: 1,
                        dexterity: 1,
                        endurance: 1,
                        mana: 1,
                        intelligence: 1,
                        perception: 1,
                        charisma: 1
                    },
                    skills: [],
                    spells: []
                },
                {
                    name: "Invocateur",
                    requirements: {
                        level: 20
                    },
                    specialAbility: "",
                    bonuses: {
                        strength: 0,
                        dexterity: 0,
                        endurance: 0,
                        mana: 2,
                        intelligence: 2,
                        perception: 0,
                        charisma: 0
                    },
                    skills: [],
                    spells: []
                }
            ]
        );
        this.startItems = [this.monstronomicon];
    }

    scan(target: Unit, resultArray: string[]) {
        if (this.monstronomicon.isRegistered(target)) {
            resultArray.push("Déjà étudié !");
        } else {
            if (this.monstronomicon.isScannable(target)) {
                this.monstronomicon.addUnit(target);
                if (target instanceof Monster) resultArray.push(`${target.name} a bien été ajoutée au monstronomicon`);
                if (target instanceof Character) resultArray.push(`La classe "${target.job.name}" a bien été ajoutée au monstronomicon`);
            }
            else {
                resultArray.push(`${target.name} est trop puissant pour être étudié`);
            }
        }
    }

    learnFrom(target: Unit) {
        if (this.monstronomicon.isRegistered(target)) {

            let targetSkills: string[] = [];
            if (target instanceof Monster) {
                targetSkills = target.monsterSkills.map(skill => skill);
            }
            if (target instanceof Character) {
                targetSkills = [...target.getAvailableAbilities().map(skill => skill.name), ...target.getAvailableSpells().map(spell => spell.name)];
            }

            if (targetSkills.length === 0) return `${target.name} n'a aucune attaque à apprendre.`;

            const learnedSkill = targetSkills[Math.floor(Math.random() * targetSkills.length)];

            // Chercher si l'attaque du monstre existe déjà en tant que Spell
            const newSpell: any = spellData.find((spell: { name: string }) => spell.name === learnedSkill);
            if (newSpell) {
                // Si on trouve un sort correspondant, on l'ajoute tel quel
                this.spells.push({ level: this.jobLevel, spell: newSpell.name });
                return `${this.name} a appris le sort ${newSpell.name} !`;
            }

            // Chercher si l'attaque du monstre existe en tant que Skill
            const newSkill: any = skillData.find((skill: { name: string }) => skill.name === learnedSkill);
            if (newSkill) {
                // Si on trouve un skill correspondant, on l'ajoute tel quel
                this.skills.push({ level: this.jobLevel, skill: newSkill });
                return `${this.name} a appris une nouvelle compétence : ${newSkill.name} !`;
            }
            // Si on ne l'a pas trouvé avant c'est parce que c'est un skill de classe
            if (target instanceof Character) {
                const recordLevelSkill = target.job.skills.find((recordLevelSkill) => recordLevelSkill.skill.name === learnedSkill)
                
                // Si on trouve un recordLevelSkill {level,skill} correspondant, on l'ajoute tel quel
                if (recordLevelSkill) {
                    this.skills.push(recordLevelSkill);
                    return `${this.name} a appris une compétence de classe : "${recordLevelSkill.skill.name}" !`;
                }
            }
        } else {
            return `${target.name} doit d'abord être étudié`;
        }
    }

    forget(skillOrSpellName: string) {
        if (skillOrSpellName !== "Scan" && skillOrSpellName !== "Apprendre") {
            let forgetIndex = this.skills.findIndex(recordLevelSkill => recordLevelSkill.skill.name = skillOrSpellName);
            if (forgetIndex == -1) {
                forgetIndex = this.spells.findIndex(recordLevelSpell => recordLevelSpell.spell = skillOrSpellName);
                const newSpellList = this.spells.splice(forgetIndex, 1);
                this.spells = newSpellList;
                return `1... 2... 3... Pouf ! ${this.name} a oublié le sort "${skillOrSpellName}" !`;
            } else {
                const newSkillList = this.skills.splice(forgetIndex, 1);
                this.skills = newSkillList;
                return `1... 2... 3... Pouf ! ${this.name} a oublié la compétence "${skillOrSpellName}" !`;
            }
        }
        return `${this.name} ne peut pas oublier "Scan" ou "Apprentissage"`;
    }

    get trancePoints(): number | undefined{
        return this.name === "Invocateur" ? this._trancePoints : undefined;
    }

    set trancePoints(tp: number){
        this._trancePoints = tp;
    }
    
    pattern(): string[] {
        //scan
        //apprentissage
        //si spell n'est pas vide 
        // spell
        //si skill n'est pas vide
        // skill
        throw new Error("Method not implemented.");
    }

    protected initStats(): Statistics {
        return {
            strength: 1,
            dexterity: 2,
            endurance: 1,
            intelligence: 2,
            mana: 0,
            perception: 2,
            charisma: 0
        }
    }
}
