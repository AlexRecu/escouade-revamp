import { MonsterSpawnRate } from "../classes/Types";
import bestiary from "../config/bestiary_data.json";
import { ZoneType } from "../classes/World/Zone";
import { STABLE_ZONE_NAMES } from "./RandomUtils";

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

/**
 * Renvoie le **nom narratif stable** d'une zone selon son biome.
 *
 * (Phase C2) Remplace l'ancien nom + suffixe `#N` aléatoire : les zones ont
 * des noms fixes qui correspondent aux lieux du livret et aux cibles des
 * quêtes, pour un matching fiable. `seed` est conservé pour compatibilité de
 * signature mais n'a plus d'effet.
 */
export function generateZoneName(type: ZoneType, _seed?: number): string {
    return STABLE_ZONE_NAMES[type];
};