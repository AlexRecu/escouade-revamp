import { useEffect, useMemo, useRef, useState } from 'react';
import type { CombatState, CombatUnit } from '../types/game';
import { classTokenUrl, monsterTokenUrl, DEFAULT_TOKEN_URL } from '../utils/tokens';

type Props = {
  combat: CombatState;
  logs: string[];
  /** Phase de placement : repositionne un héros sur les 2 lignes du bas. */
  onPlace: (unitId: string, position: { row: number; col: number }) => void;
  /** Valide le placement et démarre le combat. */
  onConfirmPlacement: () => void;
  onMove: (unitId: string, position: { row: number; col: number }) => void;
  onAct: (
    unitId: string,
    action: 'attack' | 'spell' | 'skill' | 'item' | 'combo',
    targetId: string | null,
    extra?: { spell?: { name: string }; skill?: { name: string }; item?: any; combo?: string[] }
  ) => void;
  onEndTurn: (unitId: string) => void;
  /** Un tour IA à la fois (animation des ennemis un par un). */
  onAiStep: () => void;
  onFlee: () => void;
};

/** Catégorie de sous-menu (les 3 qui ont une liste). */
type Submenu = 'none' | 'items' | 'skills' | 'spells';

/**
 * Vue de combat interactif (temps réel, tour par tour).
 *
 * Affiche le plateau 8×8 avec les unités (héros en bas, ennemis en haut), le
 * menu d'actions de l'unité courante (Attaque / Compétences / Sorts / Objets /
 * Fuir / Fin de tour), le ciblage visuel (cibles valides qui clignotent) et le
 * journal du combat.
 *
 * Flux : le joueur clique sur une case pour se déplacer (si déplacement
 * disponible), puis choisit une action dans le menu. Si l'action a des cibles,
 * les cibles valides clignotent et le joueur clique sur la cible pour valider.
 */
