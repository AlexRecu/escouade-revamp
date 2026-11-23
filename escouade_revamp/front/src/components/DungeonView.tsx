import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ExplorationState, FishResult } from '../types/game';
import type { ExplorationDirection } from '../api/socket';
import CollapsibleLog from './CollapsibleLog';

type Props = {
  exploration: ExplorationState;
  logs: string[];
  fishResult: FishResult | null;
  onMove: (direction: ExplorationDirection) => void;
  onRest: () => void;
  onUseWood: () => void;
  onOpenChest: () => void;
  onBloodRitual: () => void;
  onFish: () => void;
  onFishMateus: () => void;
  onClearFishResult: () => void;
};

/**
 * Vue d'exploration d'un donjon (mode déplacement).
 *
 * Affiche la grille de l'étage courant (14×14), la position de l'équipe, les
 * feux de camp, les coffres, la sortie, et les cases déjà visitées. Le
 * déplacement se fait aux flèches (clavier ou boutons). Le combat n'est pas
 * encore branché.
 */
export default function DungeonView({ exploration, logs, fishResult, onMove, onRest, onUseWood, onOpenChest, onBloodRitual, onFish, onFishMateus, onClearFishResult }: Props) {
  const { tileMap, position, startTile, endTile, exitType, campfires, chests, activeChest, visited, activeCampfire, completed, demon, bloodDoor, biome } = exploration;

  // Lac de Qual-Chen : l'équipe est en barque 🚣‍♂️, orientée selon la
  // dernière direction de déplacement.
  const isLake = biome === 'Lake';
  const [boatDir, setBoatDir] = useState<ExplorationDirection>('east');
  const handleMove = useCallback((dir: ExplorationDirection) => {
    if (isLake) setBoatDir(dir);
    onMove(dir);
  }, [isLake, onMove]);

  // Animation de pêche : quand `fishResult` arrive, on anime la phase de
  // pêche (emoji 🎣/🚣‍♂️ alternant + ligne qui grossit de « . ») puis on
  // révèle le résultat à la seconde `atSecond`. Le résultat révélé est stocké
  // localement (revealedOutcome) pour rester affiché après le clear du prop.
  const [fishing, setFishing] = useState(false);
  const [dots, setDots] = useState(0);
  const [fishingEmoji, setFishingEmoji] = useState('🚣‍♂️');
  const [revealed, setRevealed] = useState(false);
  const [revealedOutcome, setRevealedOutcome] = useState<{ outcome: FishResult['outcome']; onMateusTile: boolean } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!fishResult) return;
    // Lancement de l'animation.
    setFishing(true);
    setRevealed(false);
    setRevealedOutcome(null);
    setDots(0);
    setFishingEmoji('🚣‍♂️');
    let second = 0;
    timerRef.current = setInterval(() => {
      second += 1;
      setDots(second);
      // Alterne 🎣 / 🚣‍♂️ chaque seconde.
      setFishingEmoji(second % 2 === 1 ? '🎣' : '🚣‍♂️');
      if (second >= fishResult.atSecond) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        setRevealed(true);
        setRevealedOutcome({ outcome: fishResult.outcome, onMateusTile: fishResult.onMateusTile });
        // Révélation : poisson → le sac se met à jour via exploration:state ;
        // Mateus → on lance le combat ; rien → message.
        if (fishResult.outcome === 'mateus') {
          onFishMateus();
        }
        onClearFishResult();
      }
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [fishResult, onFishMateus, onClearFishResult]);

  // Ligne de pêche affichée dans le journal pendant / après l'animation.
  const fishingLine = useMemo(() => {
    if (!fishing && !revealed) return null;
    if (!revealed) return `🎣 ${'.'.repeat(dots).split('').join(' ')}`;
    if (revealedOutcome?.outcome === 'fish') return '🐟 Poisson ! (+1 Poisson au sac)';
    if (revealedOutcome?.outcome === 'mateus') return '👹 Quelque chose de puissant tire sur la ligne…';
    return revealedOutcome?.onMateusTile
      ? '🪝 Quelque chose semble bloquer la ligne…'
      : '🎣 Ça ne mord pas.';
  }, [fishing, revealed, dots, revealedOutcome]);

  // Porte de sang (Phase D) : l'équipe peut faire le rituel quand elle est
  // **adjacente** à la porte (la case est bloquée, on ne peut pas y marcher).
  const adjacentToBloodDoor = useMemo(
    () =>
      !!bloodDoor &&
      Math.max(
        Math.abs(position.row - bloodDoor.row),
        Math.abs(position.col - bloodDoor.col)
      ) === 1,
    [bloodDoor, position]
  );

  // Nombre d'objets « Bois » dans le sac partagé de l'équipe.
  const woodCount = useMemo(
    () => exploration.party.bag.filter((i) => i.name === 'Bois').length,
    [exploration.party.bag]
  );

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

  // Index des coffres (row,col) → { type, opened }.
  const chestSet = useMemo(() => {
    const m = new Map<string, { type: 'common' | 'rare'; opened: boolean }>();
    for (const c of chests) if (c.row != null && c.col != null) m.set(`${c.row},${c.col}`, { type: c.type, opened: c.opened });
    return m;
  }, [chests]);

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
        handleMove(dir);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleMove, completed]);

  const rows = tileMap.length;
  const cols = tileMap[0]?.length ?? 0;
  // Icône de la tuile d'arrivée : porte (sortie) ou escalier (étage suivant).
  const exitIcon = exitType === 'door' ? '🚪' : '🪜';
  const exitLabel = exitType === 'door' ? 'Sortie' : 'Escalier';

  // Rotation de la barque 🚣‍♂️ (l'emoji fait face à l'ouest par défaut).
  const boatRotation = (dir: ExplorationDirection): number => {
    switch (dir) {
      case 'west': return 0;
      case 'north': return 90;
      case 'east': return 180;
      case 'south': return 270;
    }
  };

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
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({ length: rows }).map((_, r) =>
              Array.from({ length: cols }).map((_, c) => {
                const walkable = tileMap[r]?.[c] === true;
                const isPos = position.row === r && position.col === c;
                const isStart = startTile.row === r && startTile.col === c;
                const isEnd = endTile.row === r && endTile.col === c;
                const campUsed = campfireSet.get(`${r},${c}`);
                const chest = chestSet.get(`${r},${c}`);
                const isVisited = visitedSet.has(`${r},${c}`);

                let cls = 'tile';
                if (!walkable) cls += ' wall';
                else if (isVisited) cls += ' visited';
                else cls += ' unvisited';
                if (isPos) cls += ' party';

                const isDemon = demon && demon.row === r && demon.col === c;
                const isBloodDoor = bloodDoor && bloodDoor.row === r && bloodDoor.col === c;
                if (isBloodDoor) cls += ' blood-door';
                // Sur le lac, l'équipe est en barque 🚣‍♂️ orientée selon la
                // dernière direction ; sinon l'icône équipe 👥.
                const isBoat = isPos && isLake;
                let icon = '';
                if (isPos) icon = isLake ? '🚣‍♂️' : '👥';
                else if (campfireSet.has(`${r},${c}`)) icon = campUsed ? '🪵' : '🔥';
                else if (chest) icon = chest.opened ? '📭' : chest.type === 'rare' ? '💎' : '📦';
                else if (isDemon) icon = '👹';
                else if (isBloodDoor) icon = '🩸';
                else if (isEnd) icon = exitIcon;
                else if (isStart) icon = '📍';

                return (
                  <div key={`${r}-${c}`} className={cls}>
                    {icon && (
                      <span
                        className={isBoat ? 'tile-icon boat-icon' : 'tile-icon'}
                        style={isBoat ? { transform: `rotate(${boatRotation(boatDir)}deg)` } : undefined}
                      >
                        {icon}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
          <div className="dungeon-legend">
            <span>{isLake ? '🚣‍♂️ Barque' : '👥 Équipe'}</span>
            <span>🔥 Feu de camp</span>
            <span>📦 Coffre</span>
            <span>💎 Coffre rare</span>
            {demon && <span title={demon.name}>👹 Démon</span>}
            {bloodDoor && <span title="Porte de sang (Zeromus derrière)">🩸 Porte de sang</span>}
            <span>{exitIcon} {exitLabel}</span>
            <span>📍 Départ</span>
          </div>
          {/* Journal sous la légende. La ligne de pêche (animation) est
              ajoutée en tête du journal quand elle est active. */}
          <div className="dungeon-log">
            {fishingLine && (
              <div className="dungeon-log-line fishing-line">
                {fishingLine}
              </div>
            )}
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

          {activeChest && (
            <button
              className="dungeon-rest-btn"
              onClick={onOpenChest}
              disabled={activeChest.opened}
            >
              {activeChest.opened
                ? '📭 Coffre vide'
                : activeChest.type === 'rare'
                  ? '💎 Ouvrir le coffre rare'
                  : '📦 Ouvrir le coffre'}
            </button>
          )}

          {woodCount > 0 && (
            <button
              className="dungeon-rest-btn"
              onClick={onUseWood}
              disabled={completed}
              title="Allume un feu de camp sur la case courante (qui doit être vide) et s'y repose (+50% PV/MP)."
            >
              🪵 Allumer un feu de bois ({woodCount})
            </button>
          )}

          {adjacentToBloodDoor && (
            <button
              className="dungeon-rest-btn dungeon-blood-ritual-btn"
              onClick={onBloodRitual}
              disabled={completed}
              title="Consomme le « Cœur de sang » pour ouvrir la porte de sang et révéler Zeromus."
            >
              🩸 Faire le rituel de la porte de sang
            </button>
          )}

          {isLake && (
            <button
              className="dungeon-rest-btn dungeon-fish-btn"
              onClick={onFish}
              disabled={completed || fishing}
              title="Lance la ligne dans le lac. Sur les 5 cases de la croix, on peut pêcher Mateus."
            >
              {fishing ? `${fishingEmoji} Pêche en cours…` : '🎣 Pêcher'}
            </button>
          )}

          {/* Dpad décalé en bas de la colonne de contrôles. */}
          <div className="dungeon-dpad">
            <button
              className="dpad-btn up"
              onClick={() => handleMove('north')}
              disabled={completed}
              aria-label="Nord"
            >
              ▲
            </button>
            <div className="dpad-mid">
              <button
                className="dpad-btn left"
                onClick={() => handleMove('west')}
                disabled={completed}
                aria-label="Ouest"
              >
                ◀
              </button>
              <div className="dpad-center" />
              <button
                className="dpad-btn right"
                onClick={() => handleMove('east')}
                disabled={completed}
                aria-label="Est"
              >
                ▶
              </button>
            </div>
            <button
              className="dpad-btn down"
              onClick={() => handleMove('south')}
              disabled={completed}
              aria-label="Sud"
            >
              ▼
            </button>
          </div>
        </div>
      </div>

      {/* Journal repliable (mobile) : bouton 📜 + feuille. La ligne de pêche
          (animation) est ajoutée en tête quand elle est active. */}
      <CollapsibleLog entries={fishingLine ? [fishingLine, ...logs] : logs} />
    </div>
  );
}
