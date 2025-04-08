import { Job } from "./Job";
import { Statistics } from "../Types";
import { Sword } from "../Items/Weapon";
import { IdGenerator } from "../../utils/IdGeneratorUtils";

export class Warrior extends Job {
    demonToken: number = 0;

    constructor() {
        super(
            "Guerrier",
            "Classe équilibrée pour les combats longs, il peut défendre ses alliés",
            ['epee', 'katana', 'lance', 'marteau', 'masse'],
            [new Sword("W_startEpeeDeFer"+IdGenerator.generateId(), "Épée en fer", "Une lame robuste en fer, usée par d'innombrables batailles. Elle incarne la simplicité et la résilience des guerriers endurcis.", 200, 1, 2, "")],
            50,
            [
                {
                    level: 1, skill:
                    {
                        name: "Bouclier impénétrable",
                        formula: "this.currentHp += 3; resultArray.push('Il lève son bouclier pour se protéger lui et ses alliés pendant 3 tours');",
                        target: 'self',
                        type: "single",
                        range: 0,
                        apCost: 1,
                        mpCost: 0,
                        hpCost: 0,
                        roll: 0,
                        status: [{ name: 'Bouclier Impénétrable', statusType: 'boon', nbTurnEffect: 3 }],
                        element: "",
                        description: "lève son bouclier pour se protéger lui et ses alliés pendant 3 tours",
                        move: 0
                    }
                },
                {
                    level: 5, skill:
                    {
                        name: "Cri de guerre",
                        formula: "resultArray.push(`Il devient le centre d\'attention des ennemis pendant 5 tours`);",
                        target: 'self',
                        type: "single",
                        range: 0,
                        apCost: 1,
                        mpCost: 0,
                        hpCost: 0,
                        roll: 0,
                        status: [{ name: 'Provoque', statusType: 'curse', nbTurnEffect: 5 }],
                        element: "",
                        description: "devient le centre d'attention des ennemis pendant 5 tours",
                        move: 0
                    }
                },
                {
                    level: 7, skill:
                    {
                        name: "Percée",
                        formula: `this.attack(target,5,1,this.rightHand.weaponStat-2, resultArray);`,
                        target: 'enemy',
                        type: "single",
                        range: 1,
                        apCost: 2,
                        mpCost: 0,
                        hpCost: 0,
                        roll: 0,
                        status: [],
                        element: "",
                        description: "effectue une attaque perçante",
                        move: 0
                    }
                },
                {
                    level: 10, skill:
                    {
                        name: "Allonge",
                        formula: `this.attack(target, 5, 1, 0, resultArray);`,
                        target: 'enemy',
                        type: "single",
                        range: 2,
                        apCost: 0,
                        mpCost: 0,
                        hpCost: 0,
                        roll: 0,
                        status: [],
                        element: "",
                        description: "frappe à distance",
                        move: 0
                    }
                },
                {
                    level: 12, skill:
                    {
                        name: "Frappe tournoyante",
                        formula: `this.attack(target, 5 , 1, -2, resultArray);`,
                        target: 'enemy',
                        type: 'multi',
                        range: 2,
                        apCost: 2,
                        mpCost: 0,
                        hpCost: 0,
                        roll: 0,
                        status: [],
                        element: "",
                        description: "réalise une attaque circulaire autour de lui",
                        move: 0
                    }
                },
                {
                    level: 15, skill:
                    {
                        name: "Rétribution",
                        formula: `this.attack(target, 5, 1, this.stats.endurance, resultArray);`,
                        target: 'enemy',
                        type: "single",
                        range: 0,
                        apCost: 3,
                        mpCost: 0,
                        hpCost: 0,
                        roll: 0,
                        status: [],
                        element: "",
                        description: "utilise sa vitalité pour frapper",
                        move: 0
                    }
                },
                {
                    level: 18, skill:
                    {
                        name: "Frappe mystique",
                        formula: `this.attack(target, 5, 1, this.stats.mana + 2, resultArray);`,
                        target: 'enemy',
                        type: "single",
                        range: 0,
                        apCost: 3,
                        mpCost: 2,
                        hpCost: 0,
                        roll: 0,
                        status: [],
                        element: "Sacré",
                        description: "utilise sa magie latente pour frapper",
                        move: 0
                    }
                }
            ],
            [],
            [
                {
                    name: "Paladin",
                    requirements: {
                        level: 20
                    },
                    specialAbility: `Protection divine : Double les rolls de protection sous le statut "Bouclier impénétrable"`,
                    bonuses: {
                        strength: 0,
                        dexterity: 0,
                        endurance: 3,
                        mana: 2,
                        intelligence: 0,
                        perception: 0,
                        charisma: 0
                    },
                    skills: [],
                    spells: [
                        { level: 20, spell: "Soin +" },
                        { level: 21, spell: "Lumen" },
                        { level: 24, spell: "Barrière" },
                        { level: 26, spell: "Grâce +" },
                        { level: 28, spell: "Lumen +" },
                        { level: 30, spell: "Esuna" }
                    ]
                },
                {
                    name: "Chevalier Noir",
                    requirements: {
                        level: 20
                    },
                    specialAbility: "Double Armement: Permet de s'équiper d'une arme en main gauche",
                    bonuses: {
                        strength: 2,
                        dexterity: 2,
                        endurance: 0,
                        mana: 2,
                        intelligence: 0,
                        perception: 0,
                        charisma: 0
                    },
                    skills: [
                        {
                            level: 21, skill:
                            {
                                name: "Marque du démon",
                                formula: `this.job.demonToken += 2; resultArray.push("Sa frénésie augmente !");`,
                                target: 'self',
                                type: "single",
                                range: 0,
                                apCost: 0,
                                mpCost: 0,
                                hpCost: 2,
                                roll: 0,
                                status: [],
                                element: "",
                                description: "pactise avec les démons pour augmenter sa force.",
                                move: 0
                            }
                        },
                    ],
                    spells: [
                        { level: 24, spell: "Saignée" },
                        { level: 26, spell: "Rage" },
                        { level: 28, spell: "Ténèbres" },
                        { level: 30, spell: "Fureur" }
                    ]
                }
            ]
        );
    }

    protected initStats(): Statistics {
        return {
            strength: 2,
            dexterity: 1,
            endurance: 3,
            intelligence: 0,
            mana: 0,
            perception: 1,
            charisma: 1
        }
    }
}