export default function CombatView({ combat, onPlace, onConfirmPlacement, onMove, onAct, onEndTurn, onAiStep, onFlee }: Props) {
  const { units, gridSize, turn, result, currentUnitId, actions, log, actionOrder, placement } = combat;

  // Unité courante (dont c'est le tour, contrôlée par le joueur).
  const currentUnit = useMemo(
    () => units.find((u) => u.id === currentUnitId) ?? null,
    [units, currentUnitId]
  );

  // Objets du sac **groupés par nom** (les doublons identiques sont empilés
  // avec un compteur ×N, comme dans l'onglet Vendre de la ville). On conserve
  // l'id du premier objet du groupe pour l'utiliser au clic.
  const groupedItems = useMemo(() => {
    const map = new Map<string, { name: string; id: string; count: number; validTargets: string[] }>();
    for (const it of actions?.items ?? []) {
      const g = map.get(it.name);
      if (g) {
        g.count += 1;
      } else {
        map.set(it.name, { name: it.name, id: it.id, count: 1, validTargets: it.validTargets });
      }
    }
    return Array.from(map.values());
  }, [actions?.items]);

  // Phase de placement : id du héros sélectionné à repositionner (null = aucun).
  const [placingHeroId, setPlacingHeroId] = useState<string | null>(null);
  // Mode de sélection : "move" (déplacement) ou "target" (ciblage d'une action).
  const [mode, setMode] = useState<'idle' | 'move' | 'target'>('idle');
  // Sous-menu ouvert (items / skills / spells) ou fermé.
  const [submenu, setSubmenu] = useState<Submenu>('none');
  // Action en cours de ciblage (spell / skill / item / attack).
  const [pendingAction, setPendingAction] = useState<{
    action: 'attack' | 'spell' | 'skill' | 'item';
    name?: string;
    extra?: { spell?: { name: string }; skill?: { name: string }; item?: any };
  } | null>(null);

  // Auto-scroll du journal : on reste collé au bas (dernière entrée) quand de
  // nouvelles lignes arrivent.
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log]);

  // ── Enchaînement des tours IA (animation un ennemi à la fois) ────────────
  // Quand l'état de combat arrive et que l'acteur courant est un **ennemi**
  // (`currentUnitId` null, combat en cours, placement validé), on demande au
  // serveur d'exécuter **un seul** tour IA après un délai : le temps que la
  // transition CSS du déplacement + les effets visuels du tour précédent se
  // jouent. Le serveur renvoie l'état suivant ; si c'est encore un ennemi,
  // l'effet se ré-enchaine. Dès que c'est un héros, `currentUnitId` est défini
  // et on rend la main au joueur.
  const onAiStepRef = useRef(onAiStep);
  onAiStepRef.current = onAiStep;
  useEffect(() => {
    if (placement || result !== 'ongoing') return;
    if (currentUnitId !== null) return; // tour du joueur → on ne pilote pas l'IA.
    const t = setTimeout(() => onAiStepRef.current(), 950);
    return () => clearTimeout(t);
  }, [combat, placement, result, currentUnitId]);

  // ── Effets visuels ──────────────────────────────────────────────────────
  // On compare l'état de combat précédent au courant pour détecter : dégâts
  // (PV ↓), soin (PV ↑), mana (MP ↑) et statuts gagnés (bouclier, poison…).
  // Chaque effet est une clé `id:nom` ; la classe CSS correspondante anime le
  // token (flash rouge, étincelle verte, icône de bouclier…).
  const prevCombatRef = useRef<CombatState | null>(null);
  const [effects, setEffects] = useState<Record<string, string[]>>({});
  useEffect(() => {
    const prev = prevCombatRef.current;
    prevCombatRef.current = combat;
    if (!prev) return;
    const fx: Record<string, string[]> = {};
    const add = (id: string, e: string) => {
      (fx[id] ??= []).push(e);
    };
    for (const u of combat.units) {
      const p = prev.units.find((x) => x.id === u.id);
      if (!p) continue;
      if (u.currentHp < p.currentHp) add(u.id, 'fx-damage');
      else if (u.currentHp > p.currentHp) add(u.id, 'fx-heal');
      if ((u.currentMp ?? 0) > (p.currentMp ?? 0)) add(u.id, 'fx-mp');
      // Statuts gagnés (ex. Bouclier impénétrable, Poison…).
      for (const s of u.status ?? []) {
        if (!(p.status ?? []).some((ps) => ps.name === s.name)) {
          add(u.id, `fx-status-${s.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`);
        }
      }
    }
    if (Object.keys(fx).length > 0) {
      setEffects(fx);
      const t = setTimeout(() => setEffects({}), 900);
      return () => clearTimeout(t);
    }
  }, [combat]);

  // ── Effet d'action (potion / sort / compétence / attaque de zone) ────────
  // Le serveur envoie `lastAction` (avec un `seq` croissant) : on détecte le
  // changement et on anime la nature de l'action. Pour les attaques de zone
  // (plusieurs cibles affectées), on surligne **toutes** les cases impactées.
  const prevActionSeqRef = useRef<number>(-1);
  const [actionFx, setActionFx] = useState<{
    kind: string;
    name?: string;
    actorId: string;
    targetIds: string[];
  } | null>(null);
  useEffect(() => {
    const la = combat.lastAction;
    if (!la || la.seq === prevActionSeqRef.current) return;
    prevActionSeqRef.current = la.seq;
    setActionFx({ kind: la.kind, name: la.name, actorId: la.actorId, targetIds: la.targetIds });
    const t = setTimeout(() => setActionFx(null), 900);
    return () => clearTimeout(t);
  }, [combat.lastAction]);

  // Icône d'un statut (pour l'affichage sur le token).
  const statusIcon = (name: string): string => {
    const n = name.toLowerCase();
    if (n.includes('bouclier') || n.includes('impénétrable') || n.includes('garde')) return '🛡️';
    if (n.includes('poison') || n.includes('empoison')) return '☠️';
    if (n.includes('brûlure') || n.includes('brûl') || n.includes('feu')) return '🔥';
    if (n.includes('gel') || n.includes('glace') || n.includes('froid')) return '❄️';
    if (n.includes('paralys') || n.includes('étourdi') || n.includes('endormi')) return '💫';
    if (n.includes('soin') || n.includes('régén')) return '✨';
    return '•';
  };

  // Cases de déplacement valides (adjacentes à l'unité courante, libres).
  const moveTargets = useMemo(() => {
    if (!currentUnit || !actions?.canMove) return new Set<string>();
    const s = new Set<string>();
    const occupied = new Set(units.filter((u) => !u.isDead && !u.isReplaced).map((u) => `${u.position.row},${u.position.col}`));
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = currentUnit.position.row + dr;
        const c = currentUnit.position.col + dc;
        if (r < 0 || r >= gridSize || c < 0 || c >= gridSize) continue;
        if (occupied.has(`${r},${c}`)) continue;
        s.add(`${r},${c}`);
      }
    }
    return s;
  }, [currentUnit, actions, units, gridSize]);

  // Cibles valides de l'action en cours de ciblage.
  const targetIds = useMemo(() => {
    if (!pendingAction) return new Set<string>();
    if (pendingAction.action === 'attack') return new Set(actions?.attack.validTargets ?? []);
    if (pendingAction.action === 'spell') {
      const spell = actions?.spells.find((s) => s.name === pendingAction.name);
      return new Set(spell?.validTargets ?? []);
    }
    if (pendingAction.action === 'skill') {
      const skill = actions?.skills.find((s) => s.name === pendingAction.name);
      return new Set(skill?.validTargets ?? []);
    }
    if (pendingAction.action === 'item') {
      const item = actions?.items.find((i) => i.id === pendingAction.name);
      return new Set(item?.validTargets ?? []);
    }
    return new Set<string>();
  }, [pendingAction, actions]);

  // Positions (clé "row,col") des cibles valides : `targetIds` contient des
  // **ids d'unités**, or le plateau est indexé par position. On convertit pour
  // pouvoir surligner les tuiles et résoudre le clic.
  const targetPositions = useMemo(() => {
    const s = new Set<string>();
    for (const u of units) {
      if (targetIds.has(u.id)) s.add(`${u.position.row},${u.position.col}`);
    }
    return s;
  }, [targetIds, units]);

  // Positions (clé "row,col") des cases **impactées par la dernière action**
  // (attaques de zone, soins de zone…) : on surligne chaque case pendant
  // l'animation pour montrer visuellement la zone touchée.
  const actionZonePositions = useMemo(() => {
    if (!actionFx) return new Set<string>();
    const s = new Set<string>();
    for (const u of units) {
      if (actionFx.targetIds.includes(u.id)) s.add(`${u.position.row},${u.position.col}`);
    }
    return s;
  }, [actionFx, units]);

  // Trajectoire du projectile (attaques à distance / sorts) : de la position de
  // l'acteur à celle de la cible, en % de la couche d'unités (case = 12.5%).
  // Affiché uniquement pour les actions de type "spell" (sorts de héros et
  // attaques magiques des monstres).
  const projectile = useMemo(() => {
    if (!actionFx || actionFx.kind !== 'spell') return null;
    const actor = units.find((u) => u.id === actionFx.actorId);
    const target = units.find((u) => actionFx.targetIds.includes(u.id));
    if (!actor || !target) return null;
    const cell = 100 / gridSize;
    const center = (p: { row: number; col: number }) => ({
      x: (p.col + 0.5) * cell,
      y: (p.row + 0.5) * cell,
    });
    const from = center(actor.position);
    const to = center(target.position);
    return { from, to, key: actionFx.actorId + actionFx.targetIds.join(',') };
  }, [actionFx, units, gridSize]);

  // Icône de la dernière action (potion / sort / compétence / attaque).
  const actionIcon = (kind: string): string => {
    switch (kind) {
      case 'item': return '🧪';
      case 'spell': return '✨';
      case 'skill': return '⚡';
      case 'combo': return '🌀';
      default: return '⚔️';
    }
  };

  // Unité par position (pour afficher sur le plateau).
  const unitAt = useMemo(() => {
    const m = new Map<string, CombatUnit>();
    for (const u of units) {
      if (u.isDead || u.isReplaced) continue;
      m.set(`${u.position.row},${u.position.col}`, u);
    }
    return m;
  }, [units]);

  // Phase de placement : cases valides (lignes 6-7, libres).
  const placementTargets = useMemo(() => {
    if (!placement) return new Set<string>();
    const s = new Set<string>();
    const occupied = new Set(units.filter((u) => !u.isDead && !u.isReplaced).map((u) => `${u.position.row},${u.position.col}`));
    for (let row = gridSize - 2; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        if (!occupied.has(`${row},${col}`)) s.add(`${row},${col}`);
      }
    }
    return s;
  }, [placement, units, gridSize]);

  // Clic sur une case du plateau.
  const handleTileClick = (row: number, col: number) => {
    const key = `${row},${col}`;
    // Phase de placement : cliquer sur un héros le sélectionne ; cliquer sur
    // une case libre (lignes 6-7) y déplace le héros sélectionné.
    if (placement) {
      const unitHere = unitAt.get(key);
      if (unitHere?.type === 'Hero') {
        setPlacingHeroId(unitHere.id === placingHeroId ? null : unitHere.id);
        return;
      }
      if (placingHeroId && placementTargets.has(key)) {
        onPlace(placingHeroId, { row, col });
        setPlacingHeroId(null);
      }
      return;
    }
    if (!currentUnit) return;
    if (mode === 'move' && moveTargets.has(key)) {
      onMove(currentUnit.id, { row, col });
      setMode('idle');
      return;
    }
    if (mode === 'target' && targetPositions.has(key)) {
      const unit = unitAt.get(key);
      if (unit && pendingAction) {
        onAct(currentUnit.id, pendingAction.action, unit.id, pendingAction.extra);
        setPendingAction(null);
        setMode('idle');
        setSubmenu('none');
      }
      return;
    }
    // Clic sur une case sans action valide → retour à l'état neutre.
    setMode('idle');
    setPendingAction(null);
  };

  // Lance une action de ciblage (ou l'exécute si auto-cible).
  const launchAction = (
    action: 'attack' | 'spell' | 'skill' | 'item',
    name?: string,
    extra?: { spell?: { name: string }; skill?: { name: string }; item?: any },
    validTargets?: string[]
  ) => {
    if (!currentUnit) return;
    // Les **objets** exigent toujours de désigner une cible (même un objet
    // auto-cible) : le joueur choisit explicitement sur qui l'appliquer.
    // Les autres actions (sort/sort auto-cible unique) peuvent s'exécuter
    // directement.
    if (
      action !== 'item' &&
      validTargets &&
      validTargets.length === 1 &&
      validTargets[0] === currentUnit.id
    ) {
      onAct(currentUnit.id, action, currentUnit.id, extra);
      setSubmenu('none');
      return;
    }
    setPendingAction({ action, name, extra });
    setMode('target');
  };

  // Ouvre/ferme un sous-menu de catégorie.
  const toggleSubmenu = (cat: Submenu) => {
    setSubmenu(submenu === cat ? 'none' : cat);
    setPendingAction(null);
    setMode('idle');
  };

  const isOver = result !== 'ongoing';
  const isSamurai = currentUnit?.jobName === 'Samouraï';

  // Token (image) d'une unité : classe pour les héros, nom du monstre sinon.
  const unitTokenUrl = (u: CombatUnit): string =>
    u.type === 'Hero' ? classTokenUrl(u.jobName ?? '') : monsterTokenUrl(u.name);

  return (
    <div className="combat-view">
      <div className="combat-header">
        <h2 className="combat-title">⚔️ Combat</h2>
        <p className="combat-meta">
          Tour <b>{turn}</b>
          {currentUnit && !isOver && (
            <span className="combat-turn-unit"> · Au tour de <b>{currentUnit.name}</b></span>
          )}
          {isOver && (
            <span className={`combat-result combat-result-${result}`}>
              {result === 'victory' ? ' · 🏆 Victoire !' : result === 'defeat' ? ' · 💀 Défaite…' : ' · 💨 Fuite !'}
            </span>
          )}
        </p>
      </div>

      <div className="combat-body">
        {/* Plateau 8x8 */}
        <div className="combat-board-wrap">
          {/* File d'ordre des actions du tour (héros + ennemis, par vitesse). */}
          {actionOrder.length > 0 && (
            <div className="combat-order">
              <span className="combat-order-label">Ordre :</span>
              {actionOrder.map((entry) => (
                <span
                  key={entry.id}
                  className={`order-chip ${entry.type === 'Hero' ? 'order-hero' : 'order-enemy'} ${entry.acted ? 'order-acted' : ''} ${entry.id === currentUnitId ? 'order-current' : ''}`}
                  title={`${entry.name} (vitesse ${entry.speed})`}
                >
                  {entry.type === 'Hero' ? '🧙' : '👹'} {entry.name}
                </span>
              ))}
            </div>
          )}
          <div
            className="combat-board"
            style={{
              gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
              gridTemplateRows: `repeat(${gridSize}, 1fr)`,
            }}
          >
            {Array.from({ length: gridSize * gridSize }).map((_, i) => {
              const row = Math.floor(i / gridSize);
              const col = i % gridSize;
              const key = `${row},${col}`;
              const unit = unitAt.get(key);
              const isCurrent = unit?.id === currentUnitId;
              const isMoveTarget = mode === 'move' && moveTargets.has(key);
              const isTarget = mode === 'target' && targetPositions.has(key);
              // Phase de placement : cases valides (lignes 6-7 libres) + héros sélectionné.
              const isPlacementTarget = placement && placementTargets.has(key);
              const isPlacingHero = placement && unit?.id === placingHeroId;
              const isEven = (row + col) % 2 === 0;

              let cls = `combat-tile ${isEven ? 'tile-light' : 'tile-dark'}`;
              if (isMoveTarget) cls += ' tile-move';
              if (isTarget) cls += ' tile-target';
              if (isCurrent) cls += ' tile-current';
              if (isPlacementTarget) cls += ' tile-placement';
              if (isPlacingHero) cls += ' tile-placing';
              // Case impactée par la dernière action (attaque de zone, soin…).
              if (actionFx && actionZonePositions.has(key)) cls += ' tile-action-zone';

              return (
                <div
                  key={key}
                  className={cls}
                  onClick={() => handleTileClick(row, col)}
                  title={unit ? `${unit.name} (${unit.currentHp}/${unit.maxHp})` : undefined}
                />
              );
            })}

            {/* Couche des unités (overlay) : positionnée en % de case, la
                transition CSS anime le déplacement (interpolation). */}
            <div className="combat-units-layer">
              {units
                .filter((u) => !u.isDead && !u.isReplaced)
                .map((unit) => {
                  const isCurrent = unit.id === currentUnitId;
                  const isPlacingHero = placement && unit.id === placingHeroId;
                  const fx = effects[unit.id] ?? [];
                  const fxCls = fx.length ? ` ${fx.join(' ')}` : '';
                  return (
                    <div
                      key={unit.id}
                      className="combat-unit-overlay"
                      style={{
                        transform: `translate(${unit.position.col * 100}%, ${unit.position.row * 100}%)`,
                      }}
                    >
                      <div
                        className={`combat-unit ${unit.type === 'Hero' ? 'unit-hero' : 'unit-enemy'} ${isCurrent ? 'unit-active' : ''} ${isPlacingHero ? 'unit-placing' : ''}${fxCls}`}
                      >
                        <img
                          className="unit-token"
                          src={unitTokenUrl(unit)}
                          alt={unit.name}
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = DEFAULT_TOKEN_URL;
                          }}
                        />
                        {/* Badge de la dernière action (potion / sort / compétence). */}
                        {actionFx && actionFx.actorId === unit.id && (
                          <span
                            className={`unit-action-badge fx-action-${actionFx.kind}`}
                            title={actionFx.name ?? actionFx.kind}
                          >
                            {actionIcon(actionFx.kind)}
                          </span>
                        )}
                        <span className="unit-name">{unit.name}</span>
                        <div className="unit-hpbar">
                          <div
                            className="unit-hpfill"
                            style={{ width: `${(unit.currentHp / unit.maxHp) * 100}%` }}
                          />
                        </div>
                        <span className="unit-hptext">{unit.currentHp}/{unit.maxHp}</span>
                        {(unit.status ?? []).length > 0 && (
                          <span className="unit-status-icons">
                            {unit.status.map((s, si) => (
                              <span
                                key={si}
                                className={`status-icon ${fx.includes(`fx-status-${s.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`) ? 'fx-status-new' : ''}`}
                                title={s.name}
                              >
                                {statusIcon(s.name)}
                              </span>
                            ))}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              {/* Projectile d'attaque à distance / sort (acteur → cible). */}
              {projectile && (
                <div
                  key={projectile.key}
                  className="combat-projectile"
                  style={{
                    ['--from-x' as string]: `${projectile.from.x}%`,
                    ['--from-y' as string]: `${projectile.from.y}%`,
                    ['--to-x' as string]: `${projectile.to.x}%`,
                    ['--to-y' as string]: `${projectile.to.y}%`,
                  }}
                >
                  <span className="combat-projectile-core" />
                </div>
              )}
            </div>
          </div>
          <div className="combat-legend">
            <span><i className="legend-swatch swatch-move" /> Déplacement</span>
            <span><i className="legend-swatch swatch-target" /> Cible</span>
            <span><i className="legend-swatch swatch-current" /> Au tour</span>
          </div>
        </div>

        {/* Panneau latéral : actions + journal */}
        <div className="combat-side">
          <div className="combat-actions">
            {placement ? (
              <>
                <h4 className="placement-title">📍 Placement de l'équipe</h4>
                <p className="placement-hint">
                  Cliquez sur un héros pour le sélectionner, puis sur une case
                  libre des <b>deux dernières lignes</b> pour le repositionner.
                </p>
                <button className="action-endturn placement-confirm" onClick={onConfirmPlacement}>
                  ✅ Valider le placement
                </button>
              </>
            ) : isOver ? (
              <p className="combat-over-msg">
                {result === 'victory' ? "🏆 Victoire ! Le butin est en train d'être distribué…"
                  : result === 'defeat' ? "💀 Défaite… L'équipe est ramenée à l'entrée."
                  : "💨 L'équipe s'est échappée."}
              </p>
            ) : currentUnit && actions ? (
              <>
                {/* Grille 3x2 de catégories (style Pokémon). */}
                <div className="action-grid">
                  <button
                    className={`action-cat ${mode === 'move' ? 'active' : ''}`}
                    disabled={!actions.canMove}
                    onClick={() => { setMode(mode === 'move' ? 'idle' : 'move'); setPendingAction(null); setSubmenu('none'); }}
                  >
                    🚶 Déplacer
                  </button>
                  <button
                    className={`action-cat ${pendingAction?.action === 'attack' ? 'active' : ''}`}
                    disabled={actions.attack.validTargets.length === 0}
                    onClick={() => { setSubmenu('none'); launchAction('attack', undefined, undefined, actions.attack.validTargets); }}
                  >
                    ⚔️ Attaquer
                  </button>
                  <button
                    className={`action-cat ${submenu === 'items' ? 'active' : ''}`}
                    disabled={actions.items.length === 0}
                    onClick={() => toggleSubmenu('items')}
                  >
                    🎒 Objets
                  </button>
                  <button
                    className={`action-cat ${submenu === 'skills' ? 'active' : ''}`}
                    disabled={actions.skills.length === 0}
                    onClick={() => toggleSubmenu('skills')}
                  >
                    {isSamurai ? '🌀 Combo' : '✨ Compétences'}
                  </button>
                  <button
                    className={`action-cat ${submenu === 'spells' ? 'active' : ''}`}
                    disabled={actions.spells.length === 0}
                    onClick={() => toggleSubmenu('spells')}
                  >
                    🔮 Sorts
                  </button>
                  <button
                    className="action-cat action-flee"
                    onClick={onFlee}
                  >
                    🏃 Fuir
                  </button>
                </div>

                {/* Sous-menu : liste de la catégorie sélectionnée. */}
                {submenu === 'items' && (
                  <div className="submenu">
                    <div className="submenu-header">
                      <span>Objets</span>
                      <button className="submenu-close" onClick={() => setSubmenu('none')}>✕</button>
                    </div>
                    <div className="submenu-list">
                      {groupedItems.map((g) => (
                        <button
                          key={g.id}
                          className={`submenu-item ${pendingAction?.name === g.id ? 'active' : ''}`}
                          disabled={g.validTargets.length === 0}
                          onClick={() => launchAction('item', g.id, { item: { id: g.id, name: g.name } }, g.validTargets)}
                        >
                          🧪 {g.name}
                          {g.count > 1 && <span className="bag-count"> ×{g.count}</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {submenu === 'skills' && (
                  <div className="submenu">
                    <div className="submenu-header">
                      <span>{isSamurai ? 'Combo' : 'Compétences'}</span>
                      <button className="submenu-close" onClick={() => setSubmenu('none')}>✕</button>
                    </div>
                    <div className="submenu-list">
                      {actions.skills.map((sk) => {
                        const notEnoughAp = currentUnit.currentAp! < sk.apCost;
                        const noTarget = sk.validTargets.length === 0;
                        // Explication de la grisaille : AP insuffisante OU hors
                        // de portée (aucune cible à portée). Affichée en tooltip.
                        const disabledReason = notEnoughAp
                          ? `AP insuffisante (${sk.apCost} requis, ${currentUnit.currentAp} dispo)`
                          : noTarget
                            ? 'Hors de portée — rapprochez-vous de la cible'
                            : null;
                        return (
                          <button
                            key={sk.name}
                            className={`submenu-item ${pendingAction?.name === sk.name ? 'active' : ''}`}
                            disabled={notEnoughAp || noTarget}
                            title={disabledReason ? `${sk.description}\n⚠️ ${disabledReason}` : sk.description}
                            onClick={() => launchAction('skill', sk.name, { skill: { name: sk.name } }, sk.validTargets)}
                          >
                            {sk.name} <span className="action-cost">({sk.apCost} AP)</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {submenu === 'spells' && (
                  <div className="submenu">
                    <div className="submenu-header">
                      <span>Sorts</span>
                      <button className="submenu-close" onClick={() => setSubmenu('none')}>✕</button>
                    </div>
                    <div className="submenu-list">
                      {actions.spells.map((sp) => (
                        <button
                          key={sp.name}
                          className={`submenu-item ${pendingAction?.name === sp.name ? 'active' : ''}`}
                          disabled={(currentUnit.currentMp ?? 0) < (sp.mpCost ?? 0) || sp.validTargets.length === 0}
                          title={sp.description}
                          onClick={() => launchAction('spell', sp.name, { spell: { name: sp.name } }, sp.validTargets)}
                        >
                          {sp.name} <span className="action-cost">({sp.mpCost ?? 0} MP)</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Fin de tour (en dessous du menu). */}
                <button className="action-endturn" onClick={() => onEndTurn(currentUnit.id)}>
                  ⏭️ Fin de tour
                </button>

                {mode === 'target' && (
                  <p className="combat-hint">Cliquez sur une cible clignotante pour valider.</p>
                )}
                {mode === 'move' && (
                  <p className="combat-hint">Cliquez sur une case verte pour vous déplacer.</p>
                )}
              </>
            ) : (
              <p className="combat-waiting">En attente…</p>
            )}
          </div>

          {/* Journal du combat (uniquement les événements de combat, pas
              les logs d'exploration qui noieraient les actions). */}
          <div className="combat-log">
            <h4>Journal</h4>
            <div className="combat-log-entries" ref={logRef}>
              {log.map((entry, i) => (
                <p key={i} className="log-entry">{entry}</p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
