// src/classes/Exploration/EncounterEngine.ts
import { Zone, ZoneType } from "../World/Zone";
import { Party } from "./Party";
import { Encounter } from "./Encounter";
import { Difficulty } from "../Types";

/**
 * Valeur de pas (P) par biome, selon le livret :
 *   - Herbes / plaines : 16
 *   - Grottes          : 10
 *   - Bâtiments        : 12
 *
 * À chaque pas, le jeu tire un aléatoire 0-99 : si aléatoire < P, une rencontre
 * se déclenche. Le Repousse ramène P à 0 (annule la rencontre).
 */
const STEP_VALUE_BY_BIOME: Record<ZoneType, number> = {
  Forest: 16,      // herbes
  Canyon: 16,      // plaines
  FrozenLand: 16,  // plaines
  Cave: 10,        // grottes
  Tower: 12,       // bâtiments
  Castle: 12,      // bâtiments
  Lake: 0,         // pas de rencontre aléatoire (seule la pêche y fait apparaître Mateus)
};

/**
 * Moteur de rencontre (Phase 2).
 *
 * Décide, à chaque pas de l'équipe, SI une rencontre se déclenche (formule du
 * livret : aléatoire 0-99 < P, P dépendant du biome, Repousse → 0) et, le cas
 * échéant, combien d'ennemis apparaissent (gaussien de la zone, centré sur la
 * taille de l'équipe).
 */
/** Multiplicateur de taux de rencontre en mode hard (rencontres plus fréquentes). */
const HARD_ENCOUNTER_MULTIPLIER = 1.5;

export class EncounterEngine {
  /**
   * Retourne la valeur de pas P du biome de la zone, ajustée à la difficulté.
   * En mode hard, P est augmentée (rencontres plus fréquentes).
   */
  static getStepValue(zone: Zone, difficulty: Difficulty = "easy"): number {
    const base = STEP_VALUE_BY_BIOME[zone.biome] ?? 16;
    return difficulty === "hard" ? Math.round(base * HARD_ENCOUNTER_MULTIPLIER) : base;
  }

  /**
   * Détermine si une rencontre se déclenche pour ce pas.
   * @param zone La zone courante (fournit le biome → P).
   * @param repousseActive true si l'effet Repousse est actif (annule la rencontre).
   * @param rand Fonction aléatoire [0,1) injectable (déterminisme des tests).
   */
  static shouldTrigger(zone: Zone, repousseActive: boolean = false, rand: () => number = Math.random, difficulty: Difficulty = "easy"): boolean {
    if (repousseActive) return false;
    const roll = Math.floor(rand() * 100); // 0-99
    return roll < this.getStepValue(zone, difficulty);
  }

  /**
   * Crée la rencontre (groupe de monstres) si une rencontre se déclenche.
   * Le nombre d'ennemis suit la gaussienne de la zone (centrée sur la taille
   * de l'équipe vivante).
   * @returns La rencontre, ou null si aucune.
   */
  static roll(zone: Zone, party: Party, repousseActive: boolean = false, rand: () => number = Math.random, difficulty: Difficulty = "easy"): Encounter | null {
    if (!this.shouldTrigger(zone, repousseActive, rand, difficulty)) return null;
    const teamSize = Math.max(1, party.getAliveMembers().length);
    const names = zone.rollForEncounter(teamSize, rand);
    return new Encounter(zone, names, rand);
  }
}