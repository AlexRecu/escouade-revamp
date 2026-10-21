// src/classes/World/Zone.ts

import { weightedRandomChoice } from "../../utils/RandomUtils";
import { Encounter } from "../Exploration/Encounter";
import { Campfire } from "../Progression/Campfire";
import { MonsterSpawnRate, Position, Chest } from "../Types";

export type ZoneType = "Forest" | "Cave" | "Tower" | "Castle" | "Canyon" | "FrozenLand" | "Lake";

/**
 * Rencontre spéciale (démon) ancrée à un lieu précis de la zone.
 * (Phase B — recrutement des démons en zone)
 */
export interface SpecialEncounter {
  /** Nom exact du démon (cf. `demons_data.json`). */
  demonName: string;
  /** Case où le démon se trouve (impasse, sommet, fond de zone...). */
  position: Position;
  /** true si le démon est auto-présent (ex. Adrammelech si la quête est acceptée). */
  autoPresent?: boolean;
  /** true si le lieu est une impasse (cul-de-sac). */
  deadEnd?: boolean;
  /**
   * Id de la quête qui doit être **acceptée** pour que la rencontre soit active.
   * Si absent, la rencontre est toujours disponible. (Ex. Adrammelech n'apparaît
   * que si la quête "Trouvez le kidnappeur" est acceptée.)
   */
  requiresQuest?: string;
}

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
  /** Impasses (culs-de-sac) de la zone. */
  deadEnds: Position[];
  /** Cases bloquantes (ex. porte de sang) — bloquent la progression jusqu'à ouverture. */
  blockedTiles: Position[];
  /** Rencontres spéciales (démons) ancrées à un lieu précis. */
  specialEncounters: SpecialEncounter[];
  /** Tuiles de pêche (lac) — y pêcher peut faire apparaître un démon (Mateus). */
  fishingTiles: Position[];
  /** Coffres de la zone (position + type commun/rare + état d'ouverture). */
  chests: Chest[];

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
    parentDungeonName?: string,
    deadEnds: Position[] = [],
    blockedTiles: Position[] = [],
    specialEncounters: SpecialEncounter[] = [],
    fishingTiles: Position[] = [],
    chests: Chest[] = []
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
    this.deadEnds = deadEnds;
    this.blockedTiles = blockedTiles;
    this.specialEncounters = specialEncounters;
    this.fishingTiles = fishingTiles;
    this.chests = chests;
  }

  /** true si la case est un spot de pêche (lac). */
  isFishingTile(pos: Position): boolean {
    return this.fishingTiles.some((t) => t.row === pos.row && t.col === pos.col);
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
  rollForEncounter(teamSize: number = 1, rand: () => number = Math.random): string[] {
    const min = 1;
    // Pour limiter la difficulté, le nombre d'ennemis est plafonné à
    // (taille de l'équipe + 1) : on ne peut pas être submergé.
    const max = teamSize + 1;
  
    // Génère un nombre de monstres suivant une Gaussienne autour de teamSize (avec sigma ≈ 1.2)
    const gaussianRandom = (): number => {
      const mean = teamSize;
      const stdDev = 1.2;
      let u = 0, v = 0;
      while (u === 0) u = rand(); // [0,1) exclu 0
      while (v === 0) v = rand();
      const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
      const raw = Math.round(mean + z * stdDev);
      return Math.max(min, Math.min(max, raw));
    };
  
    const monsterCount = gaussianRandom();
  
    const names: string[] = [];
    for (let i = 0; i < monsterCount; i++) {
      const monsters = this.spawnRates.map((s) => s.monsterName);
      const weights = this.spawnRates.map((s) => s.rate);
      const monster = weightedRandomChoice(monsters, weights, rand);
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

  /**
   * Renvoie la rencontre spéciale (démon) ancrée à une position donnée, ou null.
   */
  getSpecialEncounterAt(pos: Position): SpecialEncounter | null {
    return (
      this.specialEncounters.find(
        (se) => se.position.row === pos.row && se.position.col === pos.col
      ) ?? null
    );
  }

  /** true si la case est bloquante (ex. porte de sang). */
  isBlocked(pos: Position): boolean {
    return this.blockedTiles.some((b) => b.row === pos.row && b.col === pos.col);
  }

  /** Débloque une case (ex. après le rituel de la porte de sang). */
  unblockTile(pos: Position): boolean {
    const idx = this.blockedTiles.findIndex((b) => b.row === pos.row && b.col === pos.col);
    if (idx === -1) return false;
    this.blockedTiles.splice(idx, 1);
    return true;
  }

  /**
   * Sérialise la zone en objet JSON (round-trip avec le constructeur).
   *
   * Capture **tout** l'état de la zone, y compris les champs ajoutés en
   * Phase B/D : `deadEnds`, `blockedTiles` (porte de sang), `specialEncounters`
   * (démons ancrés) et `fishingTiles` (lac).
   */
  toSerialized(): any {
    return {
      id: this.id,
      name: this.name,
      biome: this.biome,
      zoneLevel: this.zoneLevel,
      spawnRates: this.spawnRates,
      encounterRate: this.encounterRate,
      checkpoints: this.checkpoints.map((c) => ({
        locationName: c.locationName,
        restoredHealthPercentage: c.restoredHealthPercentage,
        restoredManaPercentage: c.restoredManaPercentage,
        isUsed: c.isUsed,
        position: c.position,
      })),
      seed: this.seed,
      floor: this.floor,
      tileMap: this.tileMap,
      startTile: this.startTile,
      endTile: this.endTile,
      campfires: this.campfires,
      parentDungeonName: this.parentDungeonName,
      deadEnds: this.deadEnds,
      blockedTiles: this.blockedTiles,
      specialEncounters: this.specialEncounters,
      fishingTiles: this.fishingTiles,
    };
  }
}