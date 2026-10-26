import { useEffect, useMemo, useState } from 'react';
import type { GameState, ShopItem, BagItem } from '../types/game';
import type { GameActions } from '../game/useGame';
import type { Status } from '../types/world';
import { fetchStatuses } from '../api/client';
import { weaponEmoji, weaponStatLabel, weaponRangeLabel, canEquip } from '../utils/weapons';

type Props = {
  activeBuilding: string | null;
  state: GameState | null;
  actions: GameActions;
  /** Destinations de caravane (villes révélées au-delà d'une zone adjacente). */
  caravanDestinations: { id: string; name: string }[];
  onClose: () => void;
};

/**
 * Panneaux d'interaction de ville (temps réel).
 *
 * Selon le bâtiment actif, affiche : boutique (acheter / revendre), auberge
 * (nuit), sanctuaire (ranimer) ou tableau des quêtes (accepter). Chaque
 * action passe par le socket (voir `useGame`).
 */
export default function CityPanels({ activeBuilding, state, actions, caravanDestinations, onClose }: Props) {
  if (!activeBuilding) {
    return (
      <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>
        Aucun bâtiment sélectionné.
      </p>
    );
  }
  if (!state) {
    return <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>Chargement…</p>;
  }

  switch (activeBuilding) {
    case 'shop':
      return <ShopPanel state={state} actions={actions} onClose={onClose} />;
    case 'inn':
      return <InnPanel state={state} actions={actions} onClose={onClose} />;
    case 'church':
      return <SanctuaryPanel state={state} actions={actions} onClose={onClose} />;
    case 'questBoard':
      return <QuestPanel state={state} actions={actions} onClose={onClose} />;
    case 'caravan':
      return <CaravanPanel state={state} actions={actions} destinations={caravanDestinations} />;
    default:
      return (
        <div>
          <p style={{ fontSize: 13 }}>{activeBuilding}</p>
          <button onClick={onClose}>Fermer</button>
        </div>
      );
  }
}

// ── Caravane ───────────────────────────────────────────────────────────────

/**
 * Panneau caravane : voyage vers une ville au-delà d'une zone de transition.
 * Les destinations sont filtrées par le brouillard de guerre (villes révélées)
 * — tant qu'aucune zone n'est explorée, il n'y a pas de destination.
 */
function CaravanPanel({
  state,
  actions,
  destinations,
}: {
  state: GameState;
  actions: GameActions;
  destinations: { id: string; name: string }[];
}) {
  return (
    <div>
      <p className="hint">
        Voyagez vers une ville au-delà d'une zone de transition. Coût : 20 or —
        risque de gobelins ou de brigands en route.
      </p>
      {destinations.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>
          Aucune destination connue pour l'instant. Explorez une zone pour
          révéler les villes au-delà.
        </p>
      ) : (
        destinations.map((dest) => {
          const canAfford = state.party.gold >= 20;
          return (
            <button
              key={dest.id}
              className="caravan-btn"
              disabled={!canAfford}
              onClick={() => actions.caravan(dest.id)}
            >
              🏰 {dest.name}
              <span className="caravan-cost">20 or</span>
            </button>
          );
        })
      )}
    </div>
  );
}

// ── Boutique ───────────────────────────────────────────────────────────────

/** Effet d'un élément (affiché au survol de la chip). */
const ELEMENT_EFFECTS: Record<string, string> = {
  "Feu": "Élément Feu.",
  "Glace": "Élément Glace.",
  "Foudre": "Élément Foudre.",
  "Air": "Élément Air.",
  "Sacré": "Élément Sacré.",
  "Ténèbre": "Élément Ténèbre.",
};

/**
 * Ligne d'objet de la boutique (layout compact) :
 *  - Ligne 1 : nom (+ catégorie en sous-titre) · « Atq X » · prix · [Acheter] · « En stock : N »
 *  - Ligne 2 : description (italique, petite).
 */
