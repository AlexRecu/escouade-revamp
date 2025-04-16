import { Item } from "../../classes/Items/Item";
import { Weapon } from "../../classes/Items/Weapon";
import { Job } from "../../classes/Jobs/Job";
import { Status } from "../../classes/Status";
import { Position } from "../../classes/Types";
import { Character } from "../../classes/UnitTypes/Character";
import { JobFactory } from "./JobFactory";

export class CharacterFactory {
    static fromSerialized(data: any): Character {
      const job: Job = JobFactory.fromSerialized(data.classe);
      const position: Position = data.position ?? { row: 0, col: 0 };
  
      const rightHand = data.rightHand ? this.deserializeWeapon(data.rightHand) : null;
      const leftHand = data.leftHand ? this.deserializeWeapon(data.leftHand) : null;
  
      const items = (data.items ?? []).map((itemData: any) =>
        itemData.type === 'weapon'
          ? this.deserializeWeapon(itemData)
          : new Item(
              itemData.id,
              itemData.name,
              itemData.type,
              itemData.description,
              itemData.purchasePrice,
              itemData.zoneThreshold
            )
      );
  
      const char = new Character(
        data.id,
        data.name,
        data.type ?? "Hero",
        position,
        data.currentHp,
        data.maxHp,
        data.status ?? [],
        data.currentMp ?? 0,
        data.maxMp ?? 0,
        data.currentAp ?? 10,
        data.maxAp ?? 10,
        job,
        rightHand,
        leftHand,
        items
      );
  
      char.characterLevel = data.characterLevel ?? 1;
      char.stats = data.stats ?? job.defaultStats;
  
      return char;
    }
  
    private static deserializeWeapon(data: any): Weapon {
      return new Weapon(
        data.id,
        data.name,
        data.description,
        data.purchasePrice,
        data.zoneThreshold,
        data.weaponType,
        data.mainStat,
        data.subStat,
        data.weaponStat,
        data.weaponSubStat,
        data.range,
        data.element,
        data.status as Status | null
      );
    }
  }