// src/services/Hub/HubService.ts
import { HubState } from "../../classes/World/HubState";
import { Character } from "../../classes/UnitTypes/Character";
import { Item } from "../../classes/Items/Item";
import { Consumable } from "../../classes/Items/Consumable";
import { ItemFactory } from "../factory/ItemFactory";
import { JobFactory } from "../factory/JobFactory";
import { IdGenerator } from "../../utils/IdGeneratorUtils";
import { Quest } from "../../classes/Progression/QuestSystem";

/** Coût par défaut d'une nuit à l'auberge (livret : 20 gold). */
const INN_COST = 20;
/** Coût par défaut du sanctuaire pour ranimer un allié (livret : 200 gold). */
const SANCTUARY_COST = 200;
/** Coût de location d'un PNJ classe basse (livret : 100 gold). */
const HIRE_LOW_COST = 100;
/** Coût de location d'un PNJ haute classe (livret : 200 gold). */
const HIRE_HIGH_COST = 200;
/** Coût de la caravane (livret : 20 gold). */
const CARAVAN_COST = 20;

/** Jobs de PNJ classe basse (location 100 gold). */
const LOW_CLASS_JOBS = ["Guerrier", "Voleur", "Moine"];
/** Jobs de PNJ haute classe (location 200 gold). */
const HIGH_CLASS_JOBS = ["Mage blanc", "Mage noir", "Mage rouge", "Mage bleu"];

/**
 * Services de ville (Phase 2 — cœur du mode ville).
 *
 *  - **Marchand** : achat / revente de consommables (stock infini).
 *  - **Auberge** : repos complet (PV/MP) contre or.
 *  - **Sanctuaire** : ranime un allié mort contre or.
 *  - **Tableau des quêtes** : liste des quêtes disponibles.
 *
 * Le point-and-clic temps réel est au front ; ici on expose la logique
 * métier testable, action par action.
 */
export class HubService {
    /**
     * Achat d'un objet (consommable **ou** arme).
     *
     * ⚠️ Le filtrage par `zoneThreshold` (ne pas vendre d'objet trop puissant
     * pour le niveau du monde) est fait **côté front** (l'inventaire est déjà
     * filtré) ; ici on accepte tout objet du JSON pour rester simple et
     * testable.
     * @returns les logs de l'opération.
     */
    static buyConsumable(hub: HubState, buyer: Character, itemName: string): string[] {
        const logs: string[] = [];
        if (!hub.hasService("shop")) {
            logs.push("Cette ville n'a pas de marchand.");
            return logs;
        }
        const data = ItemFactory.findData(itemName);
        if (!data || (data.type !== "Consommable" && data.type !== "Arme")) {
            logs.push(`"${itemName}" n'est pas en vente ici.`);
            return logs;
        }
        const price = data.purchasePrice ?? 0;
        if (hub.party.gold < price) {
            logs.push(`L'équipe n'a pas assez d'or (${hub.party.gold}/${price}).`);
            return logs;
        }

        const item = ItemFactory.create(itemName);
        if (!item) {
            logs.push(`Impossible de créer "${itemName}".`);
            return logs;
        }
        hub.party.gold -= price;
        buyer.bag.push(item);
        logs.push(`${buyer.name} achète ${itemName} pour ${price} gold.`);
        return logs;
    }

    /**
     * Revente d'un objet du sac.
     * Règle du livret : revente = prix/2 par défaut ; Charisme ≥ 6 → prix
     * d'achat ; Charisme = 10 → 1,5× le prix d'achat.
     * @returns les logs de l'opération.
     */
    /** Objets de **classe** : ne peuvent pas être revendus (donnés à la création). */
    private static readonly CLASS_ITEMS = new Set(["Monstronomicon", "Pièce marquée", "Bouclier"]);

