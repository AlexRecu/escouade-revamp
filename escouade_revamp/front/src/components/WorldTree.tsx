import { useMemo, useState } from 'react';
import type { WorldSummary, Hub, Dungeon } from '../types/world';
import { computeLayout, type TreeNode } from '../game/forceLayout';
import { monsterTokenUrl } from '../utils/tokens';

type Props = {
  world: WorldSummary;
  /** Zones terminées (niveau effectif des zones). */
  completedZones: Set<string>;
  /** Villes visitées (brouillard de guerre des villes, source de vérité serveur). */
  visitedHubs: Set<string>;
  /** Niveau de progression du monde (0 → 6). */
  worldLevel: number;
  /** Monstres déjà rencontrés (bestiaire) — les autres s'affichent « ? ». */
  seenMonsters: Set<string>;
  /** Hub de base (services de ville). */
  currentHubId: string | null;
  /** Nœud de position (hub OU donjon) — le cercle blanc suit cette position. */
  currentNodeId: string | null;
  onEnterHub: (hub: Hub) => void;
  /** Entre dans un donjon (exploration) → régénère la map + mode déplacement. */
  onEnterDungeon: (dungeonId: string) => void;
};

const HUB_COLOR = '#c9a227';
const DUNGEON_COLOR = '#7c5cff';
const EDGE_COLOR = '#3a3150';

/**
 * Mappemonde en **noeuds** (force-directed) : les villes (or) et les zones
 * d'exploration (violet) s'organisent en arbre. Cliquer sur une ville y entre.
 */
