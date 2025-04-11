import { MonsterSpawnRate } from "../classes/Types";
import { ZoneType } from "../classes/World/Zone";
import { zoneTypes } from "./ZoneUtils";
import bestiary from "../config/bestiary_data.json";

export function seededRandom(seed?: number): () => number {
    return function () {
        if (seed === undefined) { seed = Math.floor(Math.random() * 1000000); }
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    };
}

export function randomSeed(seed?: number): number {
    return seededRandom(seed)();
}


export function getRandomZoneType(seed?: number): ZoneType {
    const rng = seed ? seededRandom(seed) : Math.random;
    const index = Math.floor(rng() * zoneTypes.length);
    return zoneTypes[index];
}

export function getSpawnRatesForZoneType(type: ZoneType): MonsterSpawnRate[] {
    const typeString = type.toLowerCase() as 'forest' | 'cave' | 'tower' | 'castle' | 'canyon' | 'frozenEarth';
    const entries = Object.entries(bestiary);
    const rates: MonsterSpawnRate[] = [];

    for (const [monsterName, monsterData] of entries) {
        const spawnRate = monsterData.spawn_rates[typeString];
        if (spawnRate && spawnRate > 0) {
            rates.push({ monsterName: monsterName, rate: spawnRate });
        }
    }

    return rates;
}

export function pickRandomItems<T>(array: T[], count: number, rand = Math.random): T[] {
    const shuffled = [...array].sort(() => rand() - 0.5);
    return shuffled.slice(0, count);
}

export function weightedRandomChoice<T>(items: T[], weights: number[]): T {
    const totalWeight = weights.reduce((acc, w) => acc + w, 0);
    const roll = Math.random() * totalWeight;
    let cumulative = 0;

    for (let i = 0; i < items.length; i++) {
        cumulative += weights[i];
        if (roll < cumulative) return items[i];
    }

    return items[items.length - 1]; // fallback
}

/**
 * Effectue un mélange de tableau en se basant sur la méthode Fisher-Yates
 * @param array 
 * @returns le tableau mélangé
 */
export function shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for(let i= result.length-1; i> 0; i--){
        const j = Math.floor(Math.random()*(i+1));
        [result[i],result[j]]=[result[j], result[i]];
    }
    return result;
}