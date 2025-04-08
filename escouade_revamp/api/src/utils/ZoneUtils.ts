import { Campfire } from "../classes/Progression/Campfire";
import { MonsterSpawnRate } from "../classes/Types";
import { IdGenerator } from "./IdGeneratorUtils";
import { seededRandom } from "./RandomUtils";
import bestiary from "../config/bestiary_data.json";
import { ZoneType } from "../classes/World/Zone";

export const zoneTypes: ZoneType[] = ["Forest", "Cave", "Tower", "Castle", "Canyon", "FrozenLand"];


export function generateCampfires(seed?: number): Campfire[] {
    const rng = seed ? seededRandom(seed) : Math.random;
    const count = 1 + Math.floor(rng() * 3); // 1 à 3 checkpoints
    const campfires: Campfire[] = [];

    for (let i = 0; i < count; i++) {
        campfires.push(new Campfire(`${IdGenerator.generate("Campfire")} Feu de camp #${i + 1}`));
    }

    return campfires;
};

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