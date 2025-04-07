import { Statistics, Skill, Spell, Evolution } from "../Types";
import { Item } from "../Items/Item";

export abstract class Job {
    jobLevel: number = 1;
    name: string;
    description: string;
    defaultStats: Statistics;
    specialAbility: string = "";
    weapons: string[];
    startItems: Item[] = [];
    gold: number = 0;
    skills: { level: number; skill: Skill }[] = [];
    spells:  { level: number; spell: string}[] = [];
    evolutions: Evolution[] = [];

    constructor(name: string, description: string, weapons: string[], startItems: Item[] | [], gold: number | 0, skills: { level: number; skill: Skill }[] | [], spells: { level: number; spell: string}[] | [], evolutions: Evolution[] | []) {
        this.name = name;
        this.description = description;
        this.defaultStats = this.initStats();
        this.weapons = weapons;
        this.startItems = startItems;
        this.gold = gold;
        this.skills = skills;
        this.spells = spells;
        this.evolutions = evolutions;
    }

    protected abstract initStats(): Statistics;
    
    /**
     * Renvoie la liste des compétences utilisables en fonction du niveau du lanceur
     * /!\ Ne contient pas la formule de calcul
     * @returns La liste des compétences sans la formule de calcul
     */
    getAvailableAbilities(): Omit<Skill, "formula">[] {
        return this.skills
            .filter(ability => this.jobLevel >= ability.level)
            .map(ability => ability.skill);
    }

    /**
     * Renvoie la liste des sorts utilisables en fonction du niveau du lanceur
     * 
     * @returns La liste des sorts
     */
    getAvailableSpells(): string[] {
        return this.spells
            .filter(spell  => this.jobLevel >= spell.level)
            .map(spell => spell.spell);
    }


};