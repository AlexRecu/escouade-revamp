import { Dungeon } from "../../classes/World/Dungeon";
import { ZoneType, Zone } from "../../classes/World/Zone";
import { ZoneFactory } from "./ZoneFactory";

export class DungeonFactory {
    static create(params: {
      name: string;
      type: ZoneType;
      level: number;
      floors: number;
      seed?: number;
    }): Dungeon {
      const zones: Zone[] = [];
  
      for (let floor = 1; floor <= params.floors; floor++) {
        const zone = ZoneFactory.create({
          name: `${params.name} E.${floor}`,
          type: params.type,
          zoneLevel: params.level,
          seed: params.seed,
          parentDungeonName: params.name,
          floor
        });
        zones.push(zone);
      }
  
      return new Dungeon(
        // Id déterministe (stable entre générations) : chaque biome n'apparaît
        // qu'une fois dans le monde, donc `Dungeon_<biome>` est unique. C'est
        // ce qui rend `completedZones` (qui stocke ces ids) stable dans le temps.
        `Dungeon_${params.type}`,
        params.name,
        params.level,
        params.type,
        zones        
      );
    }
  }