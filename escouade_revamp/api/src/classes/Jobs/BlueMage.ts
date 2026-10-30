import { Job } from "./Job";
import { Statistics } from "../Types";
import { Monster } from "../UnitTypes/Monster";
import { Character } from "../UnitTypes/Character";
import { Eon } from "../UnitTypes/Eon";
import spellData from '../../config/spells_data.json'; // Charger le fichier JSON
import skillData from '../../config/blueMage_skills_data.json'; // Charger le fichier JSON
import eonData from '../../config/eons_data.json'; // Charger le fichier JSON
import bestiary from '../../config/bestiary_data.json'; // Charger le fichier JSON
import { Monstronomicon } from "../Items/Monstronomicon";
import { IdGenerator } from "../../utils/IdGeneratorUtils";
import { Unit } from "../UnitTypes/Unit";


export class BlueMage extends Job {
    /** Slots d'apprentissage de base (livret : 10). */
    static readonly BASE_LEARN_SLOTS = 10;
    /** Slots d'apprentissage du Sage Bleu (livret : +5, porté à 20 pour un panel large). */
    static readonly SAGE_BLUE_LEARN_SLOTS = 20;
    /** Compétences de base (outils d'apprentissage) — ne comptent pas dans les slots. */
    static readonly BASE_SKILL_NAMES = ["Scan", "Apprendre"];

    monstronomicon = new Monstronomicon("BM_Monstronomicon_" + IdGenerator.generateId());
    private _trancePoints?: number;

    /**
     * Nombre de slots d'apprentissage disponibles. Le Mage bleu a 10 slots de
     * base ; l'évolution **Sage Bleu** les porte à 20 (livret : +5, mais on
     * double pour laisser un panel large — 24 compétences + 73 sorts apprenables).
     */
    get learnSlots(): number {
        return this.evolvedName === "Sage Bleu" ? BlueMage.SAGE_BLUE_LEARN_SLOTS : BlueMage.BASE_LEARN_SLOTS;
    }

