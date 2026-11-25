/**
 * tileArt/rng — RNG déterministe + hash de case + choix de variante.
 */
import type { Rng } from './types';

/** Crée un RNG déterministe (mulberry32) à partir d'une graine entière. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash déterministe d'une case → entier (stable entre re-renders). */
export function hashTile(row: number, col: number, floor: number, biome: string): number {
  let h = 2166136261;
  const mix = (n: number) => {
    h ^= n;
    h = Math.imul(h, 16777619);
  };
  mix(row);
  mix(col);
  mix(floor);
  for (let i = 0; i < biome.length; i++) mix(biome.charCodeAt(i));
  return h >>> 0;
}

/** Choisit une variante dans une liste selon une graine. */
export function pickVariant(urls: string[], seed: number): string {
  if (urls.length === 0) return '';
  return urls[seed % urls.length];
}
