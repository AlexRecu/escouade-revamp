import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Hub, Position, WorldSummary } from '../types/world';
import type { GameState } from '../types/game';
import type { GameActions } from '../game/useGame';
import {
  buildingSet,
  findPath,
  nearestWalkableToBuilding,
} from '../game/pathfinding';
import CityPanels from './CityPanels';
import CollapsibleLog from './CollapsibleLog';

const TILE = 34; // px (doit correspondre à .tile dans index.css)
const GAP = 2; // px (gap de la grille)
const PADDING = 4; // px (padding de .city-grid — origine du positionnement absolu)
const STEP_MS = 180; // durée d'une case (doit correspondre à la transition CSS)

const BUILDING_ICON: Record<string, string> = {
  shop: '🏪',
  inn: '🛏️',
  church: '⛪',
  questBoard: '📜',
  caravan: '🐫',
};

const BUILDING_LABEL: Record<string, string> = {
  shop: 'Marchand',
  inn: 'Auberge',
  church: 'Sanctuaire',
  questBoard: 'Tableau des quêtes',
  caravan: 'Caravane',
};

/** Icône d'un PNJ de ville (cliquable — dialogue + objets de quête). */
const RESIDENT_ICON = '🧑';

/** Libellé d'un service de ville (bâtiment, caravane ou PNJ `resident:<nom>`). */
function resolveLabel(service: string): string {
  if (service.startsWith('resident:')) return service.slice('resident:'.length);
  return BUILDING_LABEL[service] ?? service;
}

type Props = {
  hub: Hub;
  onBack: () => void;
  /** Monde (hubs, zones, arêtes) — pour calculer les destinations de caravane. */
  world: WorldSummary | null;
  /** État de session (socket) — fourni par App (useGame levé au niveau App). */
  state: GameState | null;
  /** Logs du jeu (socket) — fusionnés dans le journal local. */
  gameLogs: string[];
  /** Actions temps réel (socket). */
  actions: GameActions;
};

/**
 * Vue ville : grille de tuiles + personnage déplaçable au clic (point-and-clic).
 *
 * Le déplacement est animé par interpolation (une case à la fois, transition
 * CSS). Cliquer sur une case marchable → le personnage s'y rend. Cliquer sur
 * un bâtiment → le personnage s'arrête devant et le panneau s'ouvre.
 *
 * NB : l'état de partie (socket) est fourni par App (useGame levé au niveau
 * App pour que l'équipe soit visible sur la mappemonde ET en ville).
 */
