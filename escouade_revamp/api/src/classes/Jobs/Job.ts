import { Statistics, Skill, Spell, Evolution } from "../Types";
import { Item } from "../Items/Item";

export abstract class Job {
    jobLevel: number = 1;
    name: string;
    /** Nom de base de la classe (jamais muté par l'évolution). Utilisé pour la
     *  désérialisation : `name` devient le nom de l'évolution (ex. "Démoniste"),
     *  mais `baseName` reste "Mage noir". */
    baseName: string;
    description: string;
    defaultStats: Statistics;
    specialAbility: string = "";
    weapons: string[];
    startItems: Item[] = [];
    gold: number = 0;
    skills: { level: number; skill: Skill }[] = [];
    spells:  { level: number; spell: string}[] = [];
    evolutions: Evolution[] = [];
    /** Nom de l'évolution choisie (null si aucune). Bloque la double évolution. */
    evolvedName: string | null = null;

    constructor(name: string, description: string, weapons: string[], startItems: Item[] | [], gold: number | 0, skills: { level: number; skill: Skill }[] | [], spells: { level: number; spell: string}[] | [], evolutions: Evolution[] | []) {
        this.name = name;
        this.baseName = name;
        this.description = description;
        this.defaultStats = this.initStats();
        this.weapons = weapons;
        this.startItems = startItems;
        this.gold = gold;
        this.skills = skills;
        this.spells = spells;
        this.evolutions = evolutions;
    }

    /**
     * Applique l'état d'une évolution (nom, spécialité, compétences, sorts)
     * **sans** les bonus de stats (ceux-ci sont gérés par le personnage et
     * restaurés séparément à la désérialisation).
     *
     * Utilisé par la désérialisation pour restaurer un job déjà évolué (ex. un
     * Démoniste) sans re-jouer la montée de niveau.
     *
     * @param evolutionName le nom de l'évolution (ex. "Démoniste").
     */
    applyEvolutionState(evolutionName: string): void {
        const evolvedJob = this.evolutions.find((form) => form.name === evolutionName);
        if (!evolvedJob) return;
        if (evolvedJob.skills.length !== 0) this.skills.push(...evolvedJob.skills);
        if (evolvedJob.spells.length !== 0) this.spells.push(...evolvedJob.spells);
        this.name = evolvedJob.name;
        this.specialAbility = evolvedJob.specialAbility;
        this.evolvedName = evolvedJob.name;
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