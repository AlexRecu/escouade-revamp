import { Character } from "../UnitTypes/Character";
import { Skill, Statistics } from "../Types";
import { Unit } from "../UnitTypes/Unit";
import { Job } from "./Job";

export class Monk extends Job {
    constructor() {
        super(
            "Moine",
            "Classe orientée sur la force pure",
            ['poing', 'masse', 'marteau'],
            [],
            0,
            [
                {
                    level: 1, skill: {
                        name: "Concentration",
                        formula: "target.currentMp = Math.min(target.currentMp+3,target.maxMp); resultArray.push('Il médite pour créer des particules de magie');",
                        target: 'ally',
                        type: "single",
                        range: 0,
                        apCost: 3,
                        mpCost: 0,
                        hpCost: 0,
                        roll: 0,
                        status: [],
                        element: "",
                        description: "médite pour créer des particules de magie",
                        move: 0
                    }
                },
                {
                    level: 5, skill: {
                        name: "Frappe Chi",
                        formula: `this.attack(target,4,1,this.maxMp, resultArray);`,
                        target: 'enemy',
                        type: "single",
                        range: 1,
                        apCost: 0,
                        mpCost: 2,
                        hpCost: 0,
                        roll: 0,
                        status: [],
                        element: "",
                        description: "concentre son Chi pour frapper",
                        move: 0
                    }
                },
                {
                    level: 7, skill: {
                        name: "Mantra",
                        formula: "this.currentHp += this.stats.endurance;",
                        target: 'self',
                        type: "single",
                        range: 0,
                        apCost: 0,
                        mpCost: 1,
                        hpCost: 0,
                        roll: 0,
                        status: [],
                        element: "",
                        description: "répète son mantra pour aguiser sa volonté",
                        move: 0
                    }
                },
                {
                    level: 10, skill: {
                        name: "Pied du Buddha",
                        formula: `this.attack(target, 6, 1, 0, resultArray);`,
                        target: 'enemy',
                        type: "single",
                        range: 2,
                        apCost: 2,
                        mpCost: 0,
                        hpCost: 0,
                        roll: 0,
                        status: [],
                        element: "",
                        description: "concentre son Chi dans son pied",
                        move: 0
                    }
                },
                {
                    level: 12, skill: {
                        name: "Frappe karmique",
                        formula: `this.attack(target, 5, 1, (this.maxHp - this.currentHp)+1, resultArray);`,
                        target: 'enemy',
                        type: 'single',
                        range: 1,
                        apCost: 3,
                        mpCost: 0,
                        hpCost: 0,
                        roll: 0,
                        status: [],
                        element: "",
                        description: "prépare un retour de karma",
                        move: 0
                    }
                },
                {
                    level: 15, skill: {
                        name: "Ruée de coups",
                        formula: `this.attack(target, 5, 1, 1, resultArray); if(!target.isDead()){this.attack( target, 5, 1, 1, resultArray);}`,
                        target: 'enemy',
                        type: "single",
                        range: 1,
                        apCost: 4,
                        mpCost: 0,
                        hpCost: 0,
                        roll: 0,
                        status: [],
                        element: "",
                        description: "prépare une série d'attaques",
                        move: 0
                    }
                },
                {
                    level: 18, skill: {
                        name: "Chakra",
                        formula: "",
                        target: 'ally',
                        type: "single",
                        range: 0,
                        apCost: 0,
                        mpCost: 1,
                        hpCost: 0,
                        roll: 0,
                        status: [{ name: "Dissipation", nbTurnEffect: 0 }],
                        element: "",
                        description: "libère les centres spirituels",
                        move: 0
                    }
                }
            ],
            [],
            [
                {
                    name: "Maître",
                    requirements: {
                        level: 20
                    },
                    specialAbility: "Pied véloce : son déplacement en combat est multiplié par sa dextérité", //TODO Pied Véloce: revoir les déplacements pour les baser sur un multiplicateur de 1 pour chaque classe sauf si redéfinit
                    bonuses: {
                        strength: 2,
                        dexterity: 1,
                        endurance: 0,
                        mana: 0,
                        intelligence: 0,
                        perception: 0,
                        charisma: 2
                    },
                    skills: [
                        {
                            level: 20, skill:
                            {
                                name: "Double uppercuts",
                                formula: `this.attack(5,1,this.rightHand.weaponStat, resultArray);`,
                                target: 'enemy',
                                type: "single",
                                range: 1,
                                apCost: 1,
                                mpCost: 1,
                                hpCost: 0,
                                roll: 0,
                                status: [],
                                element: "",
                                description: "enchaîne les coups de poings explosifs",
                                move: 0
                            }
                        },
                        {
                            level: 21, skill:
                            {
                                name: "Poings d'acier",
                                formula: ``,
                                target: 'self',
                                type: "single",
                                range: 0,
                                apCost: 1,
                                mpCost: 1,
                                hpCost: 0,
                                roll: 0,
                                status: [
                                    {
                                        name: "Poings d'acier",
                                        description: "durcit ses poings pour augmenter ses dégats",
                                        nbTurnEffect: 2
                                    }
                                ],
                                element: "",
                                description: "durcit ses poings pour augmenter ses dégats",
                                move: 0
                            }
                        },
                        {
                            level: 24, skill:
                            {
                                name: "Moulin",
                                formula: `this.attack(4,1,this.stats.dexterity, resultArray);`,
                                target: 'enemy',
                                type: "multi",
                                range: 2,
                                apCost: 2,
                                mpCost: 1,
                                hpCost: 0,
                                roll: 0,
                                status: [],
                                element: "Vent",
                                description: "envoie des rafales de coups de poings tournoyant sur les ennemis",
                                move: 0
                            }
                        },
                        {
                            level: 26, skill:
                            {
                                name: "Voie du guerrier",
                                formula: ``,
                                target: 'self',
                                type: "single",
                                range: 0,
                                apCost: 0,
                                mpCost: 2,
                                hpCost: 0,
                                roll: 0,
                                status: [
                                    { name: 'Crit++', statusType: 'boon', nbTurnEffect: 2 }
                                ],
                                element: "",
                                description: "augmente son taux de coups critiques",
                                move: 0
                            }
                        },
                        {
                            level: 28, skill:
                            {
                                name: "Frappe Xiang-Si",
                                formula: `this.attack(4, 1, Math.round(Math.random * 6)+1) + this.rightHand.weaponStat)`,
                                target: 'enemy',
                                type: "multi",
                                range: 1,
                                apCost: 5,
                                mpCost: 2,
                                hpCost: 0,
                                roll: 0,
                                status: [],
                                element: "Foudre",
                                description: "une série de frappes dont le bruit imite celui du tonnerre",
                                move: 0
                            }
                        },
                        {
                            level: 30, skill:
                            {
                                name: "Poing du dragon",
                                formula: `this.attack(6, 2, this.stats.strength + this.stats.dexterity)`,
                                target: 'self',
                                type: "single",
                                range: 0,
                                apCost: 10,
                                mpCost: 5,
                                hpCost: 0,
                                roll: 0,
                                status: [],
                                element: "",
                                description: "un coup de poing écrasant au pouvoir dévastateur",
                                move: 0
                            }
                        },
                    ],
                    spells: []
                },
                {
                    name: "Hermite",
                    requirements: {
                        level: 20
                    },
                    specialAbility: "Sennin : Récupère 1 PM à chaque tour",
                    bonuses: {
                        strength: 1,
                        dexterity: 0,
                        endurance: 0,
                        mana: 2,
                        intelligence: 1,
                        perception: 0,
                        charisma: 0
                    },
                    skills: [
                        {
                            level: 20, skill:
                            {
                                name: "Contrôle mental",
                                formula: `target.moveTowards(this.position, this.stats.intelligence, allUnits); const distance = Math.max(Math.abs(target.position.row - this.position.row), Math.abs(target.position.col - this.position.col); if(distance <= skill.range){ this.attack(target, 5, 1, 1, resultArray); }else{ resultArray.push(target.name+" est contraint de s'approcher")}`,
                                target: 'enemy',
                                type: "single",
                                range: 0,
                                apCost: 0,
                                mpCost: 2,
                                hpCost: 0,
                                roll: 0,
                                status: [],
                                element: "",
                                description: "oblige la cible à s'approcher en fonction de votre intelligence.",
                                move: 0
                            }
                        },
                        {
                            level: 24, skill:
                            {
                                name: "Frappe handicap",
                                element: "",
                                description: "un coup qui retire un bonus de statut de la cible",
                                formula: "this.attack(target, 5, 1, 0, resultArray);",
                                target: "enemy",
                                range: 1,
                                type: "single",
                                status: [
                                    {
                                        name: "Dissipation",
                                        statusType: "curse",
                                        nbTurnEffect: null
                                    }
                                ],
                                apCost: 3,
                                mpCost: 0,
                                hpCost: 0,
                                roll: 0,
                                move: 0
                            }
                        },
                        {
                            level: 26, skill:
                            {
                                name: "Voie de la faiblesse",
                                element: "",
                                formula: "target.moveAwayFrom(this.position, this.stats.intelligence, allUnits)",
                                target: "enemy",
                                range: 0,
                                type: "multi",
                                apCost: 2,
                                mpCost: 0,
                                hpCost: 0,
                                roll: 0,
                                status: [
                                    {
                                        name: "Mutisme",
                                        statusType: "curse",
                                        nbTurnEffect: null
                                    }
                                ],
                                move: 0,
                                description: "oblige tous les ennemis à s'éloigner et leur inflige mutisme"
                            }
                        },
                        {
                            level: 30, skill:
                            {
                                name: "Agravement",
                                formula: `this.attack(5, 1, 1 + target.status.filter(statut => statut.statusType !== 'boon').length, resultArray)`,
                                target: 'enemy',
                                type: "single",
                                range: 1,
                                apCost: 2,
                                mpCost: 2,
                                hpCost: 0,
                                roll: 0,
                                status: [],
                                element: "",
                                description: "inflige des dégats augmentés en fonction des malus sur la cible.",
                                move: 0
                            }
                        }
                    ],
                    spells: [
                        { level: 21, spell: "Morphée" },
                        { level: 28, spell: "Toxine" }
                    ]
                }
            ]
        );
    };

    protected initStats(): Statistics {
        return {
            strength: 4,
            dexterity: 1,
            endurance: 2,
            intelligence: 0,
            mana: 1,
            perception: 0,
            charisma: 0
        }
    };
}
