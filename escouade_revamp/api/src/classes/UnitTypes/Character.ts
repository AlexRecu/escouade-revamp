import { Job } from "../Jobs/Job";
import { Evolution, Position, Skill, Spell, Statistics } from "../Types";
import { Status } from "../Status";
import { Unit } from "./Unit";
import { Weapon } from "../Items/Weapon";
import { Item } from "../Items/Item";
import spellData from '../../config/spells_data.json'; // Charger le fichier JSON
import { Consumable } from "../Items/Consumable";
import { Tools } from "../Items/Tools";
import { Thief } from "../Jobs/Thief";
import { calculateDamageMultiplier, messageDamageMultiplier } from "../../utils/DamageUtils";
import { applyStatus } from "../../utils/StatusUtils";

export class Character extends Unit {
    characterLevel: number = 1;
    currentMp: number;
    maxMp: number;
    currentAp: number;
    maxAp: number;
    job: Job;
    stats: Statistics;
    protected rightHand: Weapon | null;
    protected leftHand: Weapon | null;
    private spellsMap: Map<string, Spell> = new Map();

    constructor(id: string, name: string, type: 'Hero' | 'Enemy', position: Position, classe: Job, rightHand: Weapon | null, leftHand: Weapon | null, items?: Item[]);
    constructor(id: string, name: string, type: 'Hero' | 'Enemy', position: Position, classe: Job, status: Status[], rightHand: Weapon | null, leftHand: Weapon | null, items?: Item[]);
    constructor(id: string, name: string, type: 'Hero' | 'Enemy', position: Position, currentHp: number, maxHp: number, status: Status[], currentMp: number, maxMp: number, currentAp: number, maxAp: number, classe: Job, rightHand: Weapon | null, leftHand: Weapon | null, items?: Item[]);
    constructor(id: string, name: string, type: 'Hero' | 'Enemy', position: Position, arg1: number | Job | Statistics, arg2?: number | Status[] | Weapon | Statistics | null, arg3?: Status[] | Weapon | null, arg4?: number | Item[] | Weapon | null, arg5?: number | Item[], arg6?: number, arg7?: number, arg8?: Job | Weapon | null, arg9?: Weapon | Item[] | null, arg10?: Item[] | Weapon | null, arg11?: Item[], arg12?: number) {
        if (arg1 instanceof Job) {
            // 🟢 Cas où `arg1` est un `Job`
            const classe = arg1;
            const stats = (arg2 && typeof arg2 === "object" && "strength" in arg2) ? (arg2 as Statistics) : classe.defaultStats; // ✅ Vérification correcte
            const items = (arg5 as Item[]) ?? classe.startItems;

            super(
                id,
                name,
                type,
                position,
                stats.endurance + 10, // HP
                stats.endurance + 10, // Max HP
                [],
                items
            );

            this.rightHand = (arg3 as Weapon) ?? items.length > 0 ? (classe.startItems.find((item) => item instanceof Weapon) as Weapon) : null;
            this.leftHand = (arg4 as Weapon) ?? null;

            this.currentMp = stats.mana + 10;
            this.maxMp = stats.mana + 10;
            this.currentAp = 10;
            this.maxAp = 10;
            this.job = classe;
            this.stats = stats;
        }
        else if (typeof arg1 === "object" && "strength" in arg1) {
            // 🟢 Cas où `arg1` est un `Statistics` (nouvelle surcharge)
            const stats = arg1 as Statistics;
            const classe = arg8 as Job;
            const items = (arg11 as Item[]) ?? classe.startItems;

            super(id, name, type, position, stats.endurance + 10, stats.endurance + 10, arg3 as Status[], items);

            this.currentMp = stats.mana + 10;
            this.maxMp = stats.mana + 10;
            this.currentAp = arg6 as number;
            this.maxAp = arg7 as number;
            this.job = classe;
            this.job.jobLevel = arg12 as number;
            this.characterLevel = arg12 as number;
            this.stats = stats;
            this.rightHand = arg9 ? (arg9 as Weapon) : items.length > 0 ? (classe.startItems.find((item) => item instanceof Weapon) as Weapon) : null;
            this.leftHand = (arg10 as Weapon) ?? null;
        }
        else {
            // 🟢 Cas où `arg1` est un `number` (initialisation complète)
            const classe = arg8 as Job;
            const items = (arg11 as Item[]) ?? classe.startItems;

            super(id, name, type, position, arg1, arg2 as number, arg3 as Status[], items);

            this.currentMp = arg4 as number;
            this.maxMp = arg5 as number;
            this.currentAp = arg6 as number;
            this.maxAp = arg7 as number;
            this.job = classe;
            this.job.jobLevel = arg12 as number;
            this.characterLevel = arg12 as number;
            this.stats = classe.defaultStats;
            this.rightHand = arg9 ? (arg9 as Weapon) : items.length > 0 ? (classe.startItems.find((item) => item instanceof Weapon) as Weapon) : null;
            this.leftHand = (arg10 as Weapon) ?? null;
        }

        spellData.forEach((spell: any) => {
            this.spellsMap.set(spell.name, spell as Spell);
        });
    }

