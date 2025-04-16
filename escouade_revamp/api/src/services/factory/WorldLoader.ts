// src/services/world/WorldLoader.ts
import { WorldMap } from "../../classes/World/WorldMap";
import { Zone, ZoneType } from "../../classes/World/Zone";
import { Hub } from "../../classes/World/Hub";
import { ZoneFactory } from "./ZoneFactory";
import { IdGenerator } from "../../utils/IdGeneratorUtils";
import { saveWorldMapToDB } from "../../models/world/WorldMapModel";
import { DungeonFactory } from "./DungeonFactory";
import { Dungeon } from "../../classes/World/Dungeon";

const ZONE_NAMES = [
    "Forêt", "Grotte", "Tour", "Château", "Canyon", "Terre Gelée"
];
const HUB_NAMES = [
    "Auberge du matin", "Qual-Mastrech", "Qual-Chen", "Qual-Far"
];

const ZONE_TYPES: ZoneType[] = ["Forest", "Cave", "Tower", "Castle", "Canyon", "FrozenLand"];

export class WorldLoader {
    static async generate(seed?: number): Promise<WorldMap> {
        const worldMap = new WorldMap();
        const hubs: Hub[] = [
            new Hub(IdGenerator.generate("Hub"), "Auberge du Matin"),
            new Hub(IdGenerator.generate("Hub"), "Qual-Mastrech"),
            new Hub(IdGenerator.generate("Hub"), "Qual-Chen"),
            new Hub(IdGenerator.generate("Hub"), "Qual-Far")
        ];

        hubs.forEach(hub => worldMap.nodes.push(hub));

        let zoneList: Zone[] = [];
        let dungeonList: Dungeon[] = []
        let zoneLevel: number = 1;
        const zoneTypes = [...ZONE_TYPES].sort(() => Math.random() - 0.5);
        for (const biome of zoneTypes) {
            const params = {
                type: biome,
                zoneLevel: zoneLevel,
                seed: seed
            }
            zoneList.push(ZoneFactory.create(params));
            zoneLevel++;
        }
        zoneLevel =1;
        for (const zone of zoneList) {
            dungeonList.push(DungeonFactory.create(
                {
                    name: zone.name,
                    level: zone.zoneLevel,
                    type: zone.biome,
                    floors: Math.min(3+zoneLevel *1.5,10),
                    seed: seed
                }));
            zoneLevel++;
        }

        // Ajout des zones
        worldMap.nodes.push(...dungeonList);

        // Connexions (graphe non linéaire)
        let index = 0;
        let dungeonIndex = 0;
        for (const dungeon of dungeonList) {
            worldMap.addConnection(hubs[index].id, dungeon.id);
            dungeon.levels.forEach((level, i) => {
                if (i < dungeon.levels.length - 1) worldMap.addConnection(level.id, dungeon.levels[i + 1].id);
            });
            if (index < hubs.length) {
                worldMap.addConnection(dungeon.id, hubs[Math.floor(Math.random() * 3) + index].id);

            } else if (dungeonIndex !== dungeonList.length) {
                index = 0;
                worldMap.addConnection(dungeon.id, hubs[Math.floor(Math.random() * 3)].id);
            }
            index++;
            dungeonIndex++;
        }

        // Sauvegarde en BDD
        await saveWorldMapToDB(worldMap);

        return worldMap;
    }
}
