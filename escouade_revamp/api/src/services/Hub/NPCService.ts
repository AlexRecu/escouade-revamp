// src/services/Hub/NPCService.ts
import { HubState } from "../../classes/World/HubState";
import { Character } from "../../classes/UnitTypes/Character";
import { Quest } from "../../classes/Progression/QuestSystem";
import { QuestService } from "../Progression/QuestService";

/**
 * PNJ de ville (Phase 2 — reste du mode ville).
 *
 *  - **Résidences PNJ** : Alfonso (classes hautes), Quartemino (invocations /
 *    démons / astromancie), Franny (retrouver sa sœur — quête Adrammelech).
 *  - **Guilde des voleurs** : accès si un Voleur porte la pièce marquée OU un
 *    membre a Charisme ≥ 5, puis roll ≥ 11.
 *  - **Voyante** : contre or, une indication sur le prochain objectif.
 */

/** Informations fournies par les résidents (livret). */
const RESIDENT_INFO: Record<string, string> = {
    Alfonso: "Alfonso détaille les classes hautes et leurs évolutions (Sage Noir, Démoniste, etc.).",
    Quartemino: "Quartemino parle des invocations, des démons et des cartes d'astromancie.",
    Franny: "Franny cherche sa sœur disparue dans les bois. (Quête : Adrammelech — upgrade Démoniste uniquement.)",
};

/** Coût de la voyante (livret : 10 gold). */
const SEER_COST = 10;

export class NPCService {
    /**
     * Parler à un résident (résidences PNJ).
     * @returns les logs (l'information fournie).
     */
    static talkToResident(hub: HubState, residentName: string): string[] {
        const info = RESIDENT_INFO[residentName];
        if (!info) {
            return [`"${residentName}" n'est pas un résident connu de ${hub.hub.name}.`];
        }
        // Quêtes : parler à un résident complète les étapes `talk` correspondantes.
        QuestService.onTalk(hub.questSystem, residentName);
        return [info];
    }

    /**
     * Parler à un PNJ (donneur de quête, résident, etc.).
     *
     * Signale l'événement `talk` au système de quêtes (étapes `talk` dont la
     * cible correspond au nom du PNJ). Renvoie le dialogue du PNJ s'il est
     * connu, sinon un message générique.
     *
     * @param hub l'état de la ville (fournit le système de quêtes).
     * @param npcName le nom du PNJ (doit correspondre à la cible de l'étape).
     * @param dialogue le dialogue à afficher (optionnel).
     */
    static talkToNpc(
        hub: HubState,
        npcName: string,
        dialogue?: string
    ): string[] {
        // Quêtes : signale la conversation (étapes `talk`).
        QuestService.onTalk(hub.questSystem, npcName);
        if (dialogue) return [dialogue];
        const info = RESIDENT_INFO[npcName];
        return info ? [info] : [`${npcName} vous adresse la parole.`];
    }

    /**
     * Accès à la guilde des voleurs.
     *
     * Condition (livret) : un Voleur de l'équipe porte la **pièce marquée**,
     * OU un membre a **Charisme ≥ 5** ; puis un **roll ≥ 11** est requis.
     *
     * @param roll le résultat du roll (ex. somme de 2d6).
     */
    static thievesGuildAccess(hub: HubState, roll: number): { granted: boolean; logs: string[] } {
        const logs: string[] = [];
        const party = hub.party.members;

        const thiefWithPiece = party.some(
            (c) => c.job.name === "Voleur" && c.bag.some((i) => i.name === "Pièce marquée")
        );
        const highCharisma = party.some((c) => c.stats.charisma >= 5);

        if (!thiefWithPiece && !highCharisma) {
            logs.push("Accès refusé : il faut un Voleur avec la pièce marquée ou un Charisme ≥ 5.");
            return { granted: false, logs };
        }

        if (roll < 11) {
            logs.push(`Le gardien de la guilde vous repousse (roll ${roll} < 11).`);
            return { granted: false, logs };
        }

        logs.push("La guilde des voleurs vous ouvre ses portes (armes de rareté 4).");
        return { granted: true, logs };
    }

    /**
     * Consulter la voyante : une indication sur le prochain objectif.
     * @param cost coût de la consultation (défaut 10 gold).
     */
    static consultSeer(hub: HubState, payer: Character, cost: number = SEER_COST): string[] {
        const logs: string[] = [];
        if (hub.party.gold < cost) {
            logs.push(`L'équipe n'a pas assez d'or pour la voyante (${hub.party.gold}/${cost}).`);
            return logs;
        }

        const hint = this.nextObjectiveHint(hub);
        hub.party.gold -= cost;
        logs.push(`La voyante murmure : « ${hint} » (${cost} gold).`);
        return logs;
    }

    /**
     * Indication sur le prochain objectif : prochaine étape de la première
     * quête acceptée, sinon un conseil générique.
     */
    private static nextObjectiveHint(hub: HubState): string {
        const accepted = hub.questSystem.allQuests().find((q) => q.accepted && !q.completed);
        if (accepted) {
            const step = accepted.nextStep();
            if (step) return step.description;
        }
        return "Les routes mènent vers l'inconnu. Explorez les donjons.";
    }
}
