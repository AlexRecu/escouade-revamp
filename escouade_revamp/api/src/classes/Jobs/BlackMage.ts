import { Job } from "./Job";
import { Statistics } from "../Types";
import { Scepter } from "../Items/Weapon";
import { Demon } from "../UnitTypes/Demon";
import { IdGenerator } from "../../utils/IdGeneratorUtils";

export class BlackMage extends Job {
    pactsLeft = 1;
    demons: Demon[] = [];

    constructor() {
        super(
            "Mage Noir",
            "Classe qui compense sa faible résistance par de la magie de offensive",
            ['dague', 'sceptre'],
            [new Scepter("BlkM_startBatonDeMage_"+IdGenerator.generateId(), "Bâton de mage", "Un bâton simple mais puissant, taillé dans le bois de l'arbre ancestral. Il canalise la magie comme un lien entre le mage et les arcanes.", 200, 1, 2, "")],
            10,
            [],
            [
                { level: 1, spell: "Brasier" },
                { level: 1, spell: "Foudre" },
                { level: 5, spell: "Morphée" },
                { level: 5, spell: "Fièvre" },
                { level: 5, spell: "Air" },
                { level: 7, spell: "Glacier" },
                { level: 7, spell: "Rage" },
                { level: 7, spell: "Tremblement" },
                { level: 10, spell: "Brasier +" },
                { level: 12, spell: "Foudre +" },
                { level: 15, spell: "Glacier +" },
                { level: 18, spell: "Célérité" },
                { level: 18, spell: "Air +" },
            ],
            [
                {
                    name: "Sage Noir",
                    requirements: {
                        level: 20
                    },
                    specialAbility: "Dual Cast : Peut lancer deux sorts par tour",
                    bonuses: {
                        strength: 0,
                        dexterity: 0,
                        endurance: 0,
                        mana: 2,
                        intelligence: 1,
                        perception: 0,
                        charisma: 1
                    },
                    skills: [],
                    spells: [
                        { level: 20, spell: "Brasier X" },
                        { level: 20, spell: "Supplice" },
                        { level: 21, spell: "Renvoi" },
                        { level: 21, spell: "Foudre X" },
                        { level: 24, spell: "Glacier X" },
                        { level: 24, spell: "Mort" },
                        { level: 26, spell: "Fureur" },
                        { level: 28, spell: "Séisme" },
                        { level: 28, spell: "Ouragan" },
                        { level: 30, spell: "Atomnium" }
                    ]
                },
                {
                    name: "Démoniste",
                    requirements: {
                        level: 20
                    },
                    specialAbility: "",
                    bonuses: {
                        strength: 0,
                        dexterity: 0,
                        endurance: 0,
                        mana: 4,
                        intelligence: -1,
                        perception: -1,
                        charisma: 4
                    },
                    skills: [
                        {
                            level: 20, skill: {
                                name: "Pactiser",
                                formula: "this.job.listDemon();", // TODO: Démoniste, va falloir compléter ici à m'en donné
                                target: 'self',
                                type: "single",
                                range: 0,
                                apCost: 0,
                                mpCost: 0,
                                hpCost: 0,
                                roll: 0,
                                status: [],
                                element: "",
                                description: "Appelle un démon sur le terrain",
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
            strength: 0,
            dexterity: 1,
            endurance: 1,
            intelligence: 2,
            mana: 2,
            perception: 2,
            charisma: 0
        }
    }
}
