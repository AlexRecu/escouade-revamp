import { Job } from "./Job";
import { Statistics } from "../Types";
import { Scepter } from "../Items/Weapon";
import { Demon } from "../UnitTypes/Demon";
import { Character } from "../UnitTypes/Character";
import { IdGenerator } from "../../utils/IdGeneratorUtils";
import demonData from "../../config/demons_data.json";

/** Coût en Mana de l'appel d'un démon (cf. livret : "Leur appel coute 4 de Mana") */
export const DEMON_SUMMON_COST = 4;

export class BlackMage extends Job {
    /** Niveaux qui débloquent un pacte (livret : 20, 21, 24, 26, 28, 30). */
    static readonly PACT_LEVELS = [20, 21, 24, 26, 28, 30];
    /** Démons actuellement pactisés (récupérés après avoir été vaincus). */
    recruitedDemons: string[] = [];
    /** Démons invoqués sur le terrain (actifs en combat). */
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
                                formula: "const demons = this.job.listDemon(); resultArray.push('Démons disponibles : ' + demons.join(', '));",
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

    /**
     * Nombre de pactes débloqués : nombre de niveaux de `PACT_LEVELS` atteints.
     * (livret : un nouveau pacte aux niveaux 20, 21, 24, 26, 28, 30)
     */
    get pactSlots(): number {
        return BlackMage.PACT_LEVELS.filter((lvl) => this.jobLevel >= lvl).length;
    }

    /** Nombre de pactes encore libres (slots - démons déjà pactisés). */
    get availablePacts(): number {
        return this.pactSlots - this.recruitedDemons.length;
    }

    /** Le démoniste peut-il encore recruter un démon ? */
    canRecruit(): boolean {
        return this.availablePacts > 0;
    }

    /**
     * Scelle un pacte avec un démon vaincu : l'ajoute à la liste des démons invocables.
     * Consomme un pacte libre.
     *
     * NB : la vérification que le démon a bien été vaincu (et la récupération du pacte)
     * est gérée par la couche zone (Phase B). Ici on gère juste le slot de pacte.
     *
     * @param demonName Nom exact du démon (cf. `demons_data.json`).
     * @returns Les logs de l'opération.
     */
    recruitDemon(demonName: string): string[] {
        const logs: string[] = [];
        const demonDef = demonData.find((d) => d.name === demonName);
        if (!demonDef) {
            throw new Error(`BlackMage.recruitDemon : démon inconnu "${demonName}"`);
        }
        if (this.recruitedDemons.includes(demonName)) {
            logs.push(`${demonName} est déjà pactisé.`);
            return logs;
        }
        if (!this.canRecruit()) {
            throw new Error(`BlackMage.recruitDemon : plus de pacte libre (${this.recruitedDemons.length}/${this.pactSlots})`);
        }
        this.recruitedDemons.push(demonName);
        logs.push(`Pacte scellé avec ${demonName} (${this.recruitedDemons.length}/${this.pactSlots} pactes).`);
        return logs;
    }

    /**
     * Renvoie la liste des démons pactisés (invocables) pour l'interface.
     * Le joueur sélectionne ensuite le démon à invoquer via `summonDemon`.
     * @returns Les noms des démons pactisés
     */
    listDemon(): string[] {
        return [...this.recruitedDemons];
    }

    /**
     * Invoque un démon **pactisé** à la place du démoniste (cf. livret : "amenés sur le
     * terrain à la place de leur démoniste"). Le démon est créé à la position du lanceur,
     * le coût en Mana est déduit, et le démon est ajouté à la liste des démons actifs.
     *
     * Le swap sur la grille (retirer le démoniste, placer le démon) est géré par la couche
     * combat qui reçoit le démon renvoyé.
     *
     * @param demonName Nom exact du démon à invoquer (doit être pactisé, cf. `listDemon`).
     * @param caster Le démoniste qui lance l'appel.
     * @returns Le démon invoqué.
     */
    summonDemon(demonName: string, caster: Character): Demon {
        const demonDef = demonData.find((d) => d.name === demonName);
        if (!demonDef) {
            throw new Error(`BlackMage.summonDemon : démon inconnu "${demonName}"`);
        }
        if (!this.recruitedDemons.includes(demonName)) {
            throw new Error(`BlackMage.summonDemon : ${demonName} n'est pas pactisé`);
        }
        if (caster.currentMp < DEMON_SUMMON_COST) {
            throw new Error(`BlackMage.summonDemon : pas assez de Mana (coût ${DEMON_SUMMON_COST}, restant ${caster.currentMp})`);
        }
        caster.currentMp -= DEMON_SUMMON_COST;
        const demon = new Demon(demonName, "Hero", caster.position);
        this.demons.push(demon);
        return demon;
    }
}
