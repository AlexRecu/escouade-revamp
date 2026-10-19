import { useEffect, useMemo } from 'react';
import type { ExplorationState } from '../types/game';
import type { ExplorationDirection } from '../api/socket';

type Props = {
  exploration: ExplorationState;
  logs: string[];
  onMove: (direction: ExplorationDirection) => void;
  onRest: () => void;
};

/**
 * Vue d'exploration d'un donjon (mode déplacement).
 *
 * Affiche la grille de l'étage courant (14×14), la position de l'équipe, les
 * feux de camp, la sortie, et les cases déjà visitées. Le déplacement se fait
 * aux flèches (clavier ou boutons). Le combat n'est pas encore branché.
 */
export default function DungeonView({ exploration, logs, onMove, onRest }: Props) {
  const { tileMap, position, startTile, endTile, exitType, campfires, visited, activeCampfire, completed } = exploration;

  // Index des cases visitées (row,col) pour un accès O(1).
  const visitedSet = useMemo(() => {
    const s = new Set<string>();
    for (const v of visited) s.add(`${v.row},${v.col}`);
    return s;
  }, [visited]);

  // Index des feux de camp (row,col).
  const campfireSet = useMemo(() => {
    const m = new Map<string, boolean>(); // key → used
    for (const c of campfires) if (c.row != null && c.col != null) m.set(`${c.row},${c.col}`, c.used);
    return m;
  }, [campfires]);

  // Déplacement au clavier (flèches + ZQSD/WASD).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (completed) return;
      const k = e.key.toLowerCase();
      let dir: ExplorationDirection | null = null;
      if (k === 'arrowup' || k === 'z' || k === 'w') dir = 'north';
      else if (k === 'arrowdown' || k === 's') dir = 'south';
      else if (k === 'arrowleft' || k === 'q' || k === 'a') dir = 'west';
      else if (k === 'arrowright' || k === 'd') dir = 'east';
      if (dir) {
        e.preventDefault();
        onMove(dir);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onMove, completed]);

  const rows = tileMap.length;
  const cols = tileMap[0]?.length ?? 0;
  // Icône de la tuile d'arrivée : porte (sortie) ou escalier (étage suivant).
  const exitIcon = exitType === 'door' ? '🚪' : '🪜';
  const exitLabel = exitType === 'door' ? 'Sortie' : 'Escalier';

  return (
    <div className="dungeon-view">
      <div className="dungeon-header">
        <h2 className="dungeon-title">⚔️ {exploration.dungeonName}</h2>
        <p className="dungeon-meta">
          Étage <b>{exploration.floor}</b> / {exploration.totalFloors} · Niveau {exploration.zoneLevel}
          {completed && <span className="done-tag"> · ✓ terminé</span>}
        </p>
      </div>

      <div className="dungeon-body">
        <div className="dungeon-grid-wrap">
          <div
            className="dungeon-grid"
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
          >
            {Array.from({ length: rows }).map((_, r) =>
              Array.from({ length: cols }).map((_, c) => {
                const walkable = tileMap[r]?.[c] === true;
                const isPos = position.row === r && position.col === c;
                const isStart = startTile.row === r && startTile.col === c;
                const isEnd = endTile.row === r && endTile.col === c;
                const campUsed = campfireSet.get(`${r},${c}`);
                const isVisited = visitedSet.has(`${r},${c}`);

                let cls = 'tile';
                if (!walkable) cls += ' wall';
                else if (isVisited) cls += ' visited';
                else cls += ' unvisited';
                if (isPos) cls += ' party';

                let icon = '';
                if (isPos) icon = '👥';
                else if (campfireSet.has(`${r},${c}`)) icon = campUsed ? '🪵' : '🔥';
                else if (isEnd) icon = exitIcon;
                else if (isStart) icon = '📍';

                return (
                  <div key={`${r}-${c}`} className={cls}>
                    {icon && <span className="tile-icon">{icon}</span>}
                  </div>
                );
              })
            )}
          </div>
          <div className="dungeon-legend">
            <span>👥 Équipe</span>
            <span>🔥 Feu de camp</span>
            <span>{exitIcon} {exitLabel}</span>
            <span>📍 Départ</span>
          </div>
          {/* Journal sous la légende. */}
          <div className="dungeon-log">
            {logs.slice(-8).map((l, i) => (
              <div key={i} className="dungeon-log-line">
                {l}
              </div>
            ))}
          </div>
        </div>

        <div className="dungeon-controls">
          {activeCampfire && (
            <button
              className="dungeon-rest-btn"
              onClick={onRest}
              disabled={activeCampfire.used}
            >
              {activeCampfire.used
                ? 'Feu de camp éteint'
                : `🔥 Se reposer (+${Math.round(activeCampfire.restoredHp * 100)}% PV/MP)`}
            </button>
          )}

          {/* Dpad décalé en bas de la colonne de contrôles. */}
          <div className="dungeon-dpad">
            <button
              className="dpad-btn up"
              onClick={() => onMove('north')}
              disabled={completed}
              aria-label="Nord"
            >
              ▲
            </button>
            <div className="dpad-mid">
              <button
                className="dpad-btn left"
                onClick={() => onMove('west')}
                disabled={completed}
                aria-label="Ouest"
              >
                ◀
              </button>
              <div className="dpad-center" />
              <button
                className="dpad-btn right"
                onClick={() => onMove('east')}
                disabled={completed}
                aria-label="Est"
              >
                ▶
              </button>
            </div>
            <button
              className="dpad-btn down"
              onClick={() => onMove('south')}
              disabled={completed}
              aria-label="Sud"
            >
              ▼
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
