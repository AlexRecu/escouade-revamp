import { Job } from "../Jobs/Job";
import { EonSkill, Evolution, Position, Skill, Spell, Statistics } from "../Types";
import { Status } from "../Status";
import { Unit } from "./Unit";
import { Weapon, Shield } from "../Items/Weapon";
import { Item } from "../Items/Item";
import spellData from '../../config/spells_data.json'; // Charger le fichier JSON
import { Consumable } from "../Items/Consumable";
import { Tools } from "../Items/Tools";
import { Thief } from "../Jobs/Thief";
import { Warrior } from "../Jobs/Warrior";
import { calculateDamageMultiplier, messageDamageMultiplier } from "../../utils/DamageUtils";
import { applyStatus } from "../../utils/StatusUtils";

export class Character extends Unit {
    characterLevel: number = 1;
    currentXp: number = 0;
    gold: number = 0;
    currentMp: number;
    maxMp: number;
    currentAp: number;
    maxAp: number;
    job: Job;
    stats: Statistics;
    /**
     * Id du joueur qui **contrôle** ce personnage (mode multi-joueurs).
     * `null`/`undefined` pour un PNJ ou un personnage solo (non lié à un
     * joueur). Utilisé par le front pour identifier « mon » personnage.
     */
    ownerId: string | null = null;
    /**
     * Avatar personnalisé : nom du fichier de token choisi par le joueur
     * (ex. "Guerrier.png"). `null` = token de classe par défaut.
     */
    avatar: string | null = null;
    protected rightHand: Weapon | null;
    protected leftHand: Weapon | null;
    private spellsMap: Map<string, Spell> = new Map();

    constructor(id: string, name: string, type: "Hero" | "Enemy", position: Position, classe: Job, rightHand: Weapon | null, leftHand: Weapon | null, items?: Item[]);
    constructor(id: string, name: string, type: "Hero" | "Enemy", position: Position, classe: Job, status: Status[], rightHand: Weapon | null, leftHand: Weapon | null, items?: Item[]);
    constructor(id: string, name: string, type: "Hero" | "Enemy", position: Position, currentHp: number, maxHp: number, status: Status[], currentMp: number, maxMp: number, currentAp: number, maxAp: number, classe: Job, rightHand: Weapon | null, leftHand: Weapon | null, items?: Item[]);
    constructor(id: string, name: string, type: "Hero" | "Enemy", position: Position, arg1: number | Job | Statistics, arg2?: number | Status[] | Weapon | Statistics | null, arg3?: Status[] | Weapon | null, arg4?: number | Item[] | Weapon | null, arg5?: number | Item[], arg6?: number, arg7?: number, arg8?: Job | Weapon | null, arg9?: Weapon | Item[] | null, arg10?: Item[] | Weapon | null, arg11?: Item[], arg12?: number) {
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
                stats.endurance * 2 + 10, // HP
                stats.endurance * 2 + 10, // Max HP
                [],
                items
            );
    
            this.rightHand = (arg3 as Weapon) ?? (classe.startItems.find((item) => item instanceof Weapon) as Weapon);
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
    
            super(id, name, type, position, stats.endurance * 2 + 10, stats.endurance * 2 + 10, arg3 as Status[], items);
    
