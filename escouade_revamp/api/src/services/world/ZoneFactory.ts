import { Campfire } from "../../classes/Progression/Campfire";
import { MonsterSpawnRate } from "../../classes/Types";
import { ZoneType, Zone } from "../../classes/World/Zone";
import bestiary from "../../config/bestiary_data.json";
import { IdGenerator } from "../../utils/IdGeneratorUtils";
import { getRandomZoneType, getSpawnRatesForZoneType, randomSeed, seededRandom } from "../../utils/RandomUtils";
import { calculateEncounterRate, generateCampfires, generateZoneName, zoneTypes } from "../../utils/ZoneUtils";

export class ZoneFactory {
    // 🎲 Liste possible de types pour génération aléatoire
    static create(params: {
        name?: string;
        type?: ZoneType;
        zoneLevel: number;
        seed?: number;
        parentDungeonName?: string;
        floor?: number;
    }): Zone {
        const seed = params.seed ?? seededRandom()();
        const type = params.type ?? getRandomZoneType();
        const name =
            params.name ??
            (params.parentDungeonName && params.floor
                ? `${params.parentDungeonName} E.${params.floor}`
                : generateZoneName(type, seed));

        const spawnRates: MonsterSpawnRate[] = getSpawnRatesForZoneType(type);
        const encounterRate = calculateEncounterRate(spawnRates);
        const checkpoints: Campfire[] = generateCampfires(seed);

        return new Zone(
            IdGenerator.generate(name),
            name,
            type,
            params.zoneLevel,
            spawnRates,
            encounterRate,
            checkpoints,
            seed,
            params.parentDungeonName,
            params.floor
        );
    }

}