    private calculateCritThreshold(): number {
        return 6 - this.status.reduce((acc, status) => acc + (status.name === "Crit+" ? 1 : status.name === "Crit++" ? 2 : 0), 0) - (this.job.name === "Ninja" ? 1 : 0);
    }

    private calculateDamage(weapon: any, bonus: number | 0, roll: number, critRoll: number, target: Unit, resultArray: string[]): number {
        let mainStat = weapon.mainStat === 'Force' ? this.stats.strength : this.stats.dexterity;
        let subStat = weapon.mainStat === 'Force' ? this.stats.dexterity : this.stats.strength;
        let damage = (mainStat + roll + bonus) * weapon.weaponStat;

        if (weapon.weaponSubStat !== 0 && roll + bonus >= (weapon.weaponSubStat - subStat)) {
            damage += (weapon.weaponSubStat + bonus) * subStat;
        }

        if (roll >= this.calculateCritThreshold()) {
            damage *= critRoll;
            resultArray.push(`COUT CRITIQUE ! dégat X${critRoll}!`);
        }

        return damage * calculateDamageMultiplier(this, weapon.element, target);
    }

    protected handleWeaponAttack(weapon: any, roll: number, critRoll: number, target: Unit, bonus: number | 0, resultArray: string[]): void {
        if (roll === 1) {
            resultArray.push('ECHEC CRITIQUE !');
            return;
        }
        let mainStat = weapon.mainStat === 'Force' ? this.stats.strength : this.stats.dexterity;
        if (((mainStat + roll + bonus) - weapon.weaponStat) * this.accuracyModifier >= 0 || this.status.some(status => status.name === 'No roll')) {
            let damage = this.calculateDamage(weapon, bonus, roll, critRoll, target, resultArray);
            target.currentHp = Math.max(target.currentHp - damage, 0);
            resultArray.push(`${target.name} perd ${damage}PV`);
            if (!target.isDead()) {
                if (weapon.status && weapon.status.chance && Math.random() * 10 <= weapon.status.chance) {
                    applyStatus(this, weapon.status, target, roll, resultArray);
                }
            } else {
                resultArray.push(`${target.name} est KO`);
            }
        } else {
            resultArray.push("Zut ... C'est raté");
        }
    }

