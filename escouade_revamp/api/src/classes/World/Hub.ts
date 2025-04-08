// src/classes/World/Hub.ts

import { HubServices } from "../Types";

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

    constructor(
        id: string,
        name: string,
        services?: HubServices
    ) {
        this.id = id;
        this.name = name;
        this.services = services ?? generateRandomServices();
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
