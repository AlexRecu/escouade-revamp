/**
 * Résolution des tokens (images) des classes et des monstres.
 *
 * Les tokens sont servis depuis `public/assets/tokens/` (chemin absolu
 * `/assets/tokens/...`). Chaque classe a un token dédié ; les monstres
 * réutilisent leur nom du bestiaire comme nom de fichier. En l'absence de
 * token, on retombe sur `default.png`.
 */

const TOKEN_BASE = '/assets/tokens';

/** Mapping nom de classe (job) → fichier de token. */
const CLASS_TOKENS: Record<string, string> = {
  'Guerrier': 'Guerrier.png',
  'Mage blanc': 'Mage blanc.png',
  'Mage bleu': 'Mage Bleu.png',
  'Mage noir': 'Mage noir.png',
  'Mage rouge': 'Mage Rouge.png',
  'Voleur': 'voleur.png',
  'Moine': 'Moine.png',
};

/**
 * Chemin du token d'une **classe** (par le nom du job). Fallback `default.png`.
 * Le nom de fichier est encodé (certains contiennent des espaces).
 */
export function classTokenUrl(jobName: string): string {
  const file = CLASS_TOKENS[jobName] ?? 'default.png';
  return `${TOKEN_BASE}/${encodeURIComponent(file)}`;
}

/**
 * Chemin du token d'un **monstre** (par son nom du bestiaire). Fallback
 * `default.png` si le monstre n'a pas de token dédié.
 */
export function monsterTokenUrl(monsterName: string): string {
  // Le nom du monstre est utilisé tel quel comme nom de fichier (ex.
  // "Bombo Feu.png"). On ne sait pas côté front si le fichier existe → on
  // gère le fallback visuel via `onError` dans le composant (default.png).
  return `${TOKEN_BASE}/${encodeURIComponent(monsterName)}.png`;
}

/** Chemin du token par défaut (fallback). */
export const DEFAULT_TOKEN_URL = `${TOKEN_BASE}/default.png`;