    /**
     * Attaque simple sur la cible avec la/les armes équipées
     * @param target La cible visée
     * @param roll 
     * @param critRoll 
     * @param bonus (facultatif 0 par défaut) dégats additionnels dans le cadre de skills
     * @returns La liste des actions à afficher côté front
     */
    attack(target: Unit, roll: number, critRoll: number = 0, bonus: number = 0, resultArray: string[] = [`${this.name} attaque ${target.name}`]): string[] {

        if (this.rightHand && this.rightHand.type === 'weapon') {
            this.handleWeaponAttack(this.rightHand, roll, critRoll, target, bonus, resultArray);
        }

        if (this.leftHand && this.leftHand.type === 'weapon') {
            this.handleWeaponAttack(this.leftHand, roll, critRoll, target, bonus, resultArray);
        }

        if (!this.rightHand && !this.leftHand) {
            if (roll === 1) {
                resultArray.push('ECHEC CRITIQUE !');
            } else {
                let damage = (this.stats.strength + this.stats.dexterity + bonus) * roll;
                if (roll >= this.calculateCritThreshold()) {
                    damage *= critRoll;
                }
                target.currentHp = Math.max(target.currentHp - damage, 0);
                resultArray.push(`${this.name} frappe sa cible à mains nues. ${target.name} perd ${damage}PV !`);
            }
        }

        return resultArray;
    }

    /**
     * Action magique via un sort sur la cible
     * @param spell Le sort utilisé
     * @param target La cible visée
     * @param roll 
     * @param critRoll 
     * @returns La liste des actions à afficher côté front
     */
    useSpellFromName(spellName: string, target: Unit, roll: number, critRoll: number): string[] {
        const spell = spellData.find(spell => spell.name === spellName) as Spell;
        let resultArray: string[] = [`${this.name} lance ${spell.name} sur ${target.name}`];
        if (spell) {
            let damage = 0;

            if (this.currentMp < (spell.mpCost ?? 0)) {
                resultArray.push("Pas assez de mana !");
                return resultArray;
            }
            this.currentMp -= spell.mpCost ?? 0;

            if (spell.hpCost && this.currentHp - spell.hpCost < 1) {
                resultArray.push("Pas assez de PV pour lancer ce sort !");
                return resultArray;
            }
            this.currentHp -= spell.hpCost ?? 0;

            if (roll === 1) {
                resultArray.push('ECHEC CRITIQUE !');
                return resultArray;
            }

            if (spell.mpCost) {
                // Offensive spells
                if (spell.power) {
                    // Clause de réussite
                    if (roll >= (spell.power - this.stats.intelligence)) {
                        const damageMultiplier = calculateDamageMultiplier(this, spell.element, target);
                        damage += (Math.pow(spell.power + this.stats.intelligence, 2) / 2 + roll) * damageMultiplier;
                        resultArray.push(messageDamageMultiplier(damageMultiplier));
                        // Dégats additionnels en cas de réussite critique
                        if (roll >= this.calculateCritThreshold()) {
                            const critMultiplier = (critRoll + 2) / 2;
                            damage = damage * critMultiplier;
                            resultArray.push(`COUT CRITIQUE ! dégat X${critMultiplier}!`);
                        }
                        damage = Math.round(damage);
                        resultArray.push(`${target.name} perd ${damage}PV`);
                    } else {
                        // Message d'échec car pas assez expérimenté pour lancer le sort
                        resultArray.push(`${this.name} a manqué d'expérience ou de chance pour lancer le sort`);
                    }
                    // Defensive spells	
                } else { // Defensive spells
                    if (spell.hp && target.currentHp) { //Variantes de Soin, Grace et Vie
                        if (spell.name.startsWith('Soin') && target.currentHp > 0) {
                            target.currentHp = Math.min(target.currentHp + spell.hp, target.maxHp);
                            resultArray.push(`${target.name} récupère ${spell.hp}PV`);
                        } if (spell.name.startsWith('Grace') && target.currentHp > 0) {
                            target.currentHp = Math.min(target.currentHp + spell.hp, target.maxHp);
                            resultArray.push(`${target.name} récupère ${spell.hp}PV`);
                            //applyStatus push le statut
                        } if (spell.name.startsWith('Vie') && target.currentHp === 0) {
                            target.currentHp = spell.hp;
                            resultArray.push(`${target.name} revient à la vie avec ${spell.hp}PV !`);
                        }
                    }
                }
            } else {  // Darkness!!!
                const damageMultiplier = calculateDamageMultiplier(this, spell.element, target);
                damage += (target.currentHp / 2) * damageMultiplier;
                resultArray.push(messageDamageMultiplier(damageMultiplier));
            }
            // Gestion des statuts 
            if (spell.status) {
                applyStatus(this, spell.status, target, roll, resultArray);
            }
            target.currentHp = Math.max(target.currentHp - damage, 0);
        } else {
            resultArray.push("Ce sort n'existe pas");
        }
        return resultArray;
    }

