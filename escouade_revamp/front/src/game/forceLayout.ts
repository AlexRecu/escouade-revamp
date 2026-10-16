import type { WorldSummary } from '../types/world';

/**
 * Layout force-directed pour la mappemonde (noeuds villes/zones).
 *
 * Simulation classique :
 *  - Répulsion entre tous les nœuds (loi de Coulomb).
 *  - Attraction le long des arêtes (ressort).
 *  - Gravité légère vers le centre.
 *  - La racine (Auberge du matin) est **ancrée à gauche** : l'arbre s'étend
 *    vers la droite.
 *
 * Déterministe (positions initiales dérivées de l'index) → le même monde
 * donne le même layout.
 */

export type TreeNode = {
  id: string;
  label: string;
  kind: 'hub' | 'dungeon';
  biome?: string;
  level?: number;
  x: number;
  y: number;
};

export type TreeEdge = { source: string; target: string };

export type TreeLayout = {
  nodes: TreeNode[];
  edges: TreeEdge[];
  width: number;
  height: number;
};

const WIDTH = 900;
const HEIGHT = 600;
const ITERATIONS = 400;
const REPULSION = 22000; // constante de répulsion
const SPRING = 0.02; // raideur du ressort
const REST_LENGTH = 110; // longueur de repos d'une arête
const CENTER_GRAVITY = 0.012;
const DAMPING = 0.85;
const ROOT_X = 90; // abscisse de la racine (ancrée à gauche)

/** Construit les nœuds et arêtes du graphe monde (hubs + donjons). */
export function buildGraph(world: WorldSummary): { nodes: TreeNode[]; edges: TreeEdge[] } {
  const nodes: TreeNode[] = [];
  world.hubs.forEach((h) => {
    nodes.push({
      id: h.id,
      label: h.name,
      kind: 'hub',
      x: 0,
      y: 0,
    });
  });
  world.dungeons.forEach((d) => {
    nodes.push({
      id: d.id,
      label: d.name,
      kind: 'dungeon',
      biome: d.biome,
      level: d.zoneLevel,
      x: 0,
      y: 0,
    });
  });

  // Arêtes : on déduplique (le graphe est non orienté).
  const seen = new Set<string>();
  const edges: TreeEdge[] = [];
  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const [from, targets] of Object.entries(world.edges)) {
    if (!nodeIds.has(from)) continue;
    for (const to of targets) {
      if (!nodeIds.has(to)) continue;
      const key = from < to ? `${from}|${to}` : `${to}|${from}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ source: from, target: to });
    }
  }
  return { nodes, edges };
}

/**
 * Calcule le layout force-directed.
 * @param rootId id du nœud racine (ancré à gauche).
 */
export function computeLayout(world: WorldSummary, rootId: string): TreeLayout {
  const { nodes, edges } = buildGraph(world);
  const index = new Map(nodes.map((n, i) => [n.id, i]));

  // Positions initiales déterministes (cercle) pour éviter les superpositions.
  nodes.forEach((n, i) => {
    const angle = (i / nodes.length) * Math.PI * 2;
    n.x = WIDTH / 2 + Math.cos(angle) * 150;
    n.y = HEIGHT / 2 + Math.sin(angle) * 150;
  });

  const rootIdx = index.get(rootId) ?? 0;
  nodes[rootIdx].x = ROOT_X;
  nodes[rootIdx].y = HEIGHT / 2;

  const vx = new Array(nodes.length).fill(0);
  const vy = new Array(nodes.length).fill(0);

  for (let iter = 0; iter < ITERATIONS; iter++) {
    // Répulsion (toutes les paires).
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        let dx = nodes[i].x - nodes[j].x;
        let dy = nodes[i].y - nodes[j].y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.01) {
          dx = (i - j) * 0.1;
          dy = 0.1;
          d2 = 0.02;
        }
        const d = Math.sqrt(d2);
        const force = REPULSION / d2;
        const fx = (dx / d) * force;
        const fy = (dy / d) * force;
        vx[i] += fx;
        vy[i] += fy;
        vx[j] -= fx;
        vy[j] -= fy;
      }
    }

    // Attraction (ressort le long des arêtes).
    for (const e of edges) {
      const a = index.get(e.source)!;
      const b = index.get(e.target)!;
      const dx = nodes[b].x - nodes[a].x;
      const dy = nodes[b].y - nodes[a].y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const force = SPRING * (d - REST_LENGTH);
      const fx = (dx / d) * force;
      const fy = (dy / d) * force;
      vx[a] += fx;
      vy[a] += fy;
      vx[b] -= fx;
      vy[b] -= fy;
    }

    // Gravité vers le centre + intégration.
    for (let i = 0; i < nodes.length; i++) {
      vx[i] += (WIDTH / 2 - nodes[i].x) * CENTER_GRAVITY;
      vy[i] += (HEIGHT / 2 - nodes[i].y) * CENTER_GRAVITY;

      if (i === rootIdx) {
        // Racine ancrée à gauche.
        nodes[i].x = ROOT_X;
        nodes[i].y = HEIGHT / 2;
        vx[i] = 0;
        vy[i] = 0;
        continue;
      }

      vx[i] *= DAMPING;
      vy[i] *= DAMPING;
      nodes[i].x += vx[i];
      nodes[i].y += vy[i];

      // Garder dans les bornes.
      nodes[i].x = Math.max(40, Math.min(WIDTH - 40, nodes[i].x));
      nodes[i].y = Math.max(40, Math.min(HEIGHT - 40, nodes[i].y));
    }
  }

  return { nodes, edges, width: WIDTH, height: HEIGHT };
}
