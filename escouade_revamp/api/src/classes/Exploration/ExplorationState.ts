// src/classes/Exploration/ExplorationState.ts
import { Zone } from "../World/Zone";
import { Party } from "./Party";
import { Encounter } from "./Encounter";
import { Position } from "../Types";
import { CampfireService } from "../../services/dungeon/CampfireService";
import { Campfire } from "../Progression/Campfire";
import { Character } from "../UnitTypes/Character";
import { CharacterFactory } from "../../services/factory/CharacterFactory";

export class ExplorationState {
  party: Party;
  zone: Zone;
  currentEncounter: Encounter | null = null;
  activeCampfire?: Campfire;
  stepsTaken: number = 0;
  savedAt?: Date;
  lastExplorationDate?: Date;

  constructor(party: Party, zone: Zone) {
    this.party = party;
    this.zone = zone;
    this.lastExplorationDate = new Date();
  }

  /**
   * Met à jour la position du groupe et déclenche les effets de la tuile
   */
  movePartyTo(newPos: Position): string[] {
    const logs: string[] = [];

    if (this.currentEncounter) {
      logs.push("Impossible de se déplacer pendant un combat !");
      return logs;
    }

    this.party.moveTo(newPos);
    this.stepsTaken++;
    this.lastExplorationDate = new Date();

    const campfire = CampfireService.getNearbyCampfire(this.party, this.zone.getCampFires());
    if (campfire && !campfire.isUsed) {
      this.activeCampfire = campfire;
      const restLogs = CampfireService.useCampfire(campfire, this.party);
      logs.push("Le groupe s'arrête au feu de camp.");
      logs.push(...restLogs);
    } else {
      this.activeCampfire = undefined;

      if (this.zone.shouldTriggerEncounter()) {
        this.currentEncounter = new Encounter(this.zone);
        logs.push("Une rencontre surgit !");
        logs.push(...this.currentEncounter.getSummary().enemies);
      } else {
        logs.push(`Le groupe avance vers la case ${newPos.row},${newPos.col}`);
      }
    }

    return logs;
  }

  /**
   * Fin d’un combat : met à jour les statistiques et supprime la rencontre
   */
  endEncounter() {
    if (this.currentEncounter) {
      this.party.defeatedEnemies += this.currentEncounter.enemies.length;
      this.currentEncounter = null;
    }
  }

  canMove(): boolean {
    return this.currentEncounter === null;
  }

  isExplorationComplete(): boolean {
    return (
      this.zone.endTile &&
      this.party.position.row === this.zone.endTile.row &&
      this.party.position.col === this.zone.endTile.col
    );
  }

  /**
   * (Dé)sérialisation complète
   */
  static loadFromJSON(data: any): ExplorationState {
    const characters: Character[] = data.party.members.map((charData: any) => {
      const char = CharacterFactory.fromSerialized(charData);
      return char;
    });

    const party = new Party(data.party.id, characters, data.party.position);

    const zone = new Zone(
      data.zone.id,
      data.zone.name,
      data.zone.biome,
      data.zone.zoneLevel,
      data.zone.spawnRates,
      data.zone.encounterRate,
      data.zone.checkpoints.map(
        (cp: any) =>
          new Campfire(
            cp.id,
            cp.location,
            cp.position,
            cp.restoredHp,
            cp.restoredMp
          )
      ),
      data.zone.seed,
      data.zone.parentDungeonName,
      data.zone.floor,
      data.zone.tileMap,
      data.zone.startTile,
      data.zone.endTile,
      data.zone.campfires
    );

    const state = new ExplorationState(party, zone);
    state.stepsTaken = data.stepsTaken ?? 0;
    state.savedAt = data.savedAt ? new Date(data.savedAt) : undefined;
    state.lastExplorationDate = new Date();
    state.currentEncounter = null;

    return state;
  }

  getSummary(): any {
    return {
      zone: {
        name: this.zone.name,
        level: this.zone.zoneLevel,
        biome: this.zone.biome,
      },
      party: {
        id: this.party.id,
        position: this.party.position,
        visitedTiles: Array.from(this.party.visitedTiles),
        members: this.party.members.map(char => ({
          id: char.id,
          name: char.name,
          hp: `${char.currentHp}/${char.maxHp}`,
          mp: `${char.currentMp}/${char.maxMp}`,
        })),
      },
      stepsTaken: this.stepsTaken,
      savedAt: this.savedAt?.toISOString() ?? null,
      lastExplorationDate: this.lastExplorationDate?.toISOString() ?? null,
      activeCampfire: this.activeCampfire?.getSummary() ?? null,
      currentEncounter: this.currentEncounter?.getSummary() ?? null,
    };
  }
}