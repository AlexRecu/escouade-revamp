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
                    specialAbility: "Bushido : permet d'enchaîner plusieurs compétences d'AP (Hissatsu)",
                    bonuses: {
                        strength: 1,
                        dexterity: 3,
                        endurance: 0,
                        mana: 0,
                        intelligence: 0,
                        perception: 0,
                        charisma: 0
                    },
                    apBonus: 2,
                    skills: [
                        {
                            level: 20, skill: {
                                name: "Gyôten",
                                formula: "const pos = this.findClosestAdjacent(target.position, allUnits); if (pos) { this.position = pos; } this.attack(target, 6, 1, 0, resultArray);",
                                target: 'enemy',
                                type: "single",
                                move: 0,
                                range: 8,
                                apCost: 1,
                                mpCost: 0,
                                hpCost: 0,
                                roll: 0,
                                status: [],
                                element: "",
                                description: "Se rapproche instantanément d'un ennemi pour l'attaquer"
                            }
                        },
                        {
                            level: 21, skill: {
                                name: "Yaten",
                                formula: "this.attack(target, 6, 1, 0, resultArray); this.moveAwayFrom(target.position, 1, allUnits);",
                                target: 'enemy',
                                type: "single",
                                move: 0,
                                range: 1,
                                apCost: 1,
                                mpCost: 0,
                                hpCost: 0,
                                roll: 0,
                                status: [],
                                element: "",
                                description: "Frappe puis s'éloigne d'une case d'un ennemi"
                            }
                        },
                        {
                            level: 24, skill: {
                                name: "Shinten",
                                formula: "this.attack(target, 6, 2, this.stats.strength, resultArray);",
                                target: 'enemy',
                                type: "single",
                                move: 0,
                                range: 1,
                                apCost: 1,
                                mpCost: 0,
                                hpCost: 0,
                                roll: 0,
                                status: [],
                                element: "",
                                description: "Attaque puissante sur la cible"
                            }
                        },
                        {
                            level: 26, skill: {
                                name: "Kyûten",
                                formula: "this.attack(target, 6, 1, 0, resultArray);",
                                target: 'enemy',
                                type: "multi",
                                move: 0,
                                range: 2,
                                apCost: 1,
                                mpCost: 0,
                                hpCost: 0,
                                roll: 0,
                                status: [],
                                element: "",
                                description: "Attaque circulaire touchant tous les ennemis autour de 2 cases"
                            }
                        },
                        {
                            level: 28, skill: {
                                name: "Guren",
                                formula: "this.attack(target, 6, 1, 0, resultArray);",
                                target: 'enemy',
                                type: "multi",
                                move: 0,
                                range: 5,
                                apCost: 1,
                                mpCost: 0,
                                hpCost: 0,
                                roll: 0,
                                status: [],
                                element: "",
                                description: "Attaque en ligne droite sur 5 cases"
                            }
                        },
                        {
                            level: 30, skill: {
                                name: "Zeninage",
                                formula: "const wager = this.gold; this.gold = 0; const damage = Math.round(wager * 0.0001 * target.maxHp); const actual = target.applyDamage(damage, resultArray); resultArray.push(this.name + ' mise ' + wager + ' or en jeu. ' + target.name + ' perd ' + actual + 'PV');",
                                target: 'enemy',
                                type: "single",
                                move: 0,
                                range: 1,
                                apCost: 1,
                                mpCost: 0,
                                hpCost: 0,
                                roll: 0,
                                status: [],
                                element: "",
                                description: "Sacrifie son or : dégâts = or mis en jeu × 0,01% des PV de l'adversaire"
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
