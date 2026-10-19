import { Item } from "../../classes/Items/Item";
import { Weapon } from "../../classes/Items/Weapon";
import { Consumable } from "../../classes/Items/Consumable";
import { Tools } from "../../classes/Items/Tools";
import { Job } from "../../classes/Jobs/Job";
import { BlackMage } from "../../classes/Jobs/BlackMage";
import { Status } from "../../classes/Status";
import { Position } from "../../classes/Types";
import { Character } from "../../classes/UnitTypes/Character";
import { JobFactory } from "./JobFactory";

/**
 * Fabrique / (dé)sérialise des `Character`.
 *
 * La sérialisation est **complète** (round-trip) : elle capture tout l'état
 * nécessaire pour reconstruire un personnage identique — PV/MP/AP, XP, or,
 * niveau, stats, statuts, job (niveau + évolution + pactes), armes et sac.
 */
export class CharacterFactory {
  /**
   * Recrée un `Character` depuis ses données sérialisées (produites par
   * `toSerialized`).
   */
  static fromSerialized(data: any): Character {
    const job: Job = JobFactory.fromSerialized(data.classe);
    const position: Position = data.position ?? { row: 0, col: 0 };

    const rightHand = data.rightHand ? this.deserializeWeapon(data.rightHand) : null;
    const leftHand = data.leftHand ? this.deserializeWeapon(data.leftHand) : null;

    const items = (data.items ?? []).map((itemData: any) => this.deserializeItem(itemData));

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
    char.currentXp = data.currentXp ?? 0;
    char.gold = data.gold ?? 0;
    char.stats = data.stats ?? job.defaultStats;
    // Le constructeur écrase `job.jobLevel` à 1 (arg12 non fourni) : on le
    // restaure ici depuis les données sérialisées.
    char.job.jobLevel = data.classe?.jobLevel ?? 1;
    // Joueur qui contrôle le perso + avatar personnalisé (multi-joueurs).
    char.ownerId = data.ownerId ?? null;
    char.avatar = data.avatar ?? null;

    return char;
  }

  /**
   * Sérialise un `Character` en objet JSON (round-trip avec `fromSerialized`).
   */
  static toSerialized(char: Character): any {
    return {
      id: char.id,
      name: char.name,
      type: char.type,
      position: char.position,
      currentHp: char.currentHp,
      maxHp: char.maxHp,
      currentMp: char.currentMp,
      maxMp: char.maxMp,
      currentAp: char.currentAp,
      maxAp: char.maxAp,
      currentXp: char.currentXp,
      gold: char.gold,
      characterLevel: char.characterLevel,
      stats: char.stats,
      // Joueur qui contrôle le perso + avatar personnalisé (multi-joueurs).
      ownerId: char.ownerId ?? null,
      avatar: char.avatar ?? null,
      status: char.status.map((s) => this.serializeStatus(s)),
      classe: {
        name: char.job.baseName,
        jobLevel: char.job.jobLevel,
        evolvedName: char.job.evolvedName,
        recruitedDemons:
          char.job instanceof BlackMage ? char.job.recruitedDemons : undefined,
      },
      rightHand: char.rightHandWeapon ? this.serializeWeapon(char.rightHandWeapon) : null,
      leftHand: char.leftHandWeapon ? this.serializeWeapon(char.leftHandWeapon) : null,
      items: char.bag.map((item) => this.serializeItem(item)),
    };
  }

  // ── Armes ──────────────────────────────────────────────────────────────

  private static serializeWeapon(w: Weapon): any {
    return {
      id: w.id,
      name: w.name,
      type: "weapon",
      description: w.description,
      purchasePrice: w.purchasePrice,
      zoneThreshold: w.zoneThreshold,
      weaponType: w.weaponType,
      mainStat: w.mainStat,
      subStat: w.subStat,
      weaponStat: w.weaponStat,
      weaponSubStat: w.weaponSubStat,
      range: w.range,
      element: w.element,
      status: w.status ? this.serializeStatus(w.status) : null,
    };
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
      data.status ? this.deserializeStatus(data.status) : null
    );
  }

  // ── Objets (sac) ───────────────────────────────────────────────────────

  private static serializeItem(item: Item): any {
    const base: any = {
      id: item.id,
      name: item.name,
      type: item.type,
      description: item.description,
      purchasePrice: item.purchasePrice,
      zoneThreshold: item.zoneThreshold,
    };
    if (item instanceof Weapon) {
      return this.serializeWeapon(item);
    }
    if (item instanceof Tools) {
      base.element = item.element;
      base.target = item.target;
      base.power = item.power;
      base.status = item.status ? this.serializeStatus(item.status) : null;
      base.isTool = true;
      return base;
    }
    if (item instanceof Consumable) {
      base.hp = item.hp;
      base.mp = item.mp;
      base.revive = item.revive;
      base.healingStatus = item.healingStatus;
      base.hpPercent = item.hpPercent;
      base.fullHeal = item.fullHeal;
      base.fullMp = item.fullMp;
    }
    return base;
  }

  private static deserializeItem(data: any): Item {
    if (data.type === "weapon") {
      return this.deserializeWeapon(data);
    }
    if (data.type === "consumable") {
      if (data.isTool) {
        return new Tools(
          data.id,
          data.name,
          data.description,
          data.element,
          data.target,
          data.power,
          data.status ? this.deserializeStatus(data.status) : null
        );
      }
      const c = new Consumable(
        data.id,
        data.name,
        data.description,
        data.purchasePrice,
        data.zoneThreshold,
        data.hp ?? 0,
        data.mp ?? 0,
        data.revive ?? false,
        data.healingStatus ?? []
      );
      c.hpPercent = data.hpPercent;
      c.fullHeal = data.fullHeal;
      c.fullMp = data.fullMp;
      return c;
    }
    // "quest" (et tout autre type) : objet simple.
    return new Item(
      data.id,
      data.name,
      data.type,
      data.description,
      data.purchasePrice,
      data.zoneThreshold
    );
  }

  // ── Statuts ────────────────────────────────────────────────────────────

  private static serializeStatus(s: Status): any {
    return {
      name: s.name,
      description: s.description,
      statusType: s.statusType,
      nbTurnEffect: s.nbTurnEffect,
      aoe: s.aoe,
      chance: s.chance,
    };
  }

  private static deserializeStatus(data: any): Status {
    const s = new Status();
    s.name = data.name;
    s.description = data.description;
    s.statusType = data.statusType;
    s.nbTurnEffect = data.nbTurnEffect ?? null;
    s.aoe = data.aoe;
    s.chance = data.chance;
    return s;
  }
}