function ShopItemRow({
  item,
  stock,
  onBuy,
  canBuy,
  statuses,
  equippable,
}: {
  item: ShopItem;
  stock: number;
  onBuy: () => void;
  canBuy: boolean;
  /** Statuts chargés depuis l'API (pour les tooltips + icônes des chips). */
  statuses: Map<string, Status>;
  /**
   * Pour une arme : le personnage courant peut-il l'équiper ? `false` → la
   * ligne est grisée et l'achat désactivé (prévenir le "Cannot equip").
   * `undefined` = pas une arme (pas de grisé).
   */
  equippable?: boolean;
}) {
  const isWeapon = item.kind === 'weapon';
  // Stat compacte (ex. « Force +5 », « Force/Dextérité +2/+2 ») + portée.
  const statLabel = isWeapon ? weaponStatLabel(item) : '';
  const rangeLabel = isWeapon ? weaponRangeLabel(item) : '';
  // Chips statut / élément (armes) : affichées à côté de la stat.
  const statusChip = isWeapon && item.status ? item.status : null;
  const elementChip = isWeapon && item.element ? item.element : null;
  // Emoji du type d'arme (ex. 🗡️).
  const emoji = isWeapon ? weaponEmoji(item.weaponType) : null;
  // Tooltip du statut : effet + contre-statut (depuis statuses_data.json).
  const statusInfo = statusChip ? statuses.get(statusChip) : undefined;
  const statusTitle = statusInfo
    ? statusInfo.counterItem
      ? `${statusInfo.description} (Contre : ${statusInfo.counterItem})`
      : statusInfo.description
    : statusChip ?? '';
  const greyed = equippable === false;
  return (
    <li className={`shop-item${greyed ? ' shop-item-disabled' : ''}`}>
      <div className="shop-item-row">
        <span className="shop-name">
          {emoji ? <span className="shop-weapon-emoji">{emoji} {item.name}</span> : <span>{item.name}</span>} 
          {(statusChip || elementChip) ? (
            <span className="shop-meta">
              {statusChip ? (
                <span
                  className={`shop-chip shop-chip-status ${statusInfo?.statusType === 'boon' ? 'shop-chip-boon' : ''}`}
                  title={statusTitle}
                >
                  {statusInfo?.icon ? `${statusInfo.icon} ` : ''}{statusChip}
                </span>
              ) : null}
              {elementChip ? (
                <span
                  className="shop-chip shop-chip-element"
                  title={ELEMENT_EFFECTS[elementChip] ?? elementChip}
                >
                  {elementChip}
                </span>
              ) : null}
            </span>
          ) : null}
        </span>
        {(statLabel || rangeLabel) ? (
            <span className="shop-meta">
              {statLabel ? <span className="shop-stat">{statLabel}</span> : null}
              {rangeLabel ? (
                <span className="shop-range" title="Portée augmentée">{rangeLabel}</span>
              ) : null}
            </span>
          ) : null}
        <span className="shop-price">{item.price} or</span>
        <button
          onClick={onBuy}
          disabled={!canBuy || greyed}
          title={greyed ? 'Votre classe ne peut pas équiper ce type d\'arme' : undefined}
        >
          Acheter
        </button>
      </div>
      {/* Stock en dessous de l'or / acheter, aligné en fin de ligne. */}
      <div className="shop-item-foot">
        <span className="shop-stock">En stock : {stock}</span>
      </div>
      {item.effect ? <p className="shop-desc">{item.effect}</p> : null}
    </li>
  );
}

