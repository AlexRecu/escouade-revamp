import { Monster } from "../../classes/UnitTypes/Monster";
import { Zone } from "../../classes/World/Zone";
import  bestiary  from "../../config/bestiary_data.json";
import { getAvailableMonsterPositions, getRandomAvailablePosition } from "../../utils/PositionUtils";
import { shuffle } from "../../utils/RandomUtils";

/**
 * Génère un groupe de monstres basé sur la zone et ses taux de spawn
 */
// Génère un groupe de monstres basé sur la zone et le niveau des joueurs
export function generateMonsterGroup(zone: Zone, teamSize: number = 1): Monster[] {
  const monsterNames = zone.rollForEncounter(teamSize); // nouvelle méthode
  const monsters: Monster[] = [];

  const shuffledPositions = shuffle(getAvailableMonsterPositions());
  let positionIndex = 0;


  // Optimisation : indexer les monstres une seule fois
  const bestiaryMap = new Map<string, typeof bestiary[number]>();
  for (const entry of bestiary) {
    bestiaryMap.set(entry.name, entry);
  }

  for (const name of monsterNames) {
    const monsterData = bestiaryMap.get(name);
    if (!monsterData) continue;

    const position = shuffledPositions[positionIndex++];
    if(!position) break; // plus de place disponible sur le board

    const monster = new Monster(
      monsterData.rank,
      monsterData.name,
      "Enemy",
      zone.zoneLevel,
      position,
      [],
      monsterData.attack,
      monsterData.atk,
      monsterData.pv,
      monsterData.xp,
      monsterData.gold,
      [], // TODO: ajouter des loots ?
      monsterData.weakness,
      monsterData.resistance,
      monsterData.immunity
    );

    monsters.push(monster);
  }

  return monsters;
}
