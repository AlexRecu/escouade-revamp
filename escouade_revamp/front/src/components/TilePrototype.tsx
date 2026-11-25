import { useMemo } from 'react';
import { getBiomeArt, hashTile, tileFor, LN, LE, LS, LW, type BiomeKey } from '../game/tileArt';

/**
 * Prototype des tuiles générées (Canvas 2D, pixel-art).
 *
 * Affiche, pour chaque biome, une petite grille d'exemple (murs + sols)
 * rendue avec les textures de `tileArt.ts`. Sert à valider le look avant
 * l'intégration dans `DungeonView`. Aucune donnée de jeu : la grille est
 * générée localement de façon déterministe.
 */

const BIOMES: { key: BiomeKey; label: string; icon: string }[] = [
  { key: 'forest', label: 'Forêt', icon: '🌲' },
  { key: 'cave', label: 'Caverne', icon: '🪨' },
  { key: 'tower', label: 'Tour', icon: '🗼' },
  { key: 'castle', label: 'Château', icon: '🏰' },
  { key: 'canyon', label: 'Canyon', icon: '🏜️' },
  { key: 'frozen', label: 'Terres gelées', icon: '❄️' },
  { key: 'lake', label: 'Lac', icon: '🌊' },
];

const ROWS = 8;
const COLS = 10;

/**
 * Le mur (r,c) est-il adjacent en **cardinal** (gauche/droite/haut/bas, pas
 * de diagonale) à une case praticable ? Utilisé pour les décors orientés
 * (ex. chandeliers du château).
 */
function isCardinalFacing(map: boolean[][], r: number, c: number): boolean {
  const at = (rr: number, cc: number) =>
    rr >= 0 && cc >= 0 && rr < ROWS && cc < COLS && map[rr][cc] === true;
  return at(r, c - 1) || at(r, c + 1) || at(r - 1, c) || at(r + 1, c);
}

/**
 * Masque d'arête (LN/LE/LS/LW) de la case (r,c) : un bit est posé si le
 * voisin **cardinal** est du type opposé (eau vs berge). Les voisins hors
 * grille comptent comme le même type (pas de liseré artificiel au bord).
 * Utilisé par le lac pour orienter la transition eau/terre.
 */
function edgeMaskOf(map: boolean[][], r: number, c: number): number {
  const cur = map[r][c];
  const at = (rr: number, cc: number) =>
    rr >= 0 && cc >= 0 && rr < ROWS && cc < COLS ? map[rr][cc] : cur;
  let m = 0;
  if (at(r - 1, c) !== cur) m |= LN;
  if (at(r, c + 1) !== cur) m |= LE;
  if (at(r + 1, c) !== cur) m |= LS;
  if (at(r, c - 1) !== cur) m |= LW;
  return m;
}

/** Grille d'exemple déterministe : bordures = murs, intérieur = sol,
 *  quelques rochers/murs épars pour voir les deux types. */
function sampleMap(seed: number): boolean[][] {
  const map: boolean[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < COLS; c++) {
      const border = r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1;
      // Quelques murs intérieurs (hash stable).
      const innerWall = !border && hashTile(r, c, seed, 'wall') % 7 === 0;
      row.push(!border && !innerWall);
    }
    map.push(row);
  }
  return map;
}

/** Grille du lac : un **cercle d'eau** praticable au centre, berges autour. */
function lakeMap(): boolean[][] {
  const cr = (ROWS - 1) / 2;
  const cc = (COLS - 1) / 2;
  const rad2 = 9; // rayon ~3
  const map: boolean[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < COLS; c++) {
      const d2 = (r - cr) * (r - cr) + (c - cc) * (c - cc);
      row.push(d2 <= rad2); // true = eau (praticable)
    }
    map.push(row);
  }
  return map;
}

export default function TilePrototype({ onBack }: { onBack: () => void }) {
  // Pré-génère les textures de tous les biomes (mémorisées dans tileArt) pour
  // éviter un pic de génération au premier rendu de chaque carte.
  useMemo(() => {
    for (const b of BIOMES) getBiomeArt(b.key);
  }, []);

  return (
    <div className="tile-prototype">
      <div className="tile-prototype-head">
        <h2>Prototype — Tuiles générées (Canvas 2D)</h2>
        <button className="dungeon-rest-btn" onClick={onBack}>
          ← Retour
        </button>
      </div>
      <p className="tile-prototype-sub">
        Textures pixel-art générées procéduralement : variations de dalles, nuances
        de couleurs et décorations par biome. Chaque case tire une variante
        déterministe (stable entre re-renders).
      </p>

      <div className="tile-prototype-grid">
        {BIOMES.map((b, bi) => {
          const map = b.key === 'lake' ? lakeMap() : sampleMap(bi + 1);
          return (
            <div className="tile-prototype-card" key={b.key}>
              <div className="tile-prototype-card-title">
                <span aria-hidden>{b.icon}</span> {b.label}
              </div>
              <div
                className="tile-prototype-map"
                style={{
                  gridTemplateColumns: `repeat(${COLS}, 1fr)`,
                  gridTemplateRows: `repeat(${ROWS}, 1fr)`,
                }}
              >
                {map.map((row, r) =>
                  row.map((walkable, c) => {
                    const kind = walkable ? 'floor' : 'wall';
                    const facing = walkable ? undefined : isCardinalFacing(map, r, c);
                    const edgeMask = b.key === 'lake' ? edgeMaskOf(map, r, c) : 0;
                    const url = tileFor(b.key, kind, r, c, bi + 1, facing, edgeMask);
                    return (
                      <div
                        key={`${r}-${c}`}
                        className="tile-prototype-tile"
                        style={{ backgroundImage: `url(${url})` }}
                      />
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
