// src/classes/World/Zone.ts

import { weightedRandomChoice } from "../../utils/RandomUtils";
import { Encounter } from "../Exploration/Encounter";
import { Campfire } from "../Progression/Campfire";
import { MonsterSpawnRate, Position } from "../Types";

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
  floor: number;
  tileMap: boolean[][];
  startTile: Position;
  endTile: Position;
  campfires: Position[];

  constructor(
    id: string,
    name: string,
    biome: ZoneType,
    zoneLevel: number,
    spawnRates: MonsterSpawnRate[],
    encounterRate: number,
    checkpoints: Campfire[] = [],
    seed: number = Math.floor(Math.random() * 10000),
    floor: number,
    tileMap: boolean[][],
    startTile: Position,
    endTile: Position,
    campfires: Position[],
    parentDungeonName?: string
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
    this.tileMap = tileMap;
    this.startTile = startTile;
    this.endTile = endTile;
    this.campfires = campfires;
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
  rollForEncounter(teamSize: number = 1): string[] {
    const min = 1;
    const max = 6;
  
    // Génère un nombre de monstres suivant une Gaussienne autour de teamSize (avec sigma ≈ 1.2)
    const gaussianRandom = (): number => {
      const mean = teamSize;
      const stdDev = 1.2;
      let u = 0, v = 0;
      while (u === 0) u = Math.random(); // [0,1) exclu 0
      while (v === 0) v = Math.random();
      const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
      const raw = Math.round(mean + z * stdDev);
      return Math.max(min, Math.min(max, raw));
    };
  
    const monsterCount = gaussianRandom();
  
    const names: string[] = [];
    for (let i = 0; i < monsterCount; i++) {
      const monsters = this.spawnRates.map((s) => s.monsterName);
      const weights = this.spawnRates.map((s) => s.rate);
      const monster = weightedRandomChoice(monsters, weights);
      names.push(monster);
    }
  
    return names;
  }

  /**
   * Retourne tous les points de repos disponibles dans cette zone
   */
  getCampFires(): Campfire[] {
    return this.checkpoints;
  }
}