            this.currentMp = stats.mana + 10;
            this.maxMp = stats.mana + 10;
            this.currentAp = arg6 as number;
            this.maxAp = arg7 as number;
            this.job = classe;
            this.job.jobLevel = (arg12 as number) ?? 1;
            this.characterLevel = (arg12 as number) ?? 1;
            this.stats = stats;
            this.rightHand = (arg9 as Weapon) ?? (classe.startItems.find((item) => item instanceof Weapon) as Weapon);
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
            this.job.jobLevel = (arg12 as number) ?? 1;
            this.characterLevel = (arg12 as number) ?? 1;
            this.stats = classe.defaultStats;
            this.rightHand = (arg9 as Weapon) ?? (classe.startItems.find((item) => item instanceof Weapon) as Weapon);
            this.leftHand = (arg10 as Weapon) ?? null;
        }

        // Bouclier par défaut : le Guerrier porte un bouclier en main gauche
        // (objet de classe, non achetable/revendable). Seulement s'il n'a pas
        // déjà d'arme en main gauche (ex. désérialisation).
        if (this.job.name === "Guerrier" && !this.leftHand) {
            this.leftHand = new Shield(
                "shield_" + id,
                "Bouclier",
                "Un bouclier robuste, emblème du Guerrier. Il protège son porteur et ses alliés."
            );
        }

        spellData.forEach((spell: any) => {
            this.spellsMap.set(spell.name, spell as Spell);
        });
    }
    
    
    /** Arme en main droite (accès en lecture — le champ est protégé). */
    get rightHandWeapon(): Weapon | null {
        return this.rightHand;
    }

    /** Arme en main gauche (accès en lecture — le champ est protégé). */
    get leftHandWeapon(): Weapon | null {
        return this.leftHand;
    }
    private calculateCritThreshold(): number {
        return 6 - this.status.reduce((acc, status) => acc + (status.name === "Crit+" ? 1 : status.name === "Crit++" ? 2 : 0), 0) - (this.job.name === "Ninja" ? 1 : 0);
    }

    private calculateDamage(weapon: any, bonus: number | 0, roll: number, critRoll: number, target: Unit, resultArray: string[]): number {
        let mainStat = weapon.mainStat === 'Force' ? this.stats.strength : this.stats.dexterity;
        let subStat = weapon.mainStat === 'Force' ? this.stats.dexterity : this.stats.strength;
        let damage = (mainStat + roll + bonus) * weapon.weaponStat;

        // Stat secondaire (lances) : même logique que la principale, mais
        // seulement si le roll atteint le seuil (weaponSubStat - subStat).
        if (weapon.weaponSubStat !== 0 && roll + bonus >= (weapon.weaponSubStat - subStat)) {
            damage += (subStat + roll + bonus) * weapon.weaponSubStat;
        }

        if (roll >= this.calculateCritThreshold()) {
            damage *= critRoll;
            resultArray.push(`COUT CRITIQUE ! dégat X${critRoll}!`);
        }

        // Mode Berserk (Chevalier Noir) : chaque marqueur demonToken ajoute
        // +10% aux dégâts infligés (livret : 1 + nombre de marqueurs / 10).
        // Spécifique au Chevalier Noir (pas au Guerrier de base).
        if (this.job.name === "Chevalier Noir" && (this.job as Warrior).demonToken > 0) {
            damage *= 1 + (this.job as Warrior).demonToken / 10;
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
            const actualDamage = target.applyDamage(damage, resultArray);
            resultArray.push(`${target.name} perd ${actualDamage}PV`);
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

        // Le clone Bunshin encaisse l'attaque à la place de la cible
        if (target.consumeBunshin(resultArray)) {
            return resultArray;
        }

        // Un bouclier (weaponType "bouclier") est un objet **défensif** : il ne
        // fait pas de dégâts et ne compte pas comme une arme offensive. Sans
        // arme offensive, le personnage frappe à mains nues.
        const rightWeapon = this.rightHand && this.rightHand.type === 'weapon' && this.rightHand.weaponType !== 'bouclier' ? this.rightHand : null;
        const leftWeapon = this.leftHand && this.leftHand.type === 'weapon' && this.leftHand.weaponType !== 'bouclier' ? this.leftHand : null;

        if (rightWeapon) {
            this.handleWeaponAttack(rightWeapon, roll, critRoll, target, bonus, resultArray);
        }

        if (leftWeapon) {
            this.handleWeaponAttack(leftWeapon, roll, critRoll, target, bonus, resultArray);
        }

        if (!rightWeapon && !leftWeapon) {
            if (roll === 1) {
                resultArray.push('ECHEC CRITIQUE !');
            } else {
                let damage = (this.stats.strength + this.stats.dexterity + bonus) * roll;
                if (roll >= this.calculateCritThreshold()) {
                    damage *= critRoll;
                }
                const actualDamage = target.applyDamage(damage, resultArray);
                resultArray.push(`${this.name} frappe sa cible à mains nues. ${target.name} perd ${actualDamage}PV !`);
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
            target.applyDamage(damage, resultArray);
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
        if (this.job.weapons.some((equipable) => weapon?.weaponType === equipable) || weapon === null) {
            const prevRight = this.rightHand;
            const prevLeft = this.leftHand;
            this.rightHand = weapon;
            this.syncBagWithHands(prevRight, prevLeft);
        } else {
            throw new Error(`Cannot equip this type of weapon ${weapon?.weaponType} only ${this.job.weapons}`);
        }

    }

    /**
     * Permet de s'équiper de l'arme choisie en main gauche
     * 
     * @param weapon null si déséquipé
     */
    equipLeftHand(weapon: Weapon | null) {
        if (this.job.weapons.some((equipable) => weapon?.weaponType === equipable) || weapon === null) {
            const prevRight = this.rightHand;
            const prevLeft = this.leftHand;
            if (this.rightHand && this.job.specialAbility.startsWith("Double Armement")) {
                // Double Armement : on peut tenir une arme en main droite ET une en main gauche
                this.leftHand = weapon;
            } else if (this.rightHand) {
                // Sans Double Armement : une seule arme, on la déplace en main gauche
                this.leftHand = weapon;
                this.rightHand = null;
            } else {
                // Main droite vide : on équipe simplement la main gauche (arme ou déséquipement)
                this.leftHand = weapon;
            }
            this.syncBagWithHands(prevRight, prevLeft);
        } else {
            throw new Error(`Cannot equip this type of weapon ${weapon?.weaponType} only ${this.job.weapons}`);
        }
    }

    /**
     * Synchronise le sac avec les mains après un changement d'équipement.
     *
     * Modèle **déplacement** : une arme équipée n'est **pas** dans le sac, et
     * une arme déséquipée y revient. Sans ça, une arme achetée puis équipée
     * resterait dans le sac ET dans la main (référence partagée) → comptée 2×
     * au stock boutique et revendable alors qu'elle est portée.
     *
     * @param prevRight arme qui était en main droite AVANT le changement.
     * @param prevLeft  arme qui était en main gauche AVANT le changement.
     */
    private syncBagWithHands(prevRight: Weapon | null, prevLeft: Weapon | null): void {
        // 1. Retire du sac toute arme actuellement portée (main droite/gauche).
        const equippedIds = new Set<string>();
        if (this.rightHand) equippedIds.add(this.rightHand.id);
        if (this.leftHand) equippedIds.add(this.leftHand.id);
        this.bag = this.bag.filter((it) => !(it instanceof Weapon && equippedIds.has(it.id)));
        // 2. Remet dans le sac les armes qui étaient portées avant et ne le sont
        //    plus (déséquipées ou déplacées).
        for (const prev of [prevRight, prevLeft]) {
            if (prev && !equippedIds.has(prev.id) && !this.bag.some((it) => it.id === prev.id)) {
                this.bag.push(prev);
            }
        }
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
     * Utilise une compétence depuis son nom (résolue dans job.skills : compétences
     * de classe + compétences apprises, ex. par le Mage bleu).
     * @param name Le nom de la compétence
     * @param allUnits Le contexte de toutes les unités
     * @returns Le log de toutes les actions effectuées
     */
    useAbilityByName(name: string, allUnits: Unit[]): string[] {
        const recordLevelSkill = this.job.skills.find(s => s.skill.name === name);

        if (!recordLevelSkill) {
            return ["Compétence introuvable !"];
        }

        return this.useAbility(recordLevelSkill.skill, allUnits);
    }

    /**
     * Exécute un **combo** (passif Bushido du Samouraï) : enchaîne plusieurs
     * compétences d'AP (Hissatsu) dans l'ordre donné, tant que le personnage
     * a assez d'AP et que le combat n'est pas terminé.
     *
     * C'est ce qui permet au Samouraï d'enchaîner plusieurs Hissatsu en un
     * seul tour (ex. Gyôten puis Shinten) — chaque compétence consomme son
     * propre coût d'AP, et l'enchaînement s'arrête dès qu'il n'en reste plus.
     *
     * @param combo Noms des compétences à enchaîner (dans l'ordre).
     * @param allUnits Le contexte de toutes les unités.
     * @returns Le log de toutes les actions effectuées.
     */
    useCombo(combo: string[], allUnits: Unit[]): string[] {
        const resultArray: string[] = [];
        for (const name of combo) {
            if (this.isDead()) {
                resultArray.push(`${this.name} est KO et ne peut plus enchaîner.`);
                break;
            }
            const recordLevelSkill = this.job.skills.find(s => s.skill.name === name);
            if (!recordLevelSkill) {
                resultArray.push(`Compétence introuvable : ${name}.`);
                continue;
            }
            // On n'enchaîne que si le personnage a assez d'AP pour la compétence.
            if (this.currentAp < recordLevelSkill.skill.apCost) {
                resultArray.push(`Pas assez d'AP pour enchaîner ${name}.`);
                break;
            }
            resultArray.push(...this.useAbility(recordLevelSkill.skill, allUnits));
        }
        return resultArray;
    }

    /**
     * Utilise un objet de type 'consumable' ou 'tool' sur une cible.
     */
    useItem(item: Item, target: Unit): string[] {
        let resultArray: string[] = []
        if (item instanceof Consumable) {
            resultArray.push(`${this.name} utilise ${item.name} sur ${target.name}.`);
            let consumed = false;
            if (item.revive && target.isDead()) {
                // Ranime : à la moitié des PV max (ou montant fixe si défini).
                target.currentHp = item.hpPercent
                    ? Math.floor(target.maxHp * item.hpPercent)
                    : (item.hp || 1);
                consumed = true;
            } else if (!target.isDead()) {
                if (item.fullHeal) {
                    target.currentHp = target.maxHp;
                } else if (item.hpPercent) {
                    target.currentHp = Math.min(target.currentHp + Math.floor(target.maxHp * item.hpPercent), target.maxHp);
                } else if (item.hp) {
                    target.currentHp = Math.min(target.currentHp + item.hp, target.maxHp);
                }
                if (target instanceof Character) {
                    if (item.fullMp) {
                        target.currentMp = target.maxMp;
                    } else if (item.mp) {
                        target.currentMp = Math.min(target.currentMp + item.mp, target.maxMp);
                    }
                }
                consumed = true;
            } else {
                resultArray.push(`${target.name} est KO et ne peut recevoir ces soins.`);
            }
            // L'objet est consommé s'il a été effectivement utilisé (soin sur
            // une cible vivante ou réanimation). Sinon il reste dans le sac.
            if (consumed) this.consumeItem(item);
        } if (item instanceof Tools && this.job instanceof Thief && this.job.nbTools) {
            resultArray.push(`${this.name} utilise le parchemin ${item.name} sur ${target.name}.`);
            this.job.nbTools--;
            let damage = 0;
            if (item.power) {
                const damageMultiplier = calculateDamageMultiplier(this, item.element, target);
                damage += (Math.pow(item.power, 2) / 2) * damageMultiplier;
                resultArray.push(messageDamageMultiplier(damageMultiplier));
                damage = Math.round(damage);
                const actualDamage = target.applyDamage(damage, resultArray);
                resultArray.push(`${target.name} perd ${actualDamage}PV`);
            } if (item.status) {
                applyStatus(this, item.status, target, 0, resultArray)
            }
        }
        return resultArray;
    }

    /**
     * Retire un objet du sac (après usage). Ne fait rien si l'objet n'y est
     * pas (déjà consommé, ou objet de classe non stocké).
     */
    private consumeItem(item: Item): void {
        const idx = this.bag.findIndex((it) => it.id === item.id);
        if (idx !== -1) this.bag.splice(idx, 1);
    }

    /**
     * Protection d'un allié (Guerrier/Paladin sous "Bouclier impénétrable").
     * Appelé par l'IA pendant le tour d'attaque des ennemis (AIService) : le
     * protecteur se place devant la cible pour encaisser l'attaque à sa place.
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

    /**
     * Déplacement en combat. Règle de base : 1 case/tour.
     * Pied véloce (Moine évolué en Maître) : déplacement multiplié par la Dextérité.
     */
    getMovementRange(): number {
        if (this.job.specialAbility.startsWith("Pied véloce")) {
            return Math.max(1, this.stats.dexterity);
        }
        return 1;
    }

    /**
     * Portée d'attaque : la plus grande portée parmi les armes **offensives**
     * équipées (un bouclier n'est pas une arme offensive). Sans arme offensive,
     * le personnage frappe à mains nues (portée 1).
     */
    getAttackRange(): number {
        let range = 1;
        const right = this.rightHand && this.rightHand.type === 'weapon' && this.rightHand.weaponType !== 'bouclier' ? this.rightHand : null;
        const left = this.leftHand && this.leftHand.type === 'weapon' && this.leftHand.weaponType !== 'bouclier' ? this.leftHand : null;
        if (right && right.range > range) range = right.range;
        if (left && left.range > range) range = left.range;
        return range;
    }

    /**
     * Crée un outil ninja et l'ajoute au sac du personnage (uniquement si le job est Ninja).
     * @param toolName Nom de l'outil ninja à créer
     * @returns Le message de résultat
     */
    craftNinjaTool(toolName: "Doton" | "Katon" | "Raiton" | "Hyuton" | "Futon" | "Bunshin" | "Shuriken Fuma"): string {
        if (this.job instanceof Thief) {
            const tool = this.job.craftTool(toolName);
            if (tool) {
                this.bag.push(tool);
                return `Nouvel outil ninja créé : ${toolName}`;
            }
            return `Impossible de créer cet outil ninja : ${toolName} (capacité atteinte)`;
        }
        return `Impossible de créer cet outil ninja : ${toolName} (seul un Ninja peut créer des outils)`;
    }

    /**
     * Fait évoluer la classe du personnage vers une évolution choisie.
     *
     * Conditions (livret) :
     *  - l'évolution doit exister dans `job.evolutions`,
     *  - le personnage doit avoir atteint le **niveau requis** (`requirements.level`),
     *  - le personnage ne doit pas déjà avoir évolué (une seule évolution).
     *
     * @param evolutionName Nom de l'évolution (ex. "Démoniste").
     * @returns Les logs de l'évolution.
     */
    evolveJob(evolutionName: string): string[] {
        const resultArray: string[] = [];
        const evolvedJob: Evolution | undefined = this.job.evolutions.find((form) => form.name === evolutionName);

        if (!evolvedJob) {
            throw new Error(`Character.evolveJob : évolution inconnue "${evolutionName}"`);
        }
        if (this.job.evolvedName) {
            throw new Error(`Character.evolveJob : ${this.name} a déjà évolué (${this.job.evolvedName})`);
        }
        const requiredLevel = evolvedJob.requirements?.level ?? 1;
        if (this.job.jobLevel < requiredLevel) {
            throw new Error(`Character.evolveJob : niveau requis ${requiredLevel} (actuel ${this.job.jobLevel})`);
        }

        if (evolvedJob.skills.length !== 0) this.job.skills.push(...evolvedJob.skills);
        if (evolvedJob.spells.length !== 0) this.job.spells.push(...evolvedJob.spells);
        resultArray.push(`${this.name} devient un ${evolvedJob.name}`);
        this.job.name = evolvedJob.name;
        this.job.specialAbility = evolvedJob.specialAbility;
        this.job.evolvedName = evolvedJob.name;
        this.stats.strength += evolvedJob.bonuses.strength;
        this.stats.dexterity += evolvedJob.bonuses.dexterity;
        this.stats.endurance += evolvedJob.bonuses.endurance;
        this.stats.intelligence += evolvedJob.bonuses.intelligence;
        this.stats.mana += evolvedJob.bonuses.mana;
        this.stats.perception += evolvedJob.bonuses.perception;
        this.stats.charisma += evolvedJob.bonuses.charisma;
        // Bonus d'AP de l'évolution (ex. Samouraï : +2 AP max).
        if (evolvedJob.apBonus) {
            this.maxAp += evolvedJob.apBonus;
            this.currentAp += evolvedJob.apBonus;
        }
        return resultArray;
    }

    /**
     * Renvoie les évolutions **disponibles** pour ce personnage (niveau de
     * classe atteint, et pas encore évolué). C'est la liste que le front
     * présente au joueur au moment du choix d'évolution.
     */
    availableEvolutions(): Evolution[] {
        if (this.job.evolvedName) return [];
        return this.job.evolutions.filter(
            (e) => this.job.jobLevel >= (e.requirements?.level ?? 1)
        );
    }

    /**
     * Déclenche l'évolution de classe vers l'évolution nommée.
     *
     * C'est le point d'entrée du gameplay (appelé par le front / le service de
     * ville quand le joueur choisit une évolution). Délègue à `evolveJob` qui
     * vérifie les conditions (évolution connue, niveau requis, pas déjà évolué)
     * et applique les bonus de stats + compétences/sorts.
     *
     * @param evolutionName Nom de l'évolution (ex. "Démoniste", "Samouraï").
     * @returns Les logs de l'évolution.
     */
    evolveTo(evolutionName: string): string[] {
        return this.evolveJob(evolutionName);
    }
}