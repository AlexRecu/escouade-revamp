import { Job, Position, Spell, Statistics, Status, Weapon } from "./Types";
import { Unit } from "./Unit"

export class Character extends Unit {
    currentMp: number;
    maxMp: number;
    currentAp: number;
    maxAp: number;
    classe: Job;
    stats: Statistics;
    private rightHand: Weapon | null;
    private leftHand: Weapon | null;

    constructor(id: string, name: string, type: 'Hero' | 'Enemy', position: Position, currentHp: number, maxHp: number, status: Status[], currentMp: number,
        maxMp: number, currentAp: number, maxAp: number, classe: Job, stats: Statistics, rightHand: Weapon | null, leftHand: Weapon | null) {
        super(id ?? null, name ?? null, type ?? 'Hero', position ?? null, currentHp ?? classe?.defaultStats.endurance + 10, maxHp ?? classe?.defaultStats.endurance + 10, status ?? []);
        this.currentMp = currentMp ?? classe?.defaultStats.mana + 10;
        this.maxMp = maxMp ?? classe?.defaultStats.mana + 10;
        this.currentAp = currentAp ?? 10;
        this.maxAp = maxAp ?? 10;
        this.classe = classe ?? null;
        this.stats = stats ?? classe?.defaultStats;
        this.rightHand = rightHand ?? classe?.item.find((item) => item.type === "weapon") as Weapon;
        this.leftHand = leftHand ?? null;
    }

    private calculateCritThreshold(): number {
        return 6 - this.status.reduce((acc, status) => acc + (status.name === "Crit+" ? 1 : status.name === "Crit++" ? 2 : 0), 0);
    }

    private calculateDamage(weapon: any, roll: number, critRoll: number, target: Unit): number {
        let mainStat = weapon.mainStat === 'Force' ? this.stats.strength : this.stats.dexterity;
        let subStat = weapon.mainStat === 'Force' ? this.stats.dexterity : this.stats.strength;
        let damage = (mainStat + roll) * weapon.weaponStat;

        if (roll >= (weapon.weaponSubStat - subStat)) {
            damage += weapon.weaponSubStat * subStat;
        }

        if (roll >= this.calculateCritThreshold()) {
            damage *= critRoll;
        }

        return damage * this.calculateDamageMultiplier(weapon.element, target);
    }

    protected handleWeaponAttack(weapon: any, roll: number, critRoll: number, target: Unit, resultArray: string[]): void {
        if (roll === 1) {
            resultArray.push('ECHEC CRITIQUE !');
            return;
        }
        let mainStat = weapon.mainStat === 'Force' ? this.stats.strength : this.stats.dexterity;
        if ((mainStat + roll) - weapon.weaponStat >= 0 || this.status.some(status => status.name === 'No roll')) {
            let damage = this.calculateDamage(weapon, roll, critRoll, target);
            target.currentHp = Math.max(target.currentHp - damage, 0);
            resultArray.push(`${this.name} inflige ${damage} à ${target.name}`);
            if (weapon.status && weapon.status.chance && Math.random() * 10 <= weapon.status.chance) {
                this.manageStatus(weapon.status, target, roll, resultArray);
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
     * @returns La liste des actions à afficher côté front
     */
    attack(target: Unit, roll: number, critRoll: number): string[] {
        let resultArray: string[] = [`${this.name} attaque ${target.name}`];

        if (this.rightHand && this.rightHand.type === "weapon") {
            this.handleWeaponAttack(this.rightHand, roll, critRoll, target, resultArray);
        }

        if (this.leftHand && this.leftHand.type === "weapon") {
            this.handleWeaponAttack(this.leftHand, roll, critRoll, target, resultArray);
        }

        if (!this.rightHand && !this.leftHand) {
            if (roll === 1) {
                resultArray.push('ECHEC CRITIQUE !');
            } else {
                let damage = (this.stats.strength + this.stats.dexterity) * roll;
                if (roll >= this.calculateCritThreshold()) {
                    damage *= critRoll;
                }
                target.currentHp = Math.max(target.currentHp - damage, 0);
                resultArray.push(`${this.name} inflige ${damage} à ${target.name}`);
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
    useSpell(spell: Spell, target: Unit, roll: number, critRoll: number): string[] {
        let resultArray: string[] = [`${this.name} lance ${spell.name} sur ${target.name}`];
        let damage = 0;

        if (this.currentMp < (spell.manaCost ?? 0)) {
            resultArray.push("Pas assez de mana !");
            return resultArray;
        }
        this.currentMp -= spell.manaCost ?? 0;

        if (spell.hpCost && this.currentHp - spell.hpCost < 1) {
            resultArray.push("Pas assez de PV pour lancer ce sort !");
            return resultArray;
        }
        this.currentHp -= spell.hpCost ?? 0;

        if (roll === 1) {
            resultArray.push('ECHEC CRITIQUE !');
            return resultArray;
        }

        if (spell.manaCost) {
            // Offensive spells
            if (spell.power) {
                // Clause de réussite
                if (roll >= (spell.power - this.stats.intelligence)) {
                    damage += (Math.pow(spell.power + this.stats.intelligence, 2) / 2 + roll) *
                        this.calculateDamageMultiplier(spell.element, target);
                    // Dégats additionnels en cas de réussite critique
                    if (roll >= this.calculateCritThreshold()) {
                        const critMultiplier = (critRoll + 2) / 2;
                        damage = damage * critMultiplier;
                        resultArray.push(`COUT CRITIQUE ! dégat X${critMultiplier}!`);
                    }
                    resultArray.push(` et inflige ${damage} dégâts`);
                } else {
                    // Message d'échec car pas assez expérimenté pour lancer le sort
                    resultArray.push(`${this.name} a manqué d'expérience ou de chance pour lancer le sort`);
                }
                // Defensive spells	
            } else { // Defensive spells
                if (spell.hp && target.currentHp) { //Variantes de Soin, Grace et Vie
                    if (spell.name.startsWith('Soin') && target.currentHp > 0) {
                        target.currentHp += spell.hp;
                        resultArray.push(`${target.name} récupère ${spell.hp}PV`);
                    } if (spell.name.startsWith('Grace') && target.currentHp > 0) {
                        target.currentHp += spell.hp;
                        resultArray.push(`${target.name} récupère ${spell.hp}PV`);
                        target.status.push(spell.status);
                    } if (spell.name.startsWith('Vie') && target.currentHp === 0) {
                        target.currentHp = spell.hp;
                        resultArray.push(`${target.name} revient à la vie avec ${spell.hp}PV !`);
                    }
                }
            }
        } else {  // Darkness!!!
            this.currentHp = Math.round(this.currentHp / 2);
            damage += Math.round(target.currentHp / 2) * this.calculateDamageMultiplier(spell.element, target);
            resultArray.push(`${target.name} perd la moitié de sa vie`);
        }
        // Gestion des statuts 
        if (spell.status) {
            this.manageStatus(spell.status, target, roll, resultArray);
        }
        target.currentHp = Math.max(target.currentHp - damage, 0);
        return resultArray;
    }

    /**
     * Permet de s'équiper de l'arme choisie en main droite
     * @param weapon 
     */
    setRightHand(weapon: Weapon) {
        this.rightHand = weapon;
    }

    /**
     * Permet de s'équiper de l'arme choisie en main gauche
     * @param weapon 
     */
    setLeftHand(weapon: Weapon) {
        this.leftHand = weapon;
    }
}