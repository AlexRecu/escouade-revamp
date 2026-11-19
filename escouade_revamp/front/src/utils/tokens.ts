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

/**
 * Sprite sheet des tokens **vaincus** (`defeated.png`) : grille 3×3 de
 * personnages au sol. Chaque classe y a une cellule ; on sélectionne la bonne
 * via `background-position` (pas besoin de recadrer le fichier).
 *
 * Ordre (ligne, colonne) :
 *   ligne 0 : mage bleu, mage rouge, voleur
 *   ligne 1 : mage blanc, paladin, chevalier noir
 *   ligne 2 : guerrier, moine, mage noir
 */
const DEFEATED_SPRITE: Record<string, { row: number; col: number }> = {
  'mage bleu': { row: 0, col: 0 },
  'mage rouge': { row: 0, col: 1 },
  'voleur': { row: 0, col: 2 },
  'mage blanc': { row: 1, col: 0 },
  'paladin': { row: 1, col: 1 },
  'chevalier noir': { row: 1, col: 2 },
  'guerrier': { row: 2, col: 0 },
  'moine': { row: 2, col: 1 },
  'mage noir': { row: 2, col: 2 },
};

/**
 * Style inline pour afficher le token **vaincu** d'une classe (cellule du
 * sprite sheet `defeated.png`). `null` si la classe n'a pas de sprite vaincu
 * (ex. un monstre) → l'appelant retombe sur le token normal grisé.
 */
export function defeatedTokenStyle(jobName: string): Record<string, string> | null {
  const cell = DEFEATED_SPRITE[jobName.toLowerCase()];
  if (!cell) return null;
  return {
    // `background-image` exige `url(...)` (un chemin nu est rejeté par le CSSOM
    // quand React applique le style → le token resterait vide).
    backgroundImage: `url(${TOKEN_BASE}/defeated.png)`,
    backgroundSize: '300% 300%',
    backgroundPosition: `${cell.col * 50}% ${cell.row * 50}%`,
    backgroundRepeat: 'no-repeat',
  };
}

/**
 * Sprite sheet des **Eons et démons** (`eon_demon_sprites.png`) : grille
 * **2 lignes × 6 colonnes** (cellules 256×512, portrait). Chaque Eon / démon
 * y a une cellule ; on sélectionne la bonne via `background-position`.
 *
 * Ordre (ligne, colonne) :
 *   ligne 0 (Eons)   : Phoenix, Garuda, Ramuh, Shiva, Titan, Odin
 *   ligne 1 (Démons) : Bélias, Adrammelech, Mateus, Hashmal, Zeromus, Ultima
 */
const EON_DEMON_SPRITE: Record<string, { row: number; col: number }> = {
  // Eons (ligne 0)
  'phoenix': { row: 0, col: 0 },
  'garuda': { row: 0, col: 1 },
  'ramuh': { row: 0, col: 2 },
  'shiva': { row: 0, col: 3 },
  'titan': { row: 0, col: 4 },
  'odin': { row: 0, col: 5 },
  // Démons (ligne 1)
  'bélias': { row: 1, col: 0 },
  'adrammelech': { row: 1, col: 1 },
  'mateus': { row: 1, col: 2 },
  'hashmal': { row: 1, col: 3 },
  'zeromus': { row: 1, col: 4 },
  'ultima': { row: 1, col: 5 },
};

/**
 * Style inline pour afficher le token d'un **Eon ou d'un démon** (cellule du
 * sprite sheet `eon_demon_sprites.png`). `null` si la clé n'a pas de sprite
 * → l'appelant retombe sur le token normal.
 *
 * ⚠️ La cellule est en **portrait** (ratio 1:2) : le token doit être un
 * rectangle portrait (`.unit-token-sprite` = 50% largeur × 100% hauteur de la
 * case carrée) pour ne pas déformer le sprite.
 */
export function eonDemonTokenStyle(spriteKey: string): Record<string, string> | null {
  const cell = EON_DEMON_SPRITE[spriteKey.toLowerCase()];
  if (!cell) return null;
  return {
    backgroundImage: `url(${TOKEN_BASE}/eon_demon_sprites.png)`,
    // 6 colonnes → 600% de largeur ; 2 lignes → 200% de hauteur.
    backgroundSize: '600% 200%',
    // 6 colonnes : pas de 20% (100/5) ; 2 lignes : pas de 100% (100/1).
    backgroundPosition: `${cell.col * 20}% ${cell.row * 100}%`,
    backgroundRepeat: 'no-repeat',
  };
}
