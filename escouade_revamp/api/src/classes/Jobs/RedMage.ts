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
                    skills: [],
                    spells: [
                        { level: 20, spell: "Soin +" },
                        { level: 20, spell: "Combustion" },
                        { level: 21, spell: "Lumen" },
                        { level: 21, spell: "Fulguration" },
                        { level: 24, spell: "Grâce +" },
                        { level: 24, spell: "Congélation" },
                        { level: 26, spell: "Soin X" },
                        { level: 26, spell: "Lumen X" },
                        { level: 28, spell: "Renvoi" },
                        { level: 28, spell: "Rocher" },
                        { level: 28, spell: "Air +" },
                        { level: 30, spell: "Grâce X" },
                        { level: 30, spell: "Aérolithe" }
                    ]
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
