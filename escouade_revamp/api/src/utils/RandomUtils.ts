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