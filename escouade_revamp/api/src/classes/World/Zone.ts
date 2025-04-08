// src/classes/World/Zone.ts

import { Encounter } from "../Exploration/Encounter";
import { Campfire } from "../Progression/Campfire";
import { MonsterSpawnRate } from "../Types";

export type ZoneType = "Forest" | "Cave" | "Tower" | "Castle" | "Canyon" | "FrozenLand";

export class Zone {
  id: string;
  name: string;
  biome: ZoneType;
  zoneLevel: number; // Niveau global de la zone (scaling des ennemis)
  spawnRates: MonsterSpawnRate[]; // Liste des monstres avec leur taux d'apparition
  encounterRate: number; // 0.0 à 1.0 — chance d'une rencontre par "pas"
  checkpoints: Campfire[];
  seed: number; // Pour génération pseudo-aléatoire stable si besoin
  parentDungeonName?: string;
  floor?: number;

  constructor(
    id: string,
    name: string,
    biome: ZoneType,
    zoneLevel: number,
    spawnRates: MonsterSpawnRate[],
    encounterRate: number,
    checkpoints: Campfire[] = [],
    seed: number = Math.floor(Math.random() * 10000),
    parentDungeonName?: string,
    floor?: number
  ) {
    this.id = id;
    this.name = name;
    this.biome = biome;
    this.zoneLevel = zoneLevel;
    this.spawnRates = spawnRates;
    this.encounterRate = encounterRate;
    this.checkpoints = checkpoints;
    this.seed = seed;
    this.parentDungeonName = parentDungeonName;
    this.floor = floor;
  }

  /**
   * Retourne true si une rencontre aléatoire doit avoir lieu
   */
  shouldTriggerEncounter(): boolean {
    return Math.random() < this.encounterRate;
  }

  /**
   * Choisit aléatoirement un monstre selon les taux définis
   */
  rollForEncounter(): string {
    const roll = Math.random();
    let cumulative = 0;
    for (let spawn of this.spawnRates) {
      cumulative += spawn.rate;
      if (roll <= cumulative) return spawn.monsterName;
    }
    // fallback au dernier
    return this.spawnRates[this.spawnRates.length - 1].monsterName;
  }

  /**
   * Retourne tous les points de repos disponibles dans cette zone
   */
  getCampFires(): Campfire[] {
    return this.checkpoints;
  }
}
