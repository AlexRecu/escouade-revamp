import { Campfire } from "../../classes/Progression/Campfire";
import { MonsterSpawnRate } from "../../classes/Types";
import { ZoneType, Zone } from "../../classes/World/Zone";
import { IdGenerator } from "../../utils/IdGeneratorUtils";
import { getRandomZoneType, getSpawnRatesForZoneType, randomSeed, seededRandom } from "../../utils/RandomUtils";
import { DungeonFloor, generateTileMapWithFeatures } from "../../utils/TileMapGeneratorUtils";
import { calculateEncounterRate, generateZoneName } from "../../utils/ZoneUtils";

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

        const id = IdGenerator.generate(name);
        const { tileMap, startTile, endTile, campfires: campfireTiles } = generateTileMapWithFeatures(seed ?? params.zoneLevel);

        const spawnRates: MonsterSpawnRate[] = getSpawnRatesForZoneType(type);
        const encounterRate = calculateEncounterRate(spawnRates);
        const checkpoints: Campfire[] = campfireTiles.map(
            (tile, index) => new Campfire(`Campfire_${id}-#${index}`,`Feu de camp #${index}`,tile)
        );
        
        return new Zone(
            id,
            name,
            type,
            params.zoneLevel,
            spawnRates,
            encounterRate,
            checkpoints,
            seed,
            params.floor || 0,
            tileMap,
            startTile, 
            endTile,
            campfireTiles,
            params.parentDungeonName
        );
    }

}
