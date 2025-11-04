import { Job } from "./Job";
import { Statistics } from "../Types";
import { Scepter } from "../Items/Weapon";

export class RedMage extends Job {
    constructor() {
        super(
            "Mage Rouge",
            "Classe équilibrée qui allie magies offensives et défensives",
            ['epee', 'katana', 'masse', 'sceptre'],
            [new Scepter("RM_startBatonDeMage", "Bâton de mage", "Un bâton simple mais puissant, taillé dans le bois de l'arbre ancestral. Il canalise la magie comme un lien entre le mage et les arcanes.", 200, 1, 2, "")],
            10,
            [],
            [
                { level: 1, spell: "Brasier" },
                { level: 5, spell: "Glacier" },
                { level: 5, spell: "Soin" },
                { level: 7, spell: "Foudre" },
                { level: 10, spell: "Brasier +" },
                { level: 12, spell: "Glacier +" },
                { level: 12, spell: "Barrière" },
                { level: 15, spell: "Lumen" },
                { level: 15, spell: "Foudre +" },
                { level: 18, spell: "Grâce" }
            ],
            [
                {
                    name: "Sage Rouge",
                    requirements: {
                        level: 20
                    },
                    specialAbility: "Dual Cast : Peut lancer deux sorts par tour",
                    bonuses: {
                        strength: 1,
                        dexterity: 1,
                        endurance: 0,
                        mana: 1,
                        intelligence: 1,
                        perception: 0,
                        charisma: 1
                    },
                    skills: [],
                    spells: [
                        { level: 20, spell: "Soin +" },
                        { level: 20, spell: "Combustion" },
                        { level: 21, spell: "Lumen +" },
                        { level: 21, spell: "Fulguration" },
                        { level: 24, spell: "Grâce +" },
                        { level: 24, spell: "Congélation" },
                        { level: 26, spell: "Vie" },
                        { level: 26, spell: "Lumen X" },
                        { level: 28, spell: "Renvoi" },
                        { level: 28, spell: "Rocher" },
                        { level: 28, spell: "Air +" },
                        { level: 30, spell: "Grâce X" },
                        { level: 30, spell: "Aérolithe" }
                    ]
                },
                {
                    name: "Samouraï",
                    requirements: {
                        level: 20
                    },
                    specialAbility: "Bushido : permet d\’utiliser des combos de compétences",
                    bonuses: {
                        strength: 1,
                        dexterity: 3,
                        endurance: 0,
                        mana: 0,
                        intelligence: 0,
                        perception: 0,
                        charisma: 0
                    },
                    skills: [
                        {
                            level: 20, skill:
                            {
                                name: "Hissatsu : Gyôten",
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
                                name: "Hissatsu : Yaten",
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
                                name: "Hissatsu : Shinten",
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
                            level: 26, skill: //TODO Ninja lvl26 : Trouver comment faire nbToolsCap++ au niveau 26
                            {
                                name: "Hissatsu : Kyûten",
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
                            level: 28, skill:
                            {
                                name: "Hissatsu : Guren",
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
                        },
                        {
                            level: 30, skill:
                            {
                                name: "Zeninage",
                                formula: `this.attack(target, 2, 0, 6, resultArray);`,
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
    }

    protected initStats(): Statistics {
        return {
            strength: 1,
            dexterity: 1,
            endurance: 1,
            intelligence: 2,
            mana: 1,
            perception: 2,
            charisma: 0
        }
    }
}
