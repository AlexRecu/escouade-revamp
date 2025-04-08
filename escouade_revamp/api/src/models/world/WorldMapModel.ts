import { WorldMap } from "../../classes/World/WorldMap";

export async function saveWorldMapToDB(worldMap: WorldMap): Promise<void> {
  // transforme les objets en format Mongo ou SQL-friendly puis save
  // par exemple : persist zones, hubs, edges dans des tables ou collections séparées
}