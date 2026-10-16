// src/classes/World/HubState.ts
import { Hub } from "./Hub";
import { Party } from "../Exploration/Party";
import { QuestSystem } from "../Progression/QuestSystem";

/**
 * État d'une session en ville (mode point-and-clic).
 *
 * Règle du livret : en ville, chaque joueur va où il veut (marchand,
 * sanctuaire, auberge, tableau des quêtes…). Quand **tous** les joueurs
 * veulent sortir, l'équipe passe en mode "attente" avant de revenir à la
 * mappemonde.
 *
 * NB : le point-and-clic temps réel est géré au front ; ici on modélise la
 * logique de bout en bout (actions par joueur, mode attente, sortie).
 */
export class HubState {
    hub: Hub;
    party: Party;
    questSystem: QuestSystem;
    /** true si l'équipe est en mode "attente" (tous veulent sortir). */
    waiting: boolean = false;
    /** Nombre de nuits passées à l'auberge (pour le coût). */
    nightsStayed: number = 0;

    constructor(hub: Hub, party: Party, questSystem?: QuestSystem) {
        this.hub = hub;
        this.party = party;
        this.questSystem = questSystem ?? new QuestSystem();
    }

    /** La ville propose-t-elle ce service ? */
    hasService(service: keyof Hub["services"]): boolean {
        return this.hub.hasService(service);
    }

    /** Les services disponibles dans cette ville. */
    getAvailableServices(): string[] {
        return this.hub.getAvailableServices();
    }

    /**
     * Un joueur indique qu'il veut sortir. Quand tous les membres vivants
     * sont en attente, l'équipe passe en mode "attente".
     */
    markPlayerWaiting(): void {
        this.waiting = true;
    }

    /** L'équipe est-elle prête à quitter la ville ? */
    isReadyToLeave(): boolean {
        return this.waiting;
    }

    getSummary(): any {
        return {
            hub: { id: this.hub.id, name: this.hub.name, services: this.hub.services },
            party: {
                id: this.party.id,
                members: this.party.members.map((c) => ({
                    id: c.id,
                    name: c.name,
                    hp: `${c.currentHp}/${c.maxHp}`,
                    mp: `${c.currentMp}/${c.maxMp}`,
                    gold: c.gold,
                })),
            },
            waiting: this.waiting,
            nightsStayed: this.nightsStayed,
        };
    }
}