    static sellItem(hub: HubState, seller: Character, item: Item): string[] {
        const logs: string[] = [];
        if (!hub.hasService("shop")) {
            logs.push("Cette ville n'a pas de marchand.");
            return logs;
        }
        if (this.CLASS_ITEMS.has(item.name)) {
            logs.push(`"${item.name}" est un objet de classe : il ne peut pas être revendu.`);
            return logs;
        }
        // Une arme équipée reste dans le sac (référence partagée) : on ne peut
        // pas la revendre tant qu'elle est portée (main droite ou gauche).
        const equipped =
            seller.rightHandWeapon?.id === item.id || seller.leftHandWeapon?.id === item.id;
        if (equipped) {
            logs.push(`"${item.name}" est équipée : déséquipez-la avant de la revendre.`);
            return logs;
        }
        const idx = seller.bag.findIndex((i) => i.id === item.id);
        if (idx === -1) {
            logs.push(`${seller.name} n'a pas cet objet.`);
            return logs;
        }

        const charisma = seller.stats.charisma;
        let resale: number;
        if (charisma >= 10) {
            resale = Math.floor(item.purchasePrice * 1.5);
        } else if (charisma >= 6) {
            resale = item.purchasePrice;
        } else {
            resale = item.resaleBase;
        }

        seller.bag.splice(idx, 1);
        hub.party.gold += resale;
        logs.push(`${seller.name} revend ${item.name} pour ${resale} gold.`);
        return logs;
    }

    /**
     * Nuit à l'auberge : soin complet (PV/MP) contre or.
     * @param cost coût de la nuit (défaut 20 gold).
     */
    static restAtInn(hub: HubState, guest: Character, cost: number = INN_COST): string[] {
        const logs: string[] = [];
        if (!hub.hasService("inn")) {
            logs.push("Cette ville n'a pas d'auberge.");
            return logs;
        }
        if (hub.party.gold < cost) {
            logs.push(`L'équipe n'a pas assez d'or pour l'auberge (${hub.party.gold}/${cost}).`);
            return logs;
        }
        hub.party.gold -= cost;
        guest.currentHp = guest.maxHp;
        guest.currentMp = guest.maxMp;
        hub.nightsStayed++;
        logs.push(`${guest.name} passe la nuit à l'auberge (${cost} gold). PV et MP restaurés.`);
        return logs;
    }

    /**
     * Sanctuaire : ranime un allié mort contre or.
     * @param target l'allié à ranimer.
     * @param cost coût du rituel (défaut 200 gold).
     */
    static useSanctuary(hub: HubState, payer: Character, target: Character, cost: number = SANCTUARY_COST): string[] {
        const logs: string[] = [];
        if (!hub.hasService("church")) {
            logs.push("Cette ville n'a pas de sanctuaire.");
            return logs;
        }
        if (!target.isDead()) {
            logs.push(`${target.name} n'est pas mort.`);
            return logs;
        }
        if (hub.party.gold < cost) {
            logs.push(`L'équipe n'a pas assez d'or pour le sanctuaire (${hub.party.gold}/${cost}).`);
            return logs;
        }
        hub.party.gold -= cost;
        // Ranime à la moitié des PV max.
        target.currentHp = Math.floor(target.maxHp / 2);
        logs.push(`Le sanctuaire ranime ${target.name} (moitié des PV max, ${cost} gold).`);
        return logs;
    }

    /**
     * Tableau des quêtes : liste les quêtes disponibles pour l'équipe.
     * @param recruitedDemons noms des démons déjà recrutés.
     */
    static questBoard(hub: HubState, recruitedDemons: string[] = []): Quest[] {
        if (!hub.hasService("questBoard")) {
            return [];
        }
        return hub.questSystem.availableQuests(hub.party.members, recruitedDemons);
    }

    /**
     * Accepte une quête depuis le tableau.
     * @returns la quête acceptée, ou null.
     */
    static acceptQuest(hub: HubState, questId: string, recruitedDemons: string[] = []): Quest | null {
        if (!hub.hasService("questBoard")) return null;
        return hub.questSystem.acceptQuest(questId, hub.party.members, recruitedDemons);
    }