    /**
     * Permet de s'équiper de l'arme choisie en main droite
     * @param weapon null si déséquipé
     */
    equipRightHand(weapon: Weapon | null) {
        if (this.job.weapons.some((equipable) => weapon?.type === equipable) || weapon === null) {
            this.rightHand = weapon;
        } else {
            throw new Error(`Cannot equip this type of weapon ${weapon.type} only ${this.job.weapons}`);
        }

    }

    /**
     * Retourne l'arme équipée en main droite
     * @returns 
     */
    getRightHand(): Weapon | null {
        return this.rightHand;
    }

    /**
     * Permet de s'équiper de l'arme choisie en main gauche
     * 
     * @param weapon null si déséquipé
     */
    equipLeftHand(weapon: Weapon | null) {
        if (this.job.weapons.some((equipable) => weapon?.type === equipable) || weapon === null) {
            if (this.rightHand && this.job.specialAbility.startsWith("Double Armement")) {
                this.leftHand = weapon;
            } else if (this.rightHand) {
                //Si il a une arme en main droite on échange
                this.leftHand = weapon;
                this.rightHand = null;
            } else {
                throw new Error("Character.equipLeftHand : TODO Oups, yé pa encole tlaité si cas");
            }
        } else {
            throw new Error(`Cannot equip this type of weapon ${weapon.type} only ${this.job.weapons}`);
        }
    }

    /**
     * Retourne l'arme équipée en main gauche
     * @returns 
     */
    getLeftHand(): Weapon | null {
        return this.leftHand;
    }


    /**
     * Renvoie la liste des compétences utilisables en fonction du niveau du lanceur
     * /!\ Ne contient pas la formule de calcul
     * @returns La liste des compétences sans la formule de calcul
     */
    getAvailableAbilities(): Omit<Skill, "formula">[] {
        return this.job.getAvailableAbilities();
    }

    /**
    * Renvoie la liste des sorts utilisables en fonction du niveau du lanceur
    * 
    * @returns La liste des sorts
    */
    getAvailableSpells(): Spell[] {
        const spellNames = this.job.getAvailableSpells();
        return spellNames
            .map(name => this.spellsMap.get(name))
            .filter(spell => spell !== undefined) as Spell[];
    }

    /**
     * Utilise une compétence depuis son nom
     * @param skillName 
     * @param allUnits 
     * @returns Le log de toutes les actions effectuées
     */
    useCharacterAbility(skillName: string, allUnits: Unit[]): string[] {
        let resultArray: string[] = [];
        const recordLevelSkill = this.job.skills.find(s => s.skill.name === skillName);

        if (!recordLevelSkill) {
            resultArray.push("Compétence introuvable !");
            return resultArray;
        }

        if (this.currentAp < recordLevelSkill.skill.apCost) {
            resultArray.push("Pas assez d'AP");
            return resultArray;
        }
        if (this.currentMp < recordLevelSkill.skill.mpCost) {
            resultArray.push("Pas assez de MP");
            return resultArray;
        }
        this.currentAp -= recordLevelSkill.skill.apCost;
        this.currentMp -= recordLevelSkill.skill.mpCost;


        return this.useAbility(recordLevelSkill.skill, allUnits);
    }

