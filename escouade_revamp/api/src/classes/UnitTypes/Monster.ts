import { Item } from "../Items/Item";
import { MonsterAttack, Position, Skill, Spell } from "../Types";
import { Status } from "../Status";
import { Unit } from "../UnitTypes/Unit";
import bestiary from "../../config/bestiary_data.json";
import { IdGenerator } from "../../utils/IdGeneratorUtils";
import skillData from "../../config/blueMage_skills_data.json";
import spellData from "../../config/spells_data.json";
import { calculateDamageMultiplier, messageDamageMultiplier, getValidTargets } from "../../utils/DamageUtils";
import { applyStatus } from "../../utils/StatusUtils";

export class Monster extends Unit {
    rank!: number;
    monsterSkills!: string[];
    atk!: number;
    xp!: number;
    gold!: number;
    /** Nature de l'attaque du monstre (bestiaire) : "Physique" (corps-à-corps)
     *  ou "Magique" (à distance). Utilisé pour l'animation côté front. */
    attackType!: "Physique" | "Magique";
    /** Niveau de zone au spawn (pour le scaling des PV/ATK et le spawn de congénères). */
    zoneLevel!: number;
    /** Compteur de tours du monstre (pour le comportement "reculer tous les 2-3 tours"). */
    turnCount!: number;
    /** Cooldowns restants par nom de capacité (0 = disponible). */
    cooldowns!: Map<string, number>;

    constructor(name: string, position: Position, type: 'Hero' | 'Enemy', zoneLevel: number);
    constructor(rank: number, name: string, type: 'Hero' | 'Enemy', zoneLevel: number, position: Position, status: Status[], monsterSkills: string[], atk: number[], pv: number[], xp: number[], gold: number[], items: Item[], weakness: string[], resistance: string[], immunity: string[])
    constructor(arg1: number | string, arg2: string | Position, arg3: 'Hero' | 'Enemy', zoneLevel: number, position?: Position, status?: Status[], monsterSkills?: string[], atk?: number[], pv?: number[], xp?: number[], gold?: number[], items?: Item[], weakness?: string[], resistance?: string[], immunity?: string[]) {
        if (typeof arg1 === "string") {
            // => constructor(name: string, position: Position, type: ...)
            const name = arg1;
            const position = arg2 as Position;
            const type = arg3 as 'Hero' | 'Enemy';
            const monster = bestiary.find(m => m.name === name);
            if (monster) {
                super(IdGenerator.generate(monster.name), monster.name, type, position, monster.pv[zoneLevel - 1], monster.pv[zoneLevel - 1], status ?? [], items ?? []);
                this.rank = monster.rank;
                this.monsterSkills = monster.attack ?? [];
                this.atk = monster.atk[zoneLevel - 1];
                this.xp = monster.xp[zoneLevel - 1];
                this.gold = monster.gold[zoneLevel - 1];
                this.attackType = monster.type === "Magique" ? "Magique" : "Physique";
                this.zoneLevel = zoneLevel;
                this.turnCount = 0;
                this.cooldowns = new Map();
                this.weakness = monster.weakness ?? [];
                this.resistance = monster.resistance ?? [];
                this.immunity = monster.immunity ?? [];
            }
        } else {
            // => constructor(rank: number, name: string, type: ..., ...)
            const rank = arg1 as number;
            const name = arg2 as string;
            const type = arg3 as 'Hero' | 'Enemy';
            super(IdGenerator.generate(name), name, type, position!, pv ? pv[zoneLevel - 1] : 10000, pv ? pv[zoneLevel - 1] : 10000, status ?? [], items ?? []);
            this.rank = rank;
            this.monsterSkills = monsterSkills ?? [];
            this.atk = atk ? atk[zoneLevel - 1] : 0;
            this.xp = xp ? xp[zoneLevel - 1] : 10000;
            this.gold = gold ? gold[zoneLevel - 1] : 10000;
            this.attackType = "Physique";
            this.zoneLevel = zoneLevel;
            this.turnCount = 0;
            this.cooldowns = new Map();
            this.weakness = weakness ?? [];
            this.resistance = resistance ?? [];
            this.immunity = immunity ?? [];
        }
    }