    /**
     * Nombre de capacités **apprises** (sorts + compétences, hors "Scan" et
     * "Apprendre" qui sont les outils d'apprentissage, pas des slots).
     */
    get learnedCount(): number {
        const base = new Set(BlueMage.BASE_SKILL_NAMES);
        const learnedSkills = this.skills.filter((s) => !base.has(s.skill.name)).length;
        return learnedSkills + this.spells.length;
    }

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
                this.monstronomicon.addEntry(target.name);
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
                // monsterSkills est déjà un tableau de noms de compétences (string[])
                targetSkills = [...target.monsterSkills];
            }
            if (target instanceof Character) {
                targetSkills = [...target.getAvailableAbilities().map(skill => skill.name), ...target.getAvailableSpells().map(spell => spell.name)];
            }

            if (targetSkills.length === 0) return `${target.name} n'a aucune attaque à apprendre.`;

            const learnedSkill = targetSkills[Math.floor(Math.random() * targetSkills.length)];

            // **Anti-doublon** : si la capacité tirée est déjà connue (sort ou
            // compétence), on ne la rajoute PAS (sinon on accumulerait 3, 4, 10×
            // la même capacité et on gaspillerait des emplacements). La tentative
            // d'apprentissage aboutit quand même (message), mais sans effet.
            const knownSpell = this.spells.some((s) => s.spell === learnedSkill);
            const knownSkill = this.skills.some((s) => s.skill.name === learnedSkill);
            if (knownSpell || knownSkill) {
                const kind = knownSpell ? "le sort" : "la compétence";
                return `${this.name} a tenté de réapprendre ${kind} : ${learnedSkill}`;
            }

            // **Limite de slots** : le Mage bleu a un nombre limité de capacités
            // apprises (10, 20 en Sage Bleu). Quand c'est plein, l'apprentissage
            // échoue — il faut d'abord oublier une capacité (bouton « Oublier »).
            if (this.learnedCount >= this.learnSlots) {
                return `${this.name} n'a plus de slot d'apprentissage (${this.learnedCount}/${this.learnSlots}). Oubliez une capacité pour en apprendre une nouvelle.`;
            }

            // Chercher si l'attaque du monstre existe déjà en tant que Spell
            const newSpell: any = spellData.find((spell: { name: string }) => spell.name === learnedSkill);
            if (newSpell) {
                // Si on trouve un sort correspondant, on l'ajoute tel quel
                this.spells.push({ level: this.jobLevel, spell: newSpell.name });
                this.monstronomicon.markLearned(target.name, learnedSkill);
                return `${this.name} a appris le sort ${newSpell.name} !`;
            }

            // Chercher si l'attaque du monstre existe en tant que Skill
            const newSkill: any = skillData.find((skill: { name: string }) => skill.name === learnedSkill);
            if (newSkill) {
                // Si on trouve un skill correspondant, on l'ajoute tel quel
                this.skills.push({ level: this.jobLevel, skill: newSkill });
                this.monstronomicon.markLearned(target.name, learnedSkill);
                return `${this.name} a appris une nouvelle compétence : ${newSkill.name} !`;
            }
            // Si on ne l'a pas trouvé avant c'est parce que c'est un skill de classe
            if (target instanceof Character) {
                const recordLevelSkill = target.job.skills.find((recordLevelSkill) => recordLevelSkill.skill.name === learnedSkill)
                
                // Si on trouve un recordLevelSkill {level,skill} correspondant, on l'ajoute tel quel
                if (recordLevelSkill) {
                    this.skills.push(recordLevelSkill);
                    this.monstronomicon.markLearned(target.name, learnedSkill);
                    return `${this.name} a appris une compétence de classe : "${recordLevelSkill.skill.name}" !`;
                }
            }
        } else {
            return `${target.name} doit d'abord être étudié`;
        }
    }

    /**
     * Oublie une compétence ou un sort **appris** (retire l'entrée du job).
     * L'entrée du Monstronomicon reste (le monstre est toujours étudié), seule
     * la capacité apprise est retirée — le Mage bleu a un nombre limité de
     * capacités apprises et doit parfois en oublier pour en apprendre d'autres.
     * "Scan" et "Apprendre" (compétences de base) ne peuvent pas être oubliés.
     * @returns un message de log.
     */
    forget(skillOrSpellName: string): string {
        if (skillOrSpellName === "Scan" || skillOrSpellName === "Apprendre") {
            return `${this.name} ne peut pas oublier "Scan" ou "Apprendre".`;
        }
        const skillIndex = this.skills.findIndex((s) => s.skill.name === skillOrSpellName);
        if (skillIndex !== -1) {
            this.skills.splice(skillIndex, 1);
            this.monstronomicon.markUnlearned(skillOrSpellName);
            return `1... 2... 3... Pouf ! ${this.name} a oublié la compétence "${skillOrSpellName}" !`;
        }
        const spellIndex = this.spells.findIndex((s) => s.spell === skillOrSpellName);
        if (spellIndex !== -1) {
            this.spells.splice(spellIndex, 1);
            this.monstronomicon.markUnlearned(skillOrSpellName);
            return `1... 2... 3... Pouf ! ${this.name} a oublié le sort "${skillOrSpellName}" !`;
        }
        return `${this.name} n'a pas appris "${skillOrSpellName}".`;
    }

    /**
     * Données du Monstronomicon pour l'affichage (fiche consultable).
     *
     * Pour chaque monstre/classe **étudié**, dérive les détails du bestiaire
     * (rang, PV par zone, attaques, type) par le nom. Les classes étudiées
     * (pas dans le bestiaire) n'ont que le nom + l'état d'apprentissage.
     */
    getMonstronomiconData(): {
        name: string;
        isLearned: boolean;
        learnedAttack?: string;
        isMonster: boolean;
        rank?: number;
        attackType?: "Physique" | "Magique";
        pvByZone?: number[];
        attacks?: string[];
    }[] {
        return this.monstronomicon.entries.map((e) => {
            const b = (bestiary as any[]).find((m) => m.name === e.name);
            if (b) {
                return {
                    name: e.name,
                    isLearned: e.isLearned,
                    learnedAttack: e.learnedAttack,
                    isMonster: true,
                    rank: b.rank,
                    attackType: b.type === "Magique" ? "Magique" : "Physique",
                    pvByZone: b.pv,
                    attacks: b.attack ?? [],
                };
            }
            // Classe étudiée (pas dans le bestiaire).
            return {
                name: e.name,
                isLearned: e.isLearned,
                learnedAttack: e.learnedAttack,
                isMonster: false,
            };
        });
    }

    get trancePoints(): number | undefined{
        return this.name === "Invocateur" ? this._trancePoints : undefined;
    }

    set trancePoints(tp: number){
        this._trancePoints = tp;
    }

    /** Eon actuellement invoqué sur le terrain (actif en combat). */
    activeEon: Eon | null = null;

    /**
     * Renvoie la liste des Eons invocables (tous les Eons du bestiaire).
     * L'Invocateur peut invoquer n'importe quel Eon (pas de pacte requis,
     * contrairement aux démons). Le joueur sélectionne ensuite l'Eon à
     * invoquer via `summonEon`.
     * @returns Les noms des Eons invocables.
     */
    listEon(): string[] {
        return eonData.map((eon) => eon.name);
    }

    /**
     * Invoque un Eon **à la place de l'Invocateur** (cf. livret : "la créature
     * est possédée par le lanceur"). L'Eon est créé à la position du lanceur,
     * avec les stats de l'invocateur (dégâts basés sur son Intelligence) et
     * 10 points de transe (TP).
     *
     * Mécanique (mode coopératif) : contrairement au démon (autonome), l'Eon
     * est **piloté par le joueur** — il ne peut sélectionner que les actions
     * de l'Eon (via `useAbilityByName`), pas ses sorts/compétences habituels.
     * L'invocation se termine si l'invocateur n'a plus de PV ou de TP.
     *
     * Le swap sur la grille (retirer l'Invocateur, placer l'Eon) est géré par
     * la couche combat qui reçoit l'Eon renvoyé.
     *
     * @param eonName Nom exact de l'Eon à invoquer (cf. `listEon`).
     * @param caster L'Invocateur qui lance l'appel.
     * @returns L'Eon invoqué.
     */
    summonEon(eonName: string, caster: Character): Eon {
        const eonDef = eonData.find((eon) => eon.name === eonName);
        if (!eonDef) {
            throw new Error(`BlueMage.summonEon : Eon inconnu "${eonName}"`);
        }
        const eon = new Eon(caster, eonName);
        this.activeEon = eon;
        return eon;
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
