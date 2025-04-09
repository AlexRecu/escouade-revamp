import { MonsterSpawnRate, Position } from "../classes/Types";
import bestiary from "../config/bestiary_data.json";
import { ZoneType } from "../classes/World/Zone";

export const zoneTypes: ZoneType[] = ["Forest", "Cave", "Tower", "Castle", "Canyon", "FrozenLand"];  

export function calculateEncounterRate(spawnRates: MonsterSpawnRate[]): number {
    const rankWeights: Record<number, number> = {
        1: 12,
        2: 10.5,
        3: 8.75,
        4: 5.33,
        5: 3.25,
        6: 1
    };

    let total = 0;
    const entries = Object.entries(bestiary);
    for (const { monsterName } of spawnRates) {
        const rank = bestiary.find(monster => monster.name === monsterName)?.rank ?? 1;
        total += rankWeights[rank] ?? 1;
    }

    return total / 187.5;
};

export function generateZoneName(type: ZoneType, seed?: number): string {
    const baseNames = {
        Forest: "Sylve Ancienne",
        Cave: "Caverne de l'Écho",
        Tower: "Tour du Savoir",
        Castle: "Château Déchu",
        Canyon: "Falaises d'Erode",
        FrozenLand: "Terres Gelées"
    };
    return `${baseNames[type]} #${Math.floor((seed ?? Math.random() * 1000))}`;
};