    attack(target: Unit, roll: number, critRoll: number | 0): string[] {
        let resultArray: string[] = [];
        let damage: number = 0;
        resultArray.push(`${this.name} attaque ${target.name}`);
        if (roll > 1) {
            damage = this.atk;
            if (roll === 6) {
                resultArray.push(`COUP CRITIQUE !`);
                damage *= 2;
            }
            resultArray.push(`${target.name} subit ${damage} de dommage`);
            target.applyDamage(damage, resultArray);

            if (target.isDead()) resultArray.push(`${target.name} est KO ...`);
        } else {
            resultArray.push(`${this.name} rate son attaque`);
        }
        return resultArray;
    };
    /**
     * Lance un sort (registre `spells_data.json`) sur la cible. Les sorts n'ont
     * pas de portée : un monstre peut les utiliser à distance. Pas de coût en
     * MP pour un monstre (régulation par cooldown, cf. `AIService`).
     * Dégâts = puissance du sort × multiplicateur d'élément (faiblesse /
     * résistance / immunité de la cible). Coup critique si roll = 6.
     */
    useSpellFromName(spellName: string, target: Unit, roll: number, critRoll: number): string[] {
        const spell = spellData.find((s) => s.name === spellName) as Spell | undefined;
        const resultArray: string[] = [`${this.name} lance ${spellName} sur ${target.name}`];
        if (!spell) {
            resultArray.push("Sort introuvable.");
            return resultArray;
        }
        // **Immunité magie** : la cible est insensible aux sorts.
        if (target.status.some(s => s.name === 'Immunité magie')) {
            resultArray.push(`${target.name} est immunisé contre la magie !`);
            return resultArray;
        }
        if (roll === 1) {
            resultArray.push("ECHEC CRITIQUE !");
            return resultArray;
        }
        let damage = 0;
        if (spell.power) {
            const multiplier = calculateDamageMultiplier(this, spell.element, target);
            damage = spell.power * multiplier;
            if (roll === 6) {
                damage *= 2;
                resultArray.push("COUP CRITIQUE !");
            }
            damage = Math.round(damage);
            resultArray.push(messageDamageMultiplier(multiplier));
            resultArray.push(`${target.name} perd ${damage}PV`);
        }
        if (spell.status) {
            applyStatus(this, spell.status, target, roll, resultArray);
        }
        target.applyDamage(damage, resultArray);
        if (target.isDead()) resultArray.push(`${target.name} est KO ...`);
        return resultArray;
    }
    useItem(item: Item, target: Unit): string[] {
        throw new Error("Method not implemented.");
    }
    /**
     * Utilise une compétence de monstre depuis son nom (résolue dans le registre
     * partagé — le même objet Skill que celui qu'un Mage bleu peut apprendre).
     * @param name Le nom de la compétence
     * @param allUnits Le contexte de toutes les unités
     * @returns Le log de toutes les actions effectuées
     */
    useAbilityByName(name: string, allUnits: Unit[], preferredTarget?: Unit): string[] {
        const skill = skillData.find(s => s.name === name) as Skill;
        if (!skill) {
            return ["Compétence introuvable."];
        }
        return this.useAbility(skill, allUnits, preferredTarget);
    }

    /**
     * Retourne les compétences du monstre qui existent **réellement** dans le
     * registre partagé (`blueMage_skills_data.json`). Certaines compétences
     * déclarées dans le bestiaire (ex. "Brasier X") n'y sont pas encore
     * définies : les ignorer évite de perdre un tour sur "Compétence
     * introuvable".
     */
    getValidSkills(): string[] {
        return this.monsterSkills.filter((name) => skillData.some((s) => s.name === name));
    }

    /**
     * Utilise une compétence de monstre aléatoire (choix parmi les compétences
     * valides, c'est-à-dire présentes dans le registre).
     * @param allUnits Le contexte de toutes les unités
     * @returns Le log de toutes les actions effectuées
     */
    useRandomAbility(allUnits: Unit[]): string[] {
        const valid = this.getValidSkills();
        if (valid.length === 0) {
            return ["Aucune compétence à utiliser."];
        }
        const skillName = valid[Math.floor(Math.random() * valid.length)];
        return this.useAbilityByName(skillName, allUnits);
    }

    // ── Capacités & cooldowns (IA des monstres) ────────────────────────────

