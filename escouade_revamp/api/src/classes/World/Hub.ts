// src/classes/World/Hub.ts

import { HubServices, HubLayout } from "../Types";

const generateRandomServices = (): HubServices => ({
    shop: Math.random() > 0.3,
    inn: true,
    church: Math.random() > 0.5,
    questBoard: Math.random() > 0.6
});

export class Hub {
    id: string;
    name: string;
    services: {
        shop: boolean;
        inn: boolean;
        church: boolean;
        questBoard: boolean;
    };
    /** Layout de la ville (grille de tuiles + bâtiments + sortie). */
    layout: HubLayout | null = null;

    constructor(
        id: string,
        name: string,
        services?: HubServices,
        layout?: HubLayout | null
    ) {
        this.id = id;
        this.name = name;
        this.services = services ?? generateRandomServices();
        this.layout = layout ?? null;
    }

    hasService(serviceName: keyof Hub["services"]): boolean {
        return this.services[serviceName];
    }

    getAvailableServices(): string[] {
        return Object.entries(this.services)
            .filter(([_, available]) => available)
            .map(([service]) => service);
    }
}