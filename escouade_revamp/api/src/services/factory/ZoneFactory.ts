import { Campfire } from "../../classes/Progression/Campfire";
import { MonsterSpawnRate } from "../../classes/Types";
import { ZoneType, Zone } from "../../classes/World/Zone";
import { IdGenerator } from "../../utils/IdGeneratorUtils";
import { getRandomZoneType, getSpawnRatesForZoneType, randomSeed } from "../../utils/RandomUtils";
import { DungeonFloor, generateTileMapWithFeatures, generateLakeMap } from "../../utils/TileMapGeneratorUtils";
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
        const seed = params.seed ?? randomSeed();
        const type = params.type ?? getRandomZoneType();
        const name =
            params.name ??
            (params.parentDungeonName && params.floor
                ? `${params.parentDungeonName} E.${params.floor}`
                : generateZoneName(type, seed));

        const id = IdGenerator.generate(name);

        // Le lac a une map fixe (cercle + tuiles de pêche), pas de génération aléatoire.
        if (type === "Lake") {
            const { tileMap, startTile, endTile, fishingTiles } = generateLakeMap();
            return new Zone(
                id,
                name,
                type,
                params.zoneLevel,
                [],            // pas de monstres
                0,             // pas de rencontre aléatoire
                [],            // pas de feu de camp
                seed,
                params.floor || 0,
                tileMap,
                startTile,
                endTile,
                [],            // pas de feux de camp
                params.parentDungeonName,
                [],            // pas d'impasses
                [],            // pas de cases bloquées
                [],            // pas de rencontres spéciales ancrées
                fishingTiles   // 5 tuiles de pêche (croix centrale)
            );
        }

        // Biomes "ouverts" : couloirs plus larges (blocs 2×2 autorisés).
        const wideCorridors = type === "Canyon" || type === "FrozenLand";
        const { tileMap, startTile, endTile, campfires: campfireTiles, deadEnds } = generateTileMapWithFeatures(seed ?? params.zoneLevel, { wideCorridors });

        const spawnRates: MonsterSpawnRate[] = getSpawnRatesForZoneType(type);
        const encounterRate = calculateEncounterRate(spawnRates);
        const checkpoints: Campfire[] = campfireTiles.map(
            (tile, index) => new Campfire(`Feu de camp #${index}`, 0.5, 0.5, tile)
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
            params.parentDungeonName,
            deadEnds
        );
    }

}