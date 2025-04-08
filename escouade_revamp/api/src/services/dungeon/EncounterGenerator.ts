import { Monster } from "../../classes/UnitTypes/Monster";
import { Zone } from "../../classes/World/Zone";
import  bestiary  from "../../config/bestiary_data.json";

/**
 * Génère un groupe de monstres basé sur la zone et ses taux de spawn
 */
export function generateMonsterGroup(zone: Zone): Monster[] {
  const numberOfMonsters = Math.floor(Math.random() * 3) + 1; // 1 à 3 monstres
  const monsters: Monster[] = [];

  for (let i = 0; i < numberOfMonsters; i++) {
    const name = zone.rollForEncounter();
    const monsterData = bestiary.find(b => b.name === name);
    if (monsterData) {
      const monster = new Monster(
        monsterData.rank,
        monsterData.name,
        "Enemy", 
        zone.zoneLevel,
        { row: 0, col: 0 }, // sera positionné ensuite
         [],
         monsterData.attack,
         monsterData.atk,
         monsterData.pv,
         monsterData.xp,
         monsterData.gold,
         [], // TODO : Faire les items pour les monstres
         monsterData.weakness,
         monsterData.resistance,
         monsterData.immunity
      );
      monsters.push(monster);
    }
  }

  return monsters;
}