export default function City({ hub, onBack, world, state, gameLogs, actions }: Props) {
  const layout = hub.layout;
  const [pos, setPos] = useState<Position>(layout?.startTile ?? { row: 0, col: 0 });
  const [path, setPath] = useState<Position[]>([]);
  const [activeBuilding, setActiveBuilding] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  // Barre latérale repliable (rendu mobile : libérer de la place à la carte).
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const timerRef = useRef<number | null>(null);
  // Taille de tuile **réactive** : sur mobile la grille (14×14) ne tient pas
  // avec 34px fixes → on mesure la largeur du conteneur et on réduit la tuile
  // (plafonnée à 34px pour ne pas changer le rendu desktop).
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tile, setTile] = useState(TILE);

  // Obstacles pour le pathfinding : les bâtiments + la case caravane + les PNJ
  // (on marche jusqu'à côté, pas dessus).
  const buildings = useMemo(() => {
    const s = layout ? buildingSet(layout) : new Set<string>();
    if (layout?.caravan) s.add(`${layout.caravan.row},${layout.caravan.col}`);
    for (const r of layout?.residents ?? []) s.add(`${r.row},${r.col}`);
    return s;
  }, [layout]);

  // **Brouillard de guerre des villes** : les villes connues = celles que
  // l'équipe a déjà visitées (source de vérité côté serveur : `visitedHubs`).
  // On y arrive par caravane ou en traversant une zone de transition.
  const visitedHubs = useMemo(
    () => new Set(state?.party.visitedHubs ?? []),
    [state]
  );

  // Destinations de caravane : **toutes les villes visitées** sauf le hub
  // actuel. Tant qu'on n'a visité que l'auberge, il n'y a aucune destination.
  const caravanDestinations = useMemo(() => {
    if (!world) return [];
    return world.hubs.filter((h) => h.id !== hub.id && visitedHubs.has(h.id));
  }, [world, hub.id, visitedHubs]);

  const pushLog = useCallback((msg: string) => {
    setLog((l) => [...l.slice(-40), msg]);
  }, []);

  // Fermeture du panneau de bâtiment par Échap (accessibilité clavier) —
  // utile surtout sur mobile où le panneau est une bottom-sheet.
  useEffect(() => {
    if (!activeBuilding) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveBuilding(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeBuilding]);

  // Fusionne les logs du jeu (socket) dans le journal local.
  useEffect(() => {
    if (gameLogs.length > 0) {
      setLog((l) => [...l, ...gameLogs].slice(-60));
    }
  }, [gameLogs]);

  // Calcule la taille de tuile pour que la grille tienne dans la largeur du
  // conteneur (mobile). Desktop : la largeur est large → on reste à 34px.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !layout) return;
    const compute = () => {
      // Largeur/hauteur utiles du conteneur, moins le padding (4px) et le
      // border (2px) de la grille, moins les gaps entre tuiles.
      const chrome = PADDING * 2 + 4; // padding grille + border grille
      const w = el.clientWidth - chrome;
      const h = el.clientHeight - chrome;
      const byW = (w - (layout.size.cols - 1) * GAP) / layout.size.cols;
      const byH = (h - (layout.size.rows - 1) * GAP) / layout.size.rows;
      const t = Math.floor(Math.min(byW, byH, TILE));
      setTile(Math.max(10, t));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [layout]);

  // Avance le personnage le long du chemin, case par case.
  useEffect(() => {
    if (path.length === 0) return;
    const [next, ...rest] = path;
    timerRef.current = window.setTimeout(() => {
      setPos(next);
      setPath(rest);
      if (rest.length === 0 && activeBuilding) {
        // Arrivé devant le bâtiment / PNJ : on ouvre le panneau.
        pushLog(`Vous êtes devant ${resolveLabel(activeBuilding)}.`);
      }
    }, STEP_MS);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [path, activeBuilding, pushLog]);

  if (!layout) {
    return (
      <div className="city">
        <div className="city-canvas-wrap">Cette ville n'a pas de layout.</div>
      </div>
    );
  }

  const { rows, cols } = layout.size;

  const moveTo = (target: Position) => {
    const p = findPath(layout, pos, target, buildings);
    if (p.length === 0) {
      pushLog('Inaccessible.');
      return;
    }
    setActiveBuilding(null);
    setPath(p);
  };

  const onTileClick = (row: number, col: number) => {
    const target = { row, col };
    // Bâtiment, caravane ou PNJ ? On marche jusqu'à la case marchable la plus
    // proche, puis on ouvre le panneau correspondant.
    const building = layout.buildings.find((b) => b.row === row && b.col === col);
    const resident = layout.residents?.find((r) => r.row === row && r.col === col);
    const isCaravan = !!layout.caravan && layout.caravan.row === row && layout.caravan.col === col;
    if (building || resident || isCaravan) {
      const service = building ? building.service : resident ? `resident:${resident.name}` : 'caravan';
      const anchor = building ?? resident ?? layout.caravan!;
      const stop = nearestWalkableToBuilding(layout, anchor, buildings);
      if (!stop) return;
      const alreadyThere = pos.row === stop.row && pos.col === stop.col;
      const p = findPath(layout, pos, stop, buildings);
      if (p.length === 0 && !alreadyThere) {
        pushLog('Inaccessible.');
        return;
      }
      setActiveBuilding(service);
      if (p.length > 0) {
        setPath(p);
      } else {
        // Déjà devant : on ouvre le panneau directement.
        const label = building ? BUILDING_LABEL[building.service] : resident ? resident.name : BUILDING_LABEL.caravan;
        pushLog(`Vous êtes devant ${label}.`);
      }
      return;
    }
    // Case de sortie ?
    if (layout.exit.row === row && layout.exit.col === col) {
      const p = findPath(layout, pos, target, buildings);
      if (p.length === 0) {
        pushLog('Inaccessible.');
        return;
      }
      setActiveBuilding(null);
      setPath(p);
      pushLog('Vous quittez la ville…');
      window.setTimeout(onBack, p.length * STEP_MS + 200);
      return;
    }
    // Case marchable ordinaire.
    moveTo(target);
  };

  // Position pixel du personnage (centre de la case). L'origine du
  // positionnement absolu est le bord du padding box → on ajoute le padding.
  // La taille du sprite suit la tuile (26px à 34px, proportionnel en dessous).
  const charSize = Math.round(tile * (26 / TILE));
  const charLeft = PADDING + pos.col * (tile + GAP) + (tile - charSize) / 2;
  const charTop = PADDING + pos.row * (tile + GAP) + (tile - charSize) / 2;

  const pathSet = new Set(path.map((p) => `${p.row},${p.col}`));

  // **Clôture** : les tuiles bloquées qui bordent le périmètre marchable
  // (adjacentes à au moins une tuile praticable) → barrière autour de la ville.
  const fenceSet = useMemo(() => {
    const s = new Set<string>();
    if (!layout) return s;
    const { rows, cols } = layout.size;
    const walk = (r: number, c: number) => !!layout.tileMap[r]?.[c];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (walk(r, c)) continue; // on ne clôture que les cases bloquées
        const nearWalk =
          walk(r - 1, c) || walk(r + 1, c) || walk(r, c - 1) || walk(r, c + 1);
        if (nearWalk) s.add(`${r},${c}`);
      }
    }
    return s;
  }, [layout]);

  return (
    <div className="city">
      {/* Retour mappemonde (mobile) : flottant, car le panneau latéral est
          un overlay masqué par défaut sur téléphone. */}
      <button className="city-back-mobile" onClick={onBack} title="Mappemonde">
        ← Mappemonde
      </button>
      <div className="city-main">
      <div className="city-canvas-wrap" ref={wrapRef}>
        <div
          className="city-grid"
          style={{
            gridTemplateColumns: `repeat(${cols}, ${tile}px)`,
            ['--tile' as string]: `${tile}px`,
          }}
        >
          {Array.from({ length: rows }).map((_, row) =>
            Array.from({ length: cols }).map((_, col) => {
              const walkable = layout.tileMap[row]?.[col];
              const building = layout.buildings.find((b) => b.row === row && b.col === col);
              const resident = layout.residents?.find((r) => r.row === row && r.col === col);
              const isExit = layout.exit.row === row && layout.exit.col === col;
              const isCaravan = !!layout.caravan && layout.caravan.row === row && layout.caravan.col === col;
              const onPath = pathSet.has(`${row},${col}`);
              let cls = 'tile ' + (walkable ? 'walk' : 'block');
              if (!walkable && fenceSet.has(`${row},${col}`)) cls += ' fence';
              if (building) cls = `tile building ${building.service}`;
              else if (resident) cls = 'tile resident';
              else if (isCaravan) cls = 'tile building caravan';
              else if (isExit) cls = 'tile exit';
              if (onPath) cls += ' path';
              return (
                <div
                  key={`${row}-${col}`}
                  className={cls}
                  onClick={() => (walkable || building || resident || isCaravan) && onTileClick(row, col)}
                  title={
                    building
                      ? BUILDING_LABEL[building.service]
                      : resident
                        ? `${resident.name} (PNJ)`
                        : isCaravan
                          ? BUILDING_LABEL.caravan
                          : isExit
                            ? layout.exit.label
                            : undefined
                  }
                >
                  {building ? BUILDING_ICON[building.service] : resident ? RESIDENT_ICON : isCaravan ? BUILDING_ICON.caravan : isExit ? '🚪' : ''}
                </div>
              );
            }),
          )}
          {/* Personnage (superposé, positionné en pixels) */}
          <div
            className="character"
            style={{ left: charLeft, top: charTop, width: charSize, height: charSize }}
          />
        </div>
      </div>

      <aside className={`city-side${sideCollapsed ? ' collapsed' : ''}${activeBuilding ? ' has-active' : ''}`}>
        {sideCollapsed ? (
          <button className="city-side-toggle" onClick={() => setSideCollapsed(false)} title="Ouvrir le panneau">
            ◀
          </button>
        ) : (
          <>
            <div className="city-side-head">
              <button onClick={onBack}>← Mappemonde</button>
              {/* Fermeture de l'overlay (mobile) : referme le panneau du bâtiment. */}
              <button
                className="city-side-close"
                onClick={() => setActiveBuilding(null)}
                title="Fermer"
              >
                ✕
              </button>
              <button
                className="city-side-toggle"
                onClick={() => setSideCollapsed(true)}
                title="Rétracter le panneau"
              >
                ▶
              </button>
            </div>
            <h3>{hub.name}</h3>
            <p className="hint">
              Cliquez sur une case pour vous y rendre. Cliquez sur un bâtiment
              pour interagir.
            </p>

            <div className="panel-section">
              <h4 className="building-title">
                {activeBuilding ? BUILDING_LABEL[activeBuilding] : 'Interactions'}
                {activeBuilding && state ? (
                  <span className="building-gold">— Pot commun {Math.round(state.party.gold * 100) / 100} or</span>
                ) : null}
              </h4>
              <CityPanels
                activeBuilding={activeBuilding}
                state={state}
                actions={actions}
                caravanDestinations={caravanDestinations}
                onClose={() => setActiveBuilding(null)}
              />
            </div>
          </>
        )}
      </aside>
      </div>

      {/* Journal en bas de l'écran (pleine largeur). */}
      <div className="city-log">
        <h4>Narrateur</h4>
        <div className="log">
          {log.length === 0 && <div className="entry">—</div>}
          {[...log].reverse().map((e, i) => (
            <div className="entry" key={i}>
              {e}
            </div>
          ))}
        </div>
      </div>

      {/* Journal repliable (mobile) : bouton 📜 + feuille. */}
      <CollapsibleLog entries={log} />
    </div>
  );
}