    /**
     * Informations d'une capacité du monstre, résolue dans le registre des
     * **skills** (`blueMage_skills_data.json`) ou des **sorts**
     * (`spells_data.json`). Retourne `null` si la capacité n'existe dans aucun
     * registre (ex. "Brasier X" non défini).
     */
    getAbilityInfo(name: string): {
        kind: "skill" | "spell";
        range: number;
        move: number;
        power: number;
        apCost: number;
        mpCost: number;
        hpCost: number;
        hasStatus: boolean;
    } | null {
        const skill = skillData.find((s) => s.name === name) as Skill | undefined;
        if (skill) {
            return {
                kind: "skill",
                range: skill.range ?? 0,
                move: skill.move ?? 0,
                power: 0,
                apCost: skill.apCost ?? 0,
                mpCost: skill.mpCost ?? 0,
                hpCost: skill.hpCost ?? 0,
                hasStatus: (skill.status?.length ?? 0) > 0,
            };
        }
        const spell = spellData.find((s) => s.name === name) as Spell | undefined;
        if (spell) {
            return {
                kind: "spell",
                range: 0, // les sorts n'ont pas de portée (à distance)
                move: 0,
                power: spell.power ?? 0,
                apCost: 0,
                mpCost: spell.mpCost ?? 0,
                hpCost: spell.hpCost ?? 0,
                hasStatus: !!spell.status,
            };
        }
        return null;
    }

    /**
     * Cooldown (en tours) d'une capacité : plus elle est puissante, coûteuse
     * (AP/MP/HP) ou à grande portée, plus elle met de temps à se recharger.
     * Une capacité qui applique un statut met **deux fois** plus de temps.
     */
    getCooldownFor(name: string): number {
        const info = this.getAbilityInfo(name);
        if (!info) return 2;
        const base = 2 + (info.power + info.apCost + info.mpCost + info.hpCost + info.range) / 3;
        const cooldown = Math.max(1, Math.round(base));
        return info.hasStatus ? cooldown * 2 : cooldown;
    }

    /** true si la capacité est prête (cooldown écoulé). */
    canUseAbility(name: string): boolean {
        return (this.cooldowns.get(name) ?? 0) <= 0;
    }

    /** Déclenche le cooldown d'une capacité après usage. */
    startCooldown(name: string): void {
        this.cooldowns.set(name, this.getCooldownFor(name));
    }

    /** Décrémente tous les cooldowns de 1 (appelé au début du tour du monstre). */
    tickCooldowns(): void {
        for (const [name, value] of this.cooldowns) {
            if (value > 0) this.cooldowns.set(name, value - 1);
        }
    }

    /** Les capacités du monstre qui existent dans un registre (skills ou sorts). */
    getKnownAbilities(): string[] {
        return this.monsterSkills.filter((name) => this.getAbilityInfo(name) !== null);
    }

    /** Les capacités prêtes (connues + cooldown écoulé). */
    getReadyAbilities(): string[] {
        return this.getKnownAbilities().filter((name) => this.canUseAbility(name));
    }

    /**
     * Les capacités **utilisables** : prêtes (cooldown écoulé) **et** ayant au
     * moins une cible valide à portée (selon `range` + `move` de la
     * compétence). Évite de "perdre" un tour sur une capacité hors de portée.
     */
    getUsableAbilities(allUnits: Unit[]): string[] {
        return this.getReadyAbilities().filter((name) => {
            const skill = skillData.find((s) => s.name === name) as Skill | undefined;
            if (!skill) return true; // les sorts n'ont pas de portée (toujours utilisables)
            return getValidTargets(this, skill, allUnits).length > 0;
        });
    }

    /** true si la capacité est un sort (attaque à distance, pas de portée). */
    isRangedAbility(name: string): boolean {
        return this.getAbilityInfo(name)?.kind === "spell";
    }

    /** true si la capacité rapproche le monstre de sa cible (move > 0). */
    isApproachAbility(name: string): boolean {
        const info = this.getAbilityInfo(name);
        return info?.kind === "skill" && (info.move ?? 0) > 0;
    }

    /** true si la capacité est "Appel à la meute" (spawn, PV < 33%). */
    isSummonAbility(name: string): boolean {
        return name === "Appel à la meute";
    }

    /** true si la capacité est "Explosion" (se tue, PV < 33%). */
    isExplosionAbility(name: string): boolean {
        return name === "Explosion";
    }

}