    /**
     * Utilise un objet de type 'consumable' ou 'tool' sur une cible.
     */
    useItem(item: Item, target: Unit): string[] {
        let resultArray: string[] = []
        if (item instanceof Consumable) {
            resultArray.push(`${this.name} utilise ${item.name} sur ${target.name}.`);
            if (item.revive && target.isDead()) {
                target.currentHp = item.hp;
            } else if (!target.isDead()) {
                target.currentHp = Math.min(target.currentHp + item.hp, target.maxHp);
                if (target instanceof Character) {
                    target.currentMp = Math.min(target.currentMp + item.mp, target.maxMp);
                }
            } else {
                resultArray.push(`${target.name} est KO et ne peut recevoir ces soins.`);
            }
        } if (item instanceof Tools && this.job instanceof Thief && this.job.nbTools) {
            resultArray.push(`${this.name} utilise le parchemin ${item.name} sur ${target.name}.`);
            this.job.nbTools--;
            let damage = 0;
            if (item.power) {
                const damageMultiplier = calculateDamageMultiplier(this, item.element, target);
                damage += (Math.pow(item.power, 2) / 2) * damageMultiplier;
                resultArray.push(messageDamageMultiplier(damageMultiplier));
                damage = Math.round(damage);
                target.currentHp = Math.max(target.currentHp - damage, 0);
                resultArray.push(`${target.name} perd ${damage}PV`);
            } if (item.status) {
                applyStatus(this, item.status, target, 0, resultArray)
            }
        }
        return resultArray;
    }

    /**
     * TODO protectTarget: Pouvoir utiliser cette fonction pendant le tour d'attaque des ennemis
     * 
     * Si le personnage n'est pas un Chevalier Noir et est sous le statut "Bouclier impénétrable", on effectue un roll de protection à chaque attaque
     * @param target Cible à protéger
     * @param roll Premier dès lancé
     * @param doubleRoll (Paladin uniquement) Deuxième dès lancé
     * @param resultArray Ajoute ["Une lumière enveloppe ${Guerrier/Paladin}", "${Guerrier/Paladin} protège ${Allié}"] si @return true
     * @returns true si la cible est protégée, false otherwise
     */
    protectTarget(target: Unit, roll: number, doubleRoll: number = 0, resultArray: string[]): boolean {
        let protect: boolean = false;
        if (this.job.name !== "Chevalier Noir" && this.status.some(statut => statut.name === "Bouclier impénétrable")) {
            // Si le roll du guerrier est d'au moins 5 ou que celui du Paladin est au moins de 6
            if ((doubleRoll === 0 && roll >= 5) || (doubleRoll > 0 && roll + doubleRoll >= 6)) {
                resultArray.push(`Une lumière enveloppe ${this.name}`);
                //switchPosition with target
                const postionBuffer: Position = this.position;
                this.position = target.position;
                target.position = postionBuffer;
                if (this === target) {
                    resultArray.push(`${this.name} se protège`);
                } else {
                    resultArray.push(`${this.name} protège ${target.name}`);
                }
                protect = true;
            }
        }
        return protect;
    }

    evolveJob(evolutionName: string): string[] {
        let resultArray: string[] = [];
        const evolvedJob: Evolution = this.job.evolutions.find(form => form.name === evolutionName) as Evolution;
        if (evolvedJob) {
            if (evolvedJob.skills.length !== 0) this.job.skills.push(...evolvedJob.skills);
            if (evolvedJob.spells.length !== 0) this.job.spells.push(...evolvedJob.spells);
            resultArray.push(`${this.name} devient un ${evolvedJob.name}`)
            this.job.name = evolvedJob.name;
            this.job.specialAbility = evolvedJob.specialAbility;
            this.stats.strength += evolvedJob.bonuses.strength;
            this.stats.dexterity += evolvedJob.bonuses.dexterity;
            this.stats.intelligence += evolvedJob.bonuses.intelligence;
            this.stats.mana += evolvedJob.bonuses.mana;
            this.stats.perception += evolvedJob.bonuses.perception;
            this.stats.charisma += evolvedJob.bonuses.charisma;
        } else {
            throw new Error("Character.evolveJob : This evolution cannot happen");
        }
        return resultArray;
    }
}