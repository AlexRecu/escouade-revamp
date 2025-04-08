import { Campfire } from "../Progression/Campfire";
import { Zone, ZoneType } from "./Zone";

export class Dungeon {
    constructor(
      public id: string,
      public name: string,
      public zoneLevel: number,
      public biome: ZoneType,
      public levels: Zone[], // chaque niveau est une sous-zone
      public seed?: number
    ) {
      this.id = id, 
      this.name = name, 
      this.zoneLevel = zoneLevel; 
      this.biome = biome;
      this.levels = levels;
      this.seed = seed;
    }
  }
  