function ShopPanel({ state, actions, onClose }: { state: GameState; actions: GameActions; onClose: () => void }) {
  const [tab, setTab] = useState<'buy' | 'sell'>('buy');
  // Statuts (armes + sorts) chargés depuis l'API — source unique des effets.
  const [statuses, setStatuses] = useState<Map<string, Status>>(new Map());
  useEffect(() => {
    let cancelled = false;
    fetchStatuses()
      .then((list) => {
        if (!cancelled) setStatuses(new Map(list.map((s) => [s.name, s])));
      })
      .catch(() => { /* les chips retombent sur leur nom */ });
    return () => { cancelled = true; };
  }, []);
  const buyer = state.party.members[0];
  const gold = state.party.gold; // pot commun
  // Armes dans l'ordre d'apparition du fichier all_items.json (pas de
  // séparation Force / Dextérité — la catégorie est portée par le sous-titre).
  const weapons = state.shop.filter((i) => i.kind === 'weapon');
  const consumables = state.shop.filter((i) => i.kind === 'consumable');
  const sharedBag = state.party.bag ?? [];
  const bagWeapons = sharedBag.filter((i) => i.type === 'weapon');

  // Nombre d'objets déjà en stock, **sur toute l'équipe** (sac commun + armes
  // équipées en main droite/gauche), par nom. On **dédoublonne par id** pour
  // ne compter qu'une fois (le bouclier de classe n'est que dans la main gauche).
  const stockByName = new Map<string, number>();
  {
    const seen = new Set<string>();
    const add = (it: { id: string; name: string }) => {
      if (seen.has(it.id)) return;
      seen.add(it.id);
      stockByName.set(it.name, (stockByName.get(it.name) ?? 0) + 1);
    };
    for (const it of sharedBag) add(it);
    for (const m of state.party.members) {
      if (m.rightHand) add(m.rightHand);
      if (m.leftHand) add(m.leftHand);
    }
  }
  const stockOf = (name: string) => stockByName.get(name) ?? 0;

  // **Tri automatique du sac commun** : on suit l'ordre d'apparition de
  // all_items.json (représenté par `state.shop`, déjà ordonné). Les objets
  // absents de la boutique (armes rares, objets de classe…) sont rangés à la
  // fin, triés par nom. Les **doublons** sont regroupés (x2, x3…) : on vend
  // l'instance représentative, le compteur indique le stock.
  const bagGroups = useMemo(() => {
    const shopOrder = new Map<string, number>();
    state.shop.forEach((s, i) => {
      if (!shopOrder.has(s.name)) shopOrder.set(s.name, i);
    });
    // Une arme portée par n'importe quel membre ne peut pas être revendue.
    const equippedIds = new Set<string>();
    for (const m of state.party.members) {
      if (m.rightHand) equippedIds.add(m.rightHand.id);
      if (m.leftHand) equippedIds.add(m.leftHand.id);
    }
    const groups = new Map<string, { item: BagItem; count: number }>();
    for (const it of sharedBag) {
      if (equippedIds.has(it.id)) continue;
      const g = groups.get(it.name);
      if (g) g.count += 1;
      else groups.set(it.name, { item: it, count: 1 });
    }
    const arr = Array.from(groups.values());
    arr.sort((a, b) => {
      const ia = shopOrder.get(a.item.name) ?? Number.MAX_SAFE_INTEGER;
      const ib = shopOrder.get(b.item.name) ?? Number.MAX_SAFE_INTEGER;
      if (ia !== ib) return ia - ib;
      return a.item.name.localeCompare(b.item.name, 'fr');
    });
    return arr;
  }, [sharedBag, state.party.members, state.shop]);

  return (
    <div className="panel-scroll">
      <div className="shop-tabs">
        <button
          className={tab === 'buy' ? 'shop-tab active' : 'shop-tab'}
          onClick={() => setTab('buy')}
        >
          Acheter
        </button>
        <button
          className={tab === 'sell' ? 'shop-tab active' : 'shop-tab'}
          onClick={() => setTab('sell')}
        >
          Vendre
        </button>
      </div>

      <p className="hint">Pot commun : <b>{Math.round(gold * 100) / 100}</b> or</p>

      {tab === 'buy' ? (
        <>
          {weapons.length > 0 && (
            <>
              <h5>Armes</h5>
              <ul className="shop-list">
                {weapons.map((item) => (
                  <ShopItemRow
                    key={item.name}
                    item={item}
                    stock={stockOf(item.name)}
                    onBuy={() => actions.buy(item.name)}
                    canBuy={gold >= item.price}
                    statuses={statuses}
                    equippable={canEquip(buyer?.equippableWeapons, item.weaponType)}
                  />
                ))}
              </ul>
            </>
          )}

          <h5>Consommables</h5>
          <ul className="shop-list">
            {consumables.map((item) => (
              <ShopItemRow
                key={item.name}
                item={item}
                stock={stockOf(item.name)}
                onBuy={() => actions.buy(item.name)}
                canBuy={gold >= item.price}
                statuses={statuses}
              />
            ))}
          </ul>

          {bagWeapons.length > 0 && (
            <>
              <h5>Équiper (sac)</h5>
              <ul className="shop-list">
                {bagWeapons.map((item) => (
                  <li key={item.id} className="shop-equip">
                    <span className="shop-name">{item.name}</span>
                    <button onClick={() => actions.equip(buyer!.id, item.id, 'right')}>Main D</button>
                    <button
                      onClick={() => actions.equip(buyer!.id, item.id, 'left')}
                      disabled={!buyer!.canDualWield}
                      title={
                        buyer!.canDualWield
                          ? 'Équiper en main gauche'
                          : 'Réservé au passif Double Armement (Chevalier Noir)'
                      }
                    >
                      Main G
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      ) : (
        <>
          {buyer && bagGroups.length > 0 ? (
            <>
              <h5>Revendre (sac)</h5>
              <ul className="shop-list">
                {bagGroups.map(({ item, count }) => (
                  <li key={item.id} className="shop-item">
                    <div className="shop-item-row">
                      <span className="shop-name">
                        {item.name}
                        {count > 1 && <span className="bag-count"> ×{count}</span>}
                      </span>
                      <span className="shop-price">~{Math.floor(item.purchasePrice / 2)} or</span>
                      <button onClick={() => actions.sell(item.id)}>Vendre</button>
                    </div>
                    {item.description ? <p className="shop-desc">{item.description}</p> : null}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="hint">Le sac est vide : rien à revendre.</p>
          )}
        </>
      )}
      <button onClick={onClose}>Fermer</button>
    </div>
  );
}

// ── Auberge ────────────────────────────────────────────────────────────────

function InnPanel({ state, actions, onClose }: { state: GameState; actions: GameActions; onClose: () => void }) {
  const cost = 20;
  const gold = state.party.gold; // pot commun
  return (
    <div>
      <p style={{ fontSize: 13 }}>
        Passez la nuit : tout le monde est soigné (PV/MP) pour <b>{cost} or</b>
        (pot commun).
      </p>
      <button onClick={() => actions.rest()} disabled={gold < cost}>
        🛏️ Dormir ({cost} or)
      </button>
      <button onClick={onClose} style={{ marginTop: 8 }}>Fermer</button>
    </div>
  );
}

// ── Sanctuaire ─────────────────────────────────────────────────────────────

function SanctuaryPanel({ state, actions, onClose }: { state: GameState; actions: GameActions; onClose: () => void }) {
  const gold = state.party.gold; // pot commun
  const dead = state.party.members.filter((m) => m.isDead);
  return (
    <div>
      <p style={{ fontSize: 13 }}>
        Ranime un allié mort (à moitié PV) pour <b>200 or</b> (pot commun).
      </p>
      {dead.length === 0 ? (
        <p className="hint">Personne n'est mort. Le sanctuaire est inutile.</p>
      ) : (
        <ul className="shop-list">
          {dead.map((m) => (
            <li key={m.id}>
              <span className="shop-name">{m.name}</span>
              <button onClick={() => actions.sanctuary(m.id)} disabled={gold < 200}>
                Ranimé (200 or)
              </button>
            </li>
          ))}
        </ul>
      )}
      <button onClick={onClose} style={{ marginTop: 8 }}>Fermer</button>
    </div>
  );
}

// ── Tableau des quêtes ─────────────────────────────────────────────────────

function QuestPanel({ state, actions, onClose }: { state: GameState; actions: GameActions; onClose: () => void }) {
  const { available, accepted } = state.quests;
  return (
    <div className="panel-scroll">
      <h5>Disponibles</h5>
      {available.length === 0 ? (
        <p className="hint">Aucune quête disponible.</p>
      ) : (
        <ul className="quest-list">
          {available.map((q) => (
            <li key={q.id}>
              <div className="quest-head">
                <span className="quest-name">{q.name}</span>
                <button onClick={() => actions.acceptQuest(q.id)}>Accepter</button>
              </div>
              {q.giver && <div className="quest-giver">« {q.giver.dialogue} »</div>}
              <div className="quest-reward">Récompense : {q.reward.description}</div>
            </li>
          ))}
        </ul>
      )}
      {accepted.length > 0 && (
        <>
          <h5>En cours</h5>
          <ul className="quest-list">
            {accepted.map((q) => (
              <li key={q.id}>
                <div className="quest-name">{q.name}</div>
                <ul className="quest-steps">
                  {q.steps.map((s) => (
                    <li key={s.id} className={s.done ? 'done' : ''}>
                      {s.done ? '✓' : '○'} {s.description}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}
      <button onClick={onClose} style={{ marginTop: 8 }}>Fermer</button>
    </div>
  );
}