export default function WorldTree({
  world,
  completedZones,
  visitedHubs,
  worldLevel,
  seenMonsters,
  currentHubId,
  currentNodeId,
  onEnterHub,
  onEnterDungeon,
}: Props) {
  const [debugMode, setDebugMode] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rootId = world.hubs.find((h) => h.name === 'Auberge du matin')?.id ?? world.hubs[0]?.id;

  // L'équipe est-elle en ville (position = hub de base) ? Sinon, sur la
  // mappemonde, elle est à la sortie d'une zone (position = un donjon).
  const inCity = currentNodeId !== null && currentNodeId === currentHubId;
  // Nœuds accessibles depuis la **position actuelle** (hub OU donjon).
  // Bidirectionnel : une arête `pos → X` OU `X → pos` suffit (les transitions
  // sont orientées, ex. Qual-Far → Grotte → Qual-Chen : depuis Qual-Chen on
  // peut ré-entrer dans la Grotte, et depuis la Grotte on peut aller aux 2 villes).
  const adjacentIds = useMemo(() => {
    const set = new Set<string>();
    const posId = currentNodeId ?? '';
    for (const to of world.edges?.[posId] ?? []) set.add(to);
    for (const [from, targets] of Object.entries(world.edges ?? {})) {
      if (targets.includes(posId)) set.add(from);
    }
    return set;
  }, [world, currentNodeId]);

  /**
   * Un nœud est « verrouillé » si on ne peut pas s'y rendre depuis la position
   * actuelle :
   *  - **en ville** : seules les zones adjacentes sont entrables (pas de
   *    téléportation vers une autre ville).
   *  - **à la sortie d'une zone** (position = donjon) : les villes adjacentes
   *    sont accessibles (l'équipe choisit sa destination) ; les zones ne le
   *    sont pas (il faut d'abord passer par une ville).
   */
  const isLocked = (node: TreeNode): boolean => {
    if (node.id === currentNodeId) return false; // on est déjà ici
    if (inCity) {
      if (node.kind === 'hub') return true; // autres villes
      return !adjacentIds.has(node.id); // zones non adjacentes
    }
    // Position sur un donjon (sortie de zone) : villes adjacentes accessibles.
    if (node.kind === 'hub') return !adjacentIds.has(node.id);
    return true; // zones : il faut d'abord entrer dans une ville
  };

  const layout = useMemo(() => computeLayout(world, rootId!), [world, rootId]);
  const hubById = useMemo(() => new Map(world.hubs.map((h) => [h.id, h])), [world]);
  const dungeonById = useMemo(() => new Map(world.dungeons.map((d) => [d.id, d])), [world]);

  // **Brouillard de guerre des villes** : les villes révélées = celles que
  // l'équipe a déjà visitées (source de vérité serveur : `visitedHubs`). C'est
  // la même logique que la caravane (on ne voyage que vers des villes connues).
  const revealedHubs = useMemo(() => visitedHubs, [visitedHubs]);

  // Zones révélées = connectées à au moins un hub révélé.
  const revealedZones = useMemo(() => {
    const hubIds = new Set(world.hubs.map((h) => h.id));
    const revealed = new Set<string>();
    for (const [from, targets] of Object.entries(world.edges)) {
      if (hubIds.has(from) && revealedHubs.has(from)) {
        for (const to of targets) if (!hubIds.has(to)) revealed.add(to);
      }
      for (const to of targets) {
        if (hubIds.has(to) && revealedHubs.has(to) && !hubIds.has(from)) revealed.add(from);
      }
    }
    return revealed;
  }, [world, revealedHubs]);

  // Filtre de visibilité : en mode debug, tout est visible.
  const isNodeVisible = (n: TreeNode): boolean => {
    if (debugMode) return true;
    if (n.kind === 'hub') return revealedHubs.has(n.id);
    return revealedZones.has(n.id);
  };

  const visibleNodes = useMemo(
    () => layout.nodes.filter(isNodeVisible),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layout.nodes, debugMode, revealedHubs, revealedZones]
  );
  const visibleNodeIds = useMemo(
    () => new Set(visibleNodes.map((n) => n.id)),
    [visibleNodes]
  );
  const visibleEdges = useMemo(
    () => layout.edges.filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)),
    [layout.edges, visibleNodeIds]
  );

  // Niveau effectif dynamique : zone complétée → worldLevel, non complétée → worldLevel+1.
  const effectiveLevel = (zoneId: string): number => {
    const base = completedZones.has(zoneId) ? worldLevel : worldLevel + 1;
    return Math.min(6, Math.max(1, base));
  };

  const nodeById = new Map(layout.nodes.map((n) => [n.id, n]));
  const selectedNode = selectedId ? nodeById.get(selectedId) : undefined;

  return (
    <div className="worldtree">
      <div className="worldtree-legend">
        <span className="legend-item">
          <span className="dot" style={{ background: HUB_COLOR }} /> Ville
        </span>
        <span className="legend-item">
          <span className="dot" style={{ background: DUNGEON_COLOR }} /> Zone d'exploration
        </span>
        <span className="legend-hint">Cliquez sur un nœud pour le sélectionner.</span>
        <button
          className={`debug-toggle${debugMode ? ' active' : ''}`}
          onClick={() => setDebugMode((d) => !d)}
          title="Afficher / masquer le brouillard de guerre"
        >
          {debugMode ? '🔍 Debug: ON' : '🌫️ Brouillard'}
        </button>
      </div>

      <div className="worldtree-body">
        <div className="worldtree-map">
          <svg
            className="worldtree-svg"
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Arêtes (seulement celles entre nœuds visibles) */}
            {visibleEdges.map((e, i) => {
              const a = nodeById.get(e.source);
              const b = nodeById.get(e.target);
              if (!a || !b) return null;
              return (
                <line
                  key={i}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={EDGE_COLOR}
                  strokeWidth={2}
                />
              );
            })}

            {/* Nœuds (seulement les révélés) */}
            {visibleNodes.map((n) => (
              <Node
                key={n.id}
                node={n}
                isCurrent={n.id === currentNodeId}
                isLocked={isLocked(n)}
                isSelected={n.id === selectedId}
                showLevel={n.kind === 'dungeon'}
                effectiveLevel={n.kind === 'dungeon' ? effectiveLevel(n.id) : undefined}
                isCompleted={n.kind === 'dungeon' ? completedZones.has(n.id) : false}
                onClick={() => setSelectedId(n.id)}
              />
            ))}
          </svg>
        </div>

        <aside className="worldtree-panel">
          {selectedNode ? (
            selectedNode.kind === 'hub' ? (
              <HubPanel
                hub={hubById.get(selectedNode.id)!}
                locked={isLocked(selectedNode)}
                onEnter={() => {
                  const hub = hubById.get(selectedNode.id);
                  if (hub) onEnterHub(hub);
                }}
              />
            ) : (
              <DungeonPanel
                dungeon={dungeonById.get(selectedNode.id)!}
                level={effectiveLevel(selectedNode.id)}
                completed={completedZones.has(selectedNode.id)}
                seenMonsters={seenMonsters}
                locked={isLocked(selectedNode)}
                onEnter={() => onEnterDungeon(selectedNode.id)}
              />
            )
          ) : (
            <p className="hint">
              Sélectionnez une <b>ville</b> pour la voir, ou une <b>zone</b> pour
              connaître son niveau et ses monstres.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

// ── Panneau ville ──────────────────────────────────────────────────────────

function HubPanel({
  hub,
  locked,
  onEnter,
}: {
  hub: Hub;
  locked: boolean;
  onEnter: () => void;
}) {
  return (
    <div className="node-panel">
      <h3 className="node-panel-title">🏰 {hub.name}</h3>
      <p className="node-panel-desc">{hub.description}</p>
      <div className="node-panel-services">
        {hub.services.shop && <span className="svc">🏪 Marchand</span>}
        {hub.services.inn && <span className="svc">🛏️ Auberge</span>}
        {hub.services.church && <span className="svc">⛪ Sanctuaire</span>}
        {hub.services.questBoard && <span className="svc">📜 Quêtes</span>}
      </div>
      {locked && (
        <p className="node-panel-locked">
          🔒 Ville inaccessible : traversez une zone ou voyagez en caravane.
        </p>
      )}
      <button className="node-panel-btn" onClick={onEnter} disabled={locked}>
        Entrer en ville
      </button>
    </div>
  );
}

// ── Panneau donjon ─────────────────────────────────────────────────────────

function DungeonPanel({
  dungeon,
  level,
  completed,
  seenMonsters,
  locked,
  onEnter,
}: {
  dungeon: Dungeon;
  level: number;
  completed: boolean;
  seenMonsters: Set<string>;
  locked: boolean;
  onEnter: () => void;
}) {
  // Le nombre d'étages augmente avec la difficulté : 2 + niveau. Le lac est
  // une zone unique (1 étage, le port = entrée/sortie).
  const floors = dungeon.biome === 'Lake' ? 1 : 2 + level;
  return (
    <div className="node-panel">
      <h3 className="node-panel-title">⚔️ {dungeon.name}</h3>
      <p className="node-panel-meta">
        Niveau : <b>{level}</b> · {floors} étages
        {completed && <span className="done-tag"> · ✓ terminé</span>}
      </p>
      <h4 className="node-panel-sub">Monstres rencontrables</h4>
      <ul className="monster-list">
        {dungeon.monsters.length === 0 && (
          <li className="monster unknown">— (aucune rencontre)</li>
        )}
        {dungeon.monsters.map((m) => (
          <li key={m} className={seenMonsters.has(m) ? 'monster' : 'monster unknown'}>
            {seenMonsters.has(m) ? (
              <>
                <img
                  className="monster-token"
                  src={monsterTokenUrl(m)}
                  alt={m}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      '/assets/tokens/default.png';
                  }}
                />
                <span>{m}</span>
              </>
            ) : (
              '?'
            )}
          </li>
        ))}
      </ul>
      <p className="hint">
        La map est régénérée à chaque entrée. Déplacez-vous aux flèches (ou
        ZQSD) pour atteindre la sortie.
      </p>
      {locked && (
        <p className="node-panel-locked">
          🔒 Zone non accessible depuis votre position actuelle.
        </p>
      )}
      <button className="node-panel-btn" onClick={onEnter} disabled={locked}>
        {completed ? 'Re-entrer dans le donjon' : 'Entrer dans le donjon'}
      </button>
    </div>
  );
}

