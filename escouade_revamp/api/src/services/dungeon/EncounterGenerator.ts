import { Monster } from "../../classes/UnitTypes/Monster";
import { Zone } from "../../classes/World/Zone";
import  bestiary  from "../../config/bestiary_data.json";

/**
 * Matérialise un groupe de monstres à partir d'une liste de noms (décidée par
 * l'`EncounterEngine`) et du niveau de la zone.
 *
 * NB : le *nombre* et le *choix* des monstres relèvent de l'`EncounterEngine`
 * (formule du livret + gaussien de la zone). Cette fonction ne fait que créer
 * les objets `Monster` correspondants.
 */
export function generateMonsterGroup(zone: Zone, names: string[]): Monster[] {
  const monsters: Monster[] = [];

  for (const name of names) {
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
        [], // Les monstres ne lâchent pas d'items (livret : butin = Gold + XP seulement).
        monsterData.weakness,
        monsterData.resistance,
        monsterData.immunity
      );
      monsters.push(monster);
    }
  }

  return monsters;
}
