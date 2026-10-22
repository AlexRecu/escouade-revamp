import { MonsterSpawnRate } from "../classes/Types";
import { ZoneType } from "../classes/World/Zone";
import bestiary from "../config/bestiary_data.json";

export const zoneTypes: ZoneType[] = ["Forest", "Cave", "Tower", "Castle", "Canyon", "FrozenLand"];

/**
 * Noms narratifs stables par biome (Phase C2).
 *
 * Remplace l'ancien `generateZoneName` (nom + suffixe `#N` aléatoire) : les
 * zones ont désormais des **noms fixes** qui correspondent aux lieux du livret
 * et aux cibles des quêtes (matching fiable).
 */
export const STABLE_ZONE_NAMES: Record<ZoneType, string> = {
  Forest: "Forêt des soupirs",
  Cave: "Grotte de l'Écho",
  Tower: "Tour du serment",
  Castle: "Château Déchu",
  Canyon: "Vallée des cendres",
  FrozenLand: "Terres Gelées",
  Lake: "Lac de Qual-Chen",
};

/**
 * Génère une fonction pseudo-aléatoire déterministe (mulberry32) à partir d'une graine.
 * Utile pour des générations de donjon reproductibles.
 */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Retourne une graine aléatoire (entier 32 bits). */
export function randomSeed(): number {
  return Math.floor(Math.random() * 2147483647);
}

/**
 * Tire `count` éléments aléatoires sans remise dans la liste.
 */
export function pickRandomItems<T>(items: T[], count: number, rand: () => number = Math.random): T[] {
  const pool = [...items];
  const result: T[] = [];
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(rand() * pool.length);
    result.push(pool.splice(idx, 1)[0]);
  }
  return result;
}

/**
 * Choix pondéré : sélectionne un élément selon les poids fournis.
 */
export function weightedRandomChoice<T>(items: T[], weights: number[], rand: () => number = Math.random): T {
  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0 || items.length === 0) return items[Math.floor(rand() * items.length)];
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}

/** Retourne un type de zone aléatoire. */
export function getRandomZoneType(): ZoneType {
  return zoneTypes[Math.floor(Math.random() * zoneTypes.length)];
}

/**
 * Répartition des monstres par biome (noms du bestiaire, pondérés par rank).
 */
const SPAWN_BY_BIOME: Record<ZoneType, string[]> = {
  Forest: ["Frelon", "Gobelin", "Veuve noire", "Loup", "Vautour", "Ahriman", "Bombo Feu", "Bombo Glace", "Bombo Terre", "Bombo Air", "Bombo Foudre", "Cendre Bombo", "Mage gobelin", "Lézard ailé", "Dragonnet", "Bandit"],
  Cave: ["Bombo Feu", "Bombo Glace", "Bombo Terre", "Bombo Air", "Bombo Foudre", "Cendre Bombo", "Mage gobelin", "Coeurl", "Dullahan", "Brûleur", "Griffon", "Yéti"],
  Tower: ["Coeurl", "Chevalier mort vivant", "Garde dragon", "Dullahan", "Brûleur", "Ours élastique", "Chimère", "Géant de fer"],
  Castle: ["Chevalier mort vivant", "Garde dragon", "Dullahan", "Ours élastique", "Chimère", "Géant de fer", "Dragon squelette"],
  Canyon: ["Dragonnet", "Bandit", "Griffon", "Ours élastique", "Chimère", "Géant de fer", "Dragon squelette"],
  FrozenLand: ["Yéti", "Dragon rouge", "Dragon bleu", "Dragon de glace"],
  // Le lac n'a pas de rencontres aléatoires : seul le pêcheur (Mateus) y apparaît.
  Lake: [],
};

/**
 * Correspondance entre le type de zone (code) et la clé de biome utilisée
 * dans le champ `spawn_rates` du bestiaire.
 */
const BIOME_KEY_BY_ZONE_TYPE: Record<ZoneType, string> = {
  Forest: "forest",
  Cave: "cave",
  Tower: "tower",
  Castle: "castle",
  Canyon: "gorge",
  FrozenLand: "frozenEarth",
  Lake: "lake",
};

/**
 * Retourne les taux de spawn pour un biome donné.
 *
 * Les taux proviennent du **bestiaire** (`spawn_rates` par biome) : chaque
 * monstre déclare son taux d'apparition dans chaque biome. Les monstres de
 * haut rang (dragons…) y figurent à un taux faible (~2-3%), les monstres
 * communs à un taux élevé (~13-17%). On ne retient que les monstres dont le
 * taux est strictement positif dans le biome.
 *
 * Si le bestiaire ne fournit aucun taux pour le biome (données absentes), on
 * retombe sur la liste uniforme `SPAWN_BY_BIOME` (taux égalitaire).
 */
export function getSpawnRatesForZoneType(type: ZoneType): MonsterSpawnRate[] {
  const biomeKey = BIOME_KEY_BY_ZONE_TYPE[type];
  const fromBestiary: MonsterSpawnRate[] = [];
  if (biomeKey) {
    for (const m of bestiary) {
      const rates = m.spawn_rates as Record<string, number> | undefined;
      const rate = rates?.[biomeKey] ?? 0;
      if (rate > 0) fromBestiary.push({ monsterName: m.name, rate });
    }
  }
  if (fromBestiary.length > 0) return fromBestiary;

  // Secours : liste uniforme (taux égalitaire).
  const names = SPAWN_BY_BIOME[type] ?? SPAWN_BY_BIOME.Forest;
  const rate = 1 / names.length;
  return names.map((monsterName) => ({ monsterName, rate }));
}