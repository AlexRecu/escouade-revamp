/**
 * Résolution des tokens (images) des classes et des monstres.
 *
 * Les tokens sont servis depuis `public/assets/tokens/` (chemin absolu
 * `/assets/tokens/...`). Chaque classe a un token dédié ; les monstres
 * réutilisent leur nom du bestiaire comme nom de fichier. En l'absence de
 * token, on retombe sur `default.png`.
 */

export const TOKEN_BASE = '/assets/tokens';

/**
 * Liste des avatars de classe : nom du job (tel que renvoyé par le backend,
 * ex. "Mage Blanc") + fichier de token correspondant. Le lookup est **insensible
 * à la casse** (les noms réels des jobs ont des majuscules, les fichiers aussi).
 */
export const CLASS_AVATARS: { job: string; file: string }[] = [
  { job: 'Guerrier', file: 'Guerrier.png' },
  { job: 'Mage blanc', file: 'Mage blanc.png' },
  { job: 'Mage bleu', file: 'Mage Bleu.png' },
  { job: 'Mage noir', file: 'Mage noir.png' },
  { job: 'Mage rouge', file: 'Mage Rouge.png' },
  { job: 'Voleur', file: 'voleur.png' },
  { job: 'Moine', file: 'Moine.png' },
];

/** Mapping normalisé (minuscules) nom de classe → fichier de token. */
const CLASS_TOKENS: Record<string, string> = Object.fromEntries(
  CLASS_AVATARS.map((a) => [a.job.toLowerCase(), a.file])
);

/**
 * Fichier de token d'une **classe** (par le nom du job, insensible à la casse).
 * `null` si la classe n'a pas de token dédié.
 */
export function classTokenFile(jobName: string): string | null {
  return CLASS_TOKENS[jobName.toLowerCase()] ?? null;
}

/**
 * Chemin du token d'une **classe** (par le nom du job). Fallback `default.png`.
 * Le nom de fichier est encodé (certains contiennent des espaces).
 */
export function classTokenUrl(jobName: string): string {
  const file = classTokenFile(jobName) ?? 'default.png';
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

/**
 * Chemin d'un token à partir du **nom de fichier** (ex. "Guerrier.png").
 * Utilisé pour l'avatar personnalisé choisi à la création de personnage.
 */
export function tokenUrl(file: string): string {
  return `${TOKEN_BASE}/${encodeURIComponent(file)}`;
}
