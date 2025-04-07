import { Tools } from "../Items/Tools";
import { Statistics } from "../Types";
import { Job } from "./Job";

export class Thief extends Job {
    private _nbTools?: number = 0;
    private _nbToolsCap?: number = 5;

    constructor() {
        super(
            "Voleur",
            "Classe orientée sur la dextérité et les coups critiques",
            ['dague', 'katana', 'arc'],
            [],
            0,
            [
                {
                    level: 1, skill: {
                        name: "Vol",
                        formula: "if(target.bag.length > 0){ const indexStealItem = Math.floor(Math.random() * target.bag.length);  const objectName =  target.bag[indexStealItem].name; this.bag.push(target.bag[indexStealItem]); target.bag.splice(indexStealItem,1); resultArray.push('Obtenu : '+objectName);} else {resultArray.push('Aucun objet à voler')}",
                        target: 'enemy',
                        type: "single",
                        range: 0,
                        apCost: 1,
                        mpCost: 0,
                        hpCost: 0,
                        roll: 0, //3
                        status: [],
                        element: "",
                        description: "cherche dans le sac de sa victime",
                        move: 0
                    }
                },
                {
                    level: 5, skill: {
                        name: "Pas de l'ombre",
                        formula: "const target = this.getFarthestUnit('Enemy', allUnits);    " +
                            "if (target) {    " +
                            "const teleportPosition = this.findClosestAdjacent(target?.position, allUnits);    " +
                            "if(teleportPosition){   " +
                            "this.position = teleportPosition; " +
                            "resultArray.push(`${this.name} ${skill.description}`)} " +
                            "}",
                        target: 'self',
                        type: "single",
                        range: 0,
                        apCost: 0,
                        mpCost: 1,
                        hpCost: 0,
                        roll: 0,
                        status: [
                            { name: 'Crit+', statusType: 'boon', nbTurnEffect: 2 }
                        ],
                        element: "",
                        description: "disparaît comme une ombre",
                        move: 0
                    }
                },
                {
                    level: 7, skill: {
                        name: "Frappe empoisonnée",
                        formula: `this.attack(target, 3, 1, 0, resultArray);`,
                        target: 'enemy',
                        type: "single",
                        range: 1,
                        apCost: 2,
                        mpCost: 0,
                        hpCost: 0,
                        roll: 0,
                        status: [{ name: 'Poison', statusType: 'curse', nbTurnEffect: 3, chance: 66 }],
                        element: "",
                        description: "imbibe sa lame de poison",
                        move: 0
                    }
                },
                {
                    level: 10, skill: {
                        name: "Vortex",
                        formula: `this.attack(target, 5, 1, -1, resultArray);`,
                        target: 'enemy',
                        type: "multi",
                        range: 2,
                        apCost: 2,
                        mpCost: 0,
                        hpCost: 0,
                        roll: 0,
                        status: [],
                        element: "",
                        description: "tourne sur lui-même pour attaquer les cibles autour",
                        move: 0
                    }
                },
                {
                    level: 12, skill: {
                        name: "Frappe critique",
                        formula: `this.attack(target, 6, 2, -2, resultArray);`,
                        target: 'enemy',
                        type: 'single',
                        range: 1,
                        apCost: 3,
                        mpCost: 0,
                        hpCost: 0,
                        roll: 0,
                        status: [],
                        element: "",
                        description: "réalise une attaque critique sur un ennemi proche",
                        move: 0
                    }
                },
                {
                    level: 15, skill: {
                        name: "Précision mortelle",
                        formula: "",
                        target: 'self',
                        type: "single",
                        range: 0,
                        apCost: 2,
                        mpCost: 0,
                        hpCost: 0,
                        roll: 0,
                        status: [{ name: 'Crit+', statusType: 'boon', nbTurnEffect: 2 }],
                        element: "",
                        description: "aiguise sa lame pour augmenter son taux de coups critiques",
                        move: 0
                    }
                },
                {
                    level: 18, skill: {
                        name: "Volée de coups",
                        formula: `this.attack(target, 6, 1, this.rightHand.weaponStat/2, resultArray);`,
                        target: 'enemy',
                        type: "single",
                        range: 1,
                        apCost: 2,
                        mpCost: 0,
                        hpCost: 0,
                        roll: 0,
                        status: [],
                        element: "",
                        description: "réalise une attaque si rapide qu'on croirait qu'il a deux armes",
                        move: 0
                    }
                }
            ],
            [],
            [
                {
                    name: "Assassin",
                    requirements: {
                        level: 20
                    },
                    specialAbility: `Marcheur des ombres: Le niveau de critique est baissé de 1 en permanence`,
                    bonuses: {
                        strength: 0,
                        dexterity: 0,
                        endurance: 0,
                        mana: 3,
                        intelligence: 3,
                        perception: 0,
                        charisma: 0
                    },
                    skills: [
                        {
                            level: 26, skill:
                            {
                                name: "Invisibilité",
                                formula: "",
                                target: 'self',
                                type: "single",
                                range: 0,
                                apCost: 3,
                                mpCost: 0,
                                hpCost: 0,
                                roll: 0,
                                status: [
                                    { name: 'Crit++', statusType: 'boon', nbTurnEffect: 2 }
                                ],
                                element: "",
                                description: "se rend invisible pour attaquer par surprise",
                                move: 0
                            }
                        },
                        {
                            level: 30, skill:
                            {
                                name: "Assassinat",
                                formula:
                                    "const target = this.getFarthestUnit('Enemy', allUnits);    " +
                                    "if (target) {    " +
                                    "const teleportPosition = this.findClosestAdjacent(target?.position, allUnits);    " +
                                    "if(teleportPosition){   " +
                                    "this.position = teleportPosition; " +
                                    "resultArray.push(`${this.name} ${skill.description}`)" +
                                    "this.attack(target, 6, 3, 0, resultArray);" +
                                    "} " +
                                    "}",
                                target: 'enemy',
                                type: "single",
                                range: 0,
                                apCost: 5,
                                mpCost: 0,
                                hpCost: 0,
                                roll: 0,
                                status: [],
                                element: "",
                                description: "se déplace dans les ombres puis attaque sa cible",
                                move: 0
                            }
                        }
                    ],
                    spells: [
                        {level: 20, spell: "Foudre +"},
                        { level: 21, spell: "Célérité"},
                        { level: 24, spell: "Glacier +"},
                        {level: 28, spell: "Mutisme"}
                    ]
                },
                {
                    name: "Ninja",
                    requirements: {
                        level: 20
                    },
                    specialAbility: "Arsenal Ninja : débloque la possibilité de créer et utiliser les outils",
                    bonuses: {
                        strength: 0,
                        dexterity: 2,
                        endurance: -1,
                        mana: 2,
                        intelligence: 0,
                        perception: 0,
                        charisma: 0
                    },
                    skills: [
                        {
                            level: 20, skill:
                            {
                                name: "Hossha",
                                formula: `this.attack(target, 4, 1, 1, resultArray); target.moveAwayFrom(this.position, 1, allUnits);`,
                                target: 'enemy',
                                type: "single",
                                range: 1,
                                apCost: 2,
                                mpCost: 0,
                                hpCost: 0,
                                roll: 0,
                                status: [],
                                element: "Glace",
                                description: "frappe l\’ennemi avec la peur de la mort, celui-ci recule",
                                move: 0
                            }
                        },
                        {
                            level: 21, skill:
                            {
                                name: "Ichijin",
                                formula: `this.moveTowards(target.position, 1, allUnits); resultArray.push(this.name+" plonge en avant vers sa cible"); const distance = Math.max(Math.abs(target.position.row - this.position.row), Math.abs(target.position.col - this.position.col); if(distance <= skill.range){ this.attack(target,5,1,1, resultArray); }else{ resultArray.push("Sa cible est trop éloignée ..."); }`,
                                target: 'enemy',
                                type: "single",
                                range: 1,
                                apCost: 2,
                                mpCost: 0,
                                hpCost: 0,
                                roll: 0,
                                status: [],
                                element: "",
                                description: "plonge en avant d\’une case pour attaquer l\’adversaire",
                                move: 1
                            }
                        },
                        {
                            level: 24, skill:
                            {
                                name: "Shousen",
                                formula: `this.attack(target,5,1,2, resultArray);`,
                                target: 'enemy',
                                type: "single",
                                range: 0,
                                apCost: 2,
                                mpCost: 0,
                                hpCost: 0,
                                roll: 0,
                                status: [],
                                element: "Glace",
                                description: "le froid de la mort s\’empare de sa lame",
                                move: 0
                            }
                        },
                        {
                            level: 28, skill: //TODO Ninja lvl26 : Trouver comment faire nbToolsCap++ au niveau 26
                            {
                                name: "Jubaku",
                                formula: ``,
                                target: 'enemy',
                                type: "multi",
                                range: 0,
                                apCost: 2,
                                mpCost: 0,
                                hpCost: 0,
                                roll: 0,
                                status: [
                                    {
                                        name: "Faiblesse",
                                        statusType: "curse",
                                        nbTurnEffect: 3,
                                        description: "Permet d'exploiter le point faible de l'adversaire"
                                    }
                                ],
                                element: "",
                                description: "applique le statut Faiblesse sur l'ennemi",
                                move: 0
                            }
                        },
                        {
                            level: 30, skill:
                            {
                                name: "Frappe fatale",
                                formula: `this.attack(target, 6, 2, 6, resultArray);`,
                                target: 'enemy',
                                type: "single",
                                range: 1,
                                apCost: 0,
                                mpCost: 0,
                                hpCost: 2,
                                roll: 0,
                                status: [],
                                element: "",
                                description: "une frappe critique instantanée",
                                move: 0
                            }
                        }
                    ],
                    spells: []
                }
            ]
        );
    };

    protected initStats(): Statistics {
        return {
            strength: 0,
            dexterity: 2,
            endurance: 1,
            intelligence: 0,
            mana: 1,
            perception: 3,
            charisma: 1
        }
    };

    get nbTools(): number | undefined{
        return this.name === "Ninja"? this._nbTools : undefined;
    }

    set nbTools(nbTools: number){
        this._nbTools = nbTools;
    }

    get nbToolsCap(): number | undefined{
        return this.name === "Ninja"? this._nbToolsCap : undefined;
    }

    craftTool(toolName: "Doton" | "Katon" | "Raiton" | "Hyuton" | "Futon" | "Bunshin" | "Shuriken Fuma"): string{
        if(this.nbTools && this.nbToolsCap && this.nbTools < this.nbToolsCap){
            Tools.craft(toolName); // TODO tools.craft(): Tools à mettre dans l'Inventory de la Party de Character ref=PartyId et save dans Mongo?
            this.nbTools++;
            return `Nouvel outil ninja créé : ${toolName}`;
        }else{
            return `Impossible de créer cet outil ninja : ${toolName}`;
        }
    }
}