function Node({
  node,
  isCurrent,
  isLocked,
  isSelected,
  showLevel,
  effectiveLevel,
  isCompleted,
  onClick,
}: {
  node: TreeNode;
  /** Nœud de position de l'équipe → cercle blanc plein. */
  isCurrent: boolean;
  /** Nœud inaccessible depuis la position actuelle → cadenas + opacité. */
  isLocked: boolean;
  isSelected: boolean;
  showLevel: boolean;
  effectiveLevel?: number;
  /** Zone d'exploration déjà terminée → badge ✓. */
  isCompleted: boolean;
  onClick: () => void;
}) {
  const isHub = node.kind === 'hub';
  const r = isHub ? 22 : 16;
  const color = isHub ? HUB_COLOR : DUNGEON_COLOR;
  const level = effectiveLevel ?? node.level;
  const label = isHub
    ? node.label
    : showLevel && level
      ? `${node.label} · niv.${level}`
      : node.label;

  return (
    <g
      className={`worldtree-node${isLocked ? ' locked' : ''}`}
      transform={`translate(${node.x}, ${node.y})`}
      onClick={onClick}
      style={{ cursor: 'pointer', opacity: isLocked ? 0.45 : 1 }}
    >
      {isSelected && (
        <circle r={r + 5} fill="none" stroke="#fff" strokeWidth={2} strokeDasharray="4 3" />
      )}
      <circle
        r={r}
        fill={color}
        stroke={isCurrent ? '#fff' : '#0d0b14'}
        strokeWidth={isCurrent ? 3 : 2}
      />
      {isHub && <text className="node-icon" y={5} textAnchor="middle">🏰</text>}
      {!isHub && <text className="node-icon" y={5} textAnchor="middle">⚔️</text>}
      {isLocked && !isCurrent && (
        <text className="node-lock" x={r - 4} y={-r + 4} textAnchor="middle">🔒</text>
      )}
      {isCompleted && (
        <text className="node-done" x={r - 4} y={-r + 4} textAnchor="middle">✓</text>
      )}
      <text className="node-label" y={r + 14} textAnchor="middle">
        {label}
      </text>
    </g>
  );
}
