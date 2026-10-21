// src/services/factory/ItemFactory.ts
import { Item } from "../../classes/Items/Item";
import { Consumable } from "../../classes/Items/Consumable";
import { Weapon } from "../../classes/Items/Weapon";
import { Status } from "../../classes/Status";
import { IdGenerator } from "../../utils/IdGeneratorUtils";
import allItems from "../../config/all_items.json";
import statusesData from "../../config/statuses_data.json";

/**
 * Fabrique des objets à partir des données de `all_items.json`.
 *
 * Permet au mode ville (marchand) de créer de vrais objets (consommables,
 * armes) à l'achat, au lieu de simples entrées `Item` génériques.
 */
export class ItemFactory {
    /** Données brutes des objets (chargées depuis le JSON). */
    static readonly DATA: any[] = allItems as any[];

    /** Renvoie les données brutes d'un objet par son nom. */
    static findData(name: string): any | undefined {
        return this.DATA.find((d) => d.name === name);
    }

    /** Renvoie les noms de tous les objets d'un type (ex. "Consommable"). */
    static namesByType(type: string): string[] {
        return this.DATA.filter((d) => d.type === type).map((d) => d.name);
    }

    /**
     * Fabrique un objet à partir de son nom (recherche dans le JSON).
     * @returns l'objet, ou null si introuvable.
     */
    static create(name: string): Item | null {
        const data = this.findData(name);
        if (!data) return null;
        return this.fromData(data);
    }

    /** Fabrique un objet à partir d'une entrée du JSON. */
    static fromData(data: any): Item | null {
        const id = `${data.name}_${IdGenerator.generateId()}`;
        const price = data.purchasePrice ?? 0;
        const threshold = data.zoneThreshold ?? 0;

        if (data.type === "Consommable") {
            return this.createConsumable(id, data, price, threshold);
        }
        if (data.type === "Arme") {
            return this.createWeapon(id, data, price, threshold);
        }
        // Repli : objet générique.
        return new Item(id, data.name, "consumable", data.effect ?? "", price, threshold);
    }

    private static createConsumable(id: string, data: any, price: number, threshold: number): Consumable {
        const c = new Consumable(id, data.name, data.effect ?? "", price, threshold, 0, 0, false, []);
        const effect = (data.effect ?? "").toLowerCase();

        // Soins de vie.
        if (effect.includes("tous les points de vie") || effect.includes("tous les points de vie et")) {
            c.fullHeal = true;
        } else if (effect.includes("moitié des points de vie")) {
            c.hpPercent = 0.5;
        } else if (effect.includes("points de vie")) {
            c.hp = this.extractAmount(effect, "points de vie") ?? 5;
        }

        // Soins de mana.
        if (effect.includes("tous les points de mana") || effect.includes("tous les points de vie et de mana")) {
            c.fullMp = true;
        } else if (effect.includes("points de mana") || effect.includes("points de magie")) {
            c.mp = this.extractAmount(effect, "points de mana") ?? this.extractAmount(effect, "points de magie") ?? 3;
        }

        // Réanimation.
        if (effect.includes("ranime")) {
            c.revive = true;
            if (effect.includes("moitié")) c.hpPercent = 0.5;
        }

        // Soins de statut.
        if (effect.includes("poison") || effect.includes("empoisonn")) c.healingStatus.push("Poison");
        if (effect.includes("aveugl")) c.healingStatus.push("Aveuglement");
        if (effect.includes("mutisme")) c.healingStatus.push("Mutisme");
        if (effect.includes("fossile")) c.healingStatus.push("Fossile");
        if (effect.includes("toutes les altérations")) c.healingStatus = ["Poison", "Aveuglement", "Mutisme", "Fossile"];

        return c;
    }

    private static createWeapon(id: string, data: any, price: number, threshold: number): Weapon {
        const status = this.buildWeaponStatus(data.status);
        return new Weapon(
            id,
            data.name,
            data.effect ?? "",
            price,
            threshold,
            this.normalizeWeaponType(data.subType),
            data.mainStat ?? "Force",
            data.subStat ?? "",
            data.weaponStat ?? 1,
            data.weaponSubStat ?? 0,
            data.range ?? 1,
            data.element ?? "",
            status
        );
    }

    /**
     * Construit un objet `Status` à partir du **nom** du statut d'arme.
     *
     * Le JSON `all_items.json` stocke `status` comme une simple string
     * (ex. `"Saignée"`). Sans cette conversion, `weapon.status` restait une
     * string et le test `weapon.status.chance` dans `handleWeaponAttack`
     * était `undefined` → le statut d'arme n'était **jamais** appliqué
     * (Saignée ne drainait pas, Poison n'empoisonnait pas, etc.).
     *
     * `chance` est fixé à 10 : le statut se déclenche à chaque attaque qui
     * touche la cible.
     */
    static buildWeaponStatus(statusName: string | null | undefined): Status | null {
        if (!statusName) return null;
        const def = (statusesData as any[]).find((s) => s.name === statusName);
        const status = new Status();
        status.name = statusName;
        status.statusType = def?.statusType ?? "curse";
        status.nbTurnEffect = def?.nbTurnEffect ?? null;
        status.chance = 10;
        return status;
    }

    /**
     * Normalise le type d'arme (JSON `subType` → clé interne sans accents).
     *
     * Le JSON utilise des libellés lisibles ("Épée", "Katana", "Poings"…) mais
     * les classes de job (`job.weapons`) et les constructeurs d'armes utilisent
     * des clés normalisées sans accents ("epee", "katana", "poing"…). Sans cette
     * normalisation, `Character.equipRightHand`/`equipLeftHand` ne matchent
     * JAMAIS (le matching `job.weapons.some(w => weapon.weaponType === w)`
     * échoue) → impossible d'équiper une arme achetée.
     */
    private static normalizeWeaponType(subType: string | undefined): string {
        const key = (subType ?? "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
        const map: Record<string, string> = {
            epee: "epee",
            katana: "katana",
            marteau: "marteau",
            masse: "masse",
            lance: "lance",
            poing: "poing",
            poings: "poing",
            dague: "dague",
            arc: "arc",
            sceptre: "sceptre",
        };
        return map[key] ?? key;
    }

    /** Extrait un montant numérique précédant un mot-clé (ex. "5 points de vie"). */
    private static extractAmount(text: string, keyword: string): number | null {
        const idx = text.indexOf(keyword);
        if (idx === -1) return null;
        const before = text.slice(0, idx);
        const match = before.match(/(\d+)\s*$/);
        return match ? parseInt(match[1], 10) : null;
    }
}
