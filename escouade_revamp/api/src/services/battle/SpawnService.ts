import { Monster } from "../../classes/UnitTypes/Monster";
import { Unit } from "../../classes/UnitTypes/Unit";
import { Zone } from "../../classes/World/Zone";

// services/SpawnService.ts
class SpawnService {
    spawnWave(zone: Zone, allUnits: Unit[]): Monster[] {
      // Choisir les monstres compatibles avec la zone (depuis config)
      // Appliquer le % de spawn comme probabilité (pondération)
      // Créer des instances de Monster avec une position libre (PositionUtils)
      // Retourner la vague de monstres
    }
  }
  