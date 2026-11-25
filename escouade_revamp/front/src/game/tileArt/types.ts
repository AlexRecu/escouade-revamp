/**
 * tileArt/types — Types partagés de la génération de tuiles.
 */

/** Taille interne d'une texture (pixel-art). Affichée en cover sur la tuile. */
export const TILE_SIZE = 32;

/** Clés de biome (doivent correspondre à `data-biome` dans index.css). */
export type BiomeKey =
  | 'forest'
  | 'cave'
  | 'tower'
  | 'castle'
  | 'canyon'
  | 'frozen'
  | 'lake';

/** Fonction de génération aléatoire déterministe. */
export type Rng = () => number;

/** Déclaration d'une décoration procédurale. */
export interface DecorSpec {
  /** Où dessiner : sol, mur, ou les deux. */
  on: 'floor' | 'wall' | 'both';
  /** Si true, la déco n'est dessinée que si la case est adjacente (cardinale)
   *  à une case praticable (ex. chandeliers du château). */
  oriented?: boolean;
  /** Poids relatif (mode « une seule déco ») ou probabilité (mode multiDecor). */
  weight?: number;
  /** Dessin de la décoration (coordonnées en pixels 0..TILE_SIZE). */
  draw: (ctx: CanvasRenderingContext2D, rng: Rng, p: BiomePalette) => void;
}

/** Palettes + réglages de dessin d'un biome. */
export interface BiomePalette {
  /** Teintes de base du sol praticable (tirées au hasard + bruit). */
  floor: string[];
  /** Teintes de base du mur / case morte. */
  wall: string[];
  /** Couleur des joints de dalle (sol) ou des fissures (mur). */
  seam: string;
  /** Couleur d'accent (lueur, cristaux, fleurs…). */
  accent: string;
  /** Densité des décorations (0..1, proba par case de dessiner un décor). */
  decorDensity: number;
  /** Si true, chaque décor est tiré indépendamment (plusieurs par tuile). */
  multiDecor?: boolean;
  /** Si true, génère aussi des variantes de mur « face praticable ». */
  wallFacing?: boolean;
  /** Si true, rendu spécial du lac (eau + berges avec masque d'arête). */
  lake?: boolean;
  /** Si true, rendu spécial du château (dalles au sol, briques au mur). */
  castle?: boolean;
  /** Rendu sur mesure (sol + mur) — remplace le rendu par défaut. */
  customRender?: (ctx: CanvasRenderingContext2D, rng: Rng, kind: 'floor' | 'wall') => void;
  /** Fonctions de décoration, appelées sur le sol ET/OU le mur. */
  decor: DecorSpec[];
}

/** Jeu de textures d'un biome (dataURLs). */
export interface BiomeArt {
  floor: string[];
  wall: string[];
  /** Variantes de mur pour les cases adjacentes à une case praticable. */
  wallFace?: string[];
  /** Lac : variantes d'eau par masque d'arête (0..15). */
  lakeFloor?: Record<number, string[]>;
  /** Lac : variantes de berge par masque d'arête (0..15). */
  lakeWall?: Record<number, string[]>;
}
