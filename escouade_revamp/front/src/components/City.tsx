import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Hub, Position } from '../types/world';
import type { GameState } from '../types/game';
import type { GameActions } from '../game/useGame';
import {
  buildingSet,
  findPath,
  nearestWalkableToBuilding,
} from '../game/pathfinding';
import CityPanels from './CityPanels';

const TILE = 34; // px (doit correspondre à .tile dans index.css)
const GAP = 2; // px (gap de la grille)
const PADDING = 4; // px (padding de .city-grid — origine du positionnement absolu)
const STEP_MS = 180; // durée d'une case (doit correspondre à la transition CSS)

const BUILDING_ICON: Record<string, string> = {
  shop: '🏪',
  inn: '🛏️',
  church: '⛪',
  questBoard: '📜',
};

const BUILDING_LABEL: Record<string, string> = {
  shop: 'Marchand',
  inn: 'Auberge',
  church: 'Sanctuaire',
  questBoard: 'Tableau des quêtes',
};

type Props = {
  hub: Hub;
  onBack: () => void;
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
export default function City({ hub, onBack, state, gameLogs, actions }: Props) {
  const layout = hub.layout;
  const [pos, setPos] = useState<Position>(layout?.startTile ?? { row: 0, col: 0 });
  const [path, setPath] = useState<Position[]>([]);
  const [activeBuilding, setActiveBuilding] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  // Barre latérale repliable (rendu mobile : libérer de la place à la carte).
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const timerRef = useRef<number | null>(null);

  const buildings = useMemo(() => (layout ? buildingSet(layout) : new Set<string>()), [layout]);

  const pushLog = useCallback((msg: string) => {
    setLog((l) => [...l.slice(-40), msg]);
  }, []);

  // Fusionne les logs du jeu (socket) dans le journal local.
  useEffect(() => {
    if (gameLogs.length > 0) {
      setLog((l) => [...l, ...gameLogs].slice(-60));
    }
  }, [gameLogs]);

  // Avance le personnage le long du chemin, case par case.
  useEffect(() => {
    if (path.length === 0) return;
    const [next, ...rest] = path;
    timerRef.current = window.setTimeout(() => {
      setPos(next);
      setPath(rest);
      if (rest.length === 0 && activeBuilding) {
        // Arrivé devant le bâtiment : on ouvre le panneau.
        pushLog(`Vous êtes devant le ${BUILDING_LABEL[activeBuilding] ?? activeBuilding}.`);
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
    // Bâtiment ? On marche jusqu'à la case marchable la plus proche.
    const building = layout.buildings.find((b) => b.row === row && b.col === col);
    if (building) {
      const stop = nearestWalkableToBuilding(layout, building, buildings);
      if (!stop) return;
      const alreadyThere = pos.row === stop.row && pos.col === stop.col;
      const p = findPath(layout, pos, stop, buildings);
      if (p.length === 0 && !alreadyThere) {
        pushLog('Inaccessible.');
        return;
      }
      setActiveBuilding(building.service);
      if (p.length > 0) {
        setPath(p);
      } else {
        // Déjà devant le bâtiment : on ouvre le panneau directement.
        pushLog(`Vous êtes devant le ${BUILDING_LABEL[building.service] ?? building.service}.`);
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
  const charLeft = PADDING + pos.col * (TILE + GAP) + (TILE - 26) / 2;
  const charTop = PADDING + pos.row * (TILE + GAP) + (TILE - 26) / 2;

  const pathSet = new Set(path.map((p) => `${p.row},${p.col}`));

  return (
    <div className="city">
      <div className="city-main">
      <div className="city-canvas-wrap">
        <div
          className="city-grid"
          style={{ gridTemplateColumns: `repeat(${cols}, ${TILE}px)` }}
        >
          {Array.from({ length: rows }).map((_, row) =>
            Array.from({ length: cols }).map((_, col) => {
              const walkable = layout.tileMap[row]?.[col];
              const building = layout.buildings.find((b) => b.row === row && b.col === col);
              const isExit = layout.exit.row === row && layout.exit.col === col;
              const onPath = pathSet.has(`${row},${col}`);
              let cls = 'tile ' + (walkable ? 'walk' : 'block');
              if (building) cls = `tile building ${building.service}`;
              if (isExit) cls = 'tile exit';
              if (onPath) cls += ' path';
              return (
                <div
                  key={`${row}-${col}`}
                  className={cls}
                  onClick={() => walkable && onTileClick(row, col)}
                  title={
                    building
                      ? BUILDING_LABEL[building.service]
                      : isExit
                        ? layout.exit.label
                        : undefined
                  }
                >
                  {building ? BUILDING_ICON[building.service] : isExit ? '🚪' : ''}
                </div>
              );
            }),
          )}
          {/* Personnage (superposé, positionné en pixels) */}
          <div className="character" style={{ left: charLeft, top: charTop }} />
        </div>
      </div>

      <aside className={`city-side${sideCollapsed ? ' collapsed' : ''}`}>
        {sideCollapsed ? (
          <button className="city-side-toggle" onClick={() => setSideCollapsed(false)} title="Ouvrir le panneau">
            ◀
          </button>
        ) : (
          <>
            <div className="city-side-head">
              <button onClick={onBack}>← Mappemonde</button>
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
                  <span className="building-gold">— Pot commun {state.party.gold} or</span>
                ) : null}
              </h4>
              <CityPanels
                activeBuilding={activeBuilding}
                state={state}
                actions={actions}
                onClose={() => setActiveBuilding(null)}
              />
            </div>
          </>
        )}
      </aside>
      </div>

      {/* Journal en bas de l'écran (pleine largeur). */}
      <div className="city-log">
        <h4>Journal</h4>
        <div className="log">
          {log.length === 0 && <div className="entry">—</div>}
          {log.map((e, i) => (
            <div className="entry" key={i}>
              {e}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