    /**
     * Location d'un PNJ (guilde) : un mercenaire rejoint l'équipe contre or.
     * @param tier "low" (100 gold) ou "high" (200 gold).
     * @param jobName nom du job à louer (ex. "Guerrier").
     * @returns le PNJ recruté, ou null.
     */
    static hireNPC(
        hub: HubState,
        payer: Character,
        tier: "low" | "high",
        jobName: string
    ): { npc: Character | null; logs: string[] } {
        const logs: string[] = [];
        const cost = tier === "low" ? HIRE_LOW_COST : HIRE_HIGH_COST;
        const allowed = tier === "low" ? LOW_CLASS_JOBS : HIGH_CLASS_JOBS;

        if (!allowed.includes(jobName)) {
            logs.push(`"${jobName}" n'est pas disponible en location ${tier === "low" ? "classe basse" : "haute classe"}.`);
            return { npc: null, logs };
        }
        if (hub.party.gold < cost) {
            logs.push(`L'équipe n'a pas assez d'or pour la location (${hub.party.gold}/${cost}).`);
            return { npc: null, logs };
        }

        const job = JobFactory.fromSerialized({ name: jobName });
        const npc = new Character(
            IdGenerator.generate("NPC"),
            `${jobName} (mercenaire)`,
            "Hero",
            { row: 0, col: 0 },
            job,
            null,
            null
        );
        hub.party.gold -= cost;
        hub.party.members.push(npc);
        logs.push(`${npc.name} rejoint l'équipe (${cost} gold).`);
        return { npc, logs };
    }

    /**
     * Vol aux marchands : un Voleur tente de voler de l'or au marchand.
     * @param roll le roll du vol (réussite si ≥ 11).
     * @param amount montant volé en cas de succès (défaut 50 gold).
     */
    static attemptSteal(hub: HubState, thief: Character, roll: number, amount: number = 50): string[] {
        const logs: string[] = [];
        if (!hub.hasService("shop")) {
            logs.push("Il n'y a pas de marchand ici.");
            return logs;
        }
        if (thief.job.name !== "Voleur") {
            logs.push(`${thief.name} n'est pas un Voleur.`);
            return logs;
        }
        if (roll < 11) {
            logs.push(`Le vol échoue (roll ${roll} < 11) : le marchand s'en aperçoit.`);
            return logs;
        }
        hub.party.gold += amount;
        logs.push(`${thief.name} vole ${amount} gold au marchand.`);
        return logs;
    }

    /**
     * Caravane : déplacement de ville à ville contre or, avec risque d'attaque.
     * Règle du livret : roll 1 = attaque de brûleur, 2-3 = gobelins, 5-6 = tranquille.
     *
     * NB : le changement effectif de ville (WorldMap) est géré par l'appelant ;
     * cette méthode calcule le coût et le résultat du voyage.
     *
     * @param destinationHubId identifiant de la ville de destination.
     * @param roll le roll du voyage.
     */
    static takeCaravan(
        hub: HubState,
        payer: Character,
        destinationHubId: string,
        roll: number
    ): { success: boolean; threat: "burner" | "goblins" | "none"; logs: string[] } {
        const logs: string[] = [];
        if (hub.party.gold < CARAVAN_COST) {
            logs.push(`L'équipe n'a pas assez d'or pour la caravane (${hub.party.gold}/${CARAVAN_COST}).`);
            return { success: false, threat: "none", logs };
        }

        hub.party.gold -= CARAVAN_COST;
        let threat: "burner" | "goblins" | "none";
        if (roll === 1) {
            threat = "burner";
            logs.push("⚠️ La caravane est attaquée par un brûleur !");
        } else if (roll >= 2 && roll <= 3) {
            threat = "goblins";
            logs.push("⚠️ La caravane est attaquée par des gobelins !");
        } else {
            threat = "none";
            logs.push(`La caravane arrive tranquillement à la destination (${destinationHubId}).`);
        }
        return { success: true, threat, logs };
    }
}
