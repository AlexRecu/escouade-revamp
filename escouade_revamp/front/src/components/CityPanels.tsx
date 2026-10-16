import { useEffect, useState } from 'react';
import type { GameState, ShopItem } from '../types/game';
import type { GameActions } from '../game/useGame';
import type { Status } from '../types/world';
import { fetchStatuses } from '../api/client';

type Props = {
  activeBuilding: string | null;
  state: GameState | null;
  actions: GameActions;
  onClose: () => void;
};

/**
 * Panneaux d'interaction de ville (temps réel).
 *
 * Selon le bâtiment actif, affiche : boutique (acheter / revendre), auberge
 * (nuit), sanctuaire (ranimer) ou tableau des quêtes (accepter). Chaque
 * action passe par le socket (voir `useGame`).
 */
export default function CityPanels({ activeBuilding, state, actions, onClose }: Props) {
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
    default:
      return (
        <div>
          <p style={{ fontSize: 13 }}>{activeBuilding}</p>
          <button onClick={onClose}>Fermer</button>
        </div>
      );
  }
}

// ── Boutique ───────────────────────────────────────────────────────────────

/** Sous-titre d'une arme : la **catégorie** (Force / Dextérité). L'attaque
 *  (« Atq X ») est affichée séparément sur la même ligne. */
function weaponSubtitle(item: { mainStat?: string }): string {
  return item.mainStat ?? '';
}

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
  subtitle,
  stock,
  onBuy,
  canBuy,
  statuses,
}: {
  item: ShopItem;
  subtitle?: string;
  stock: number;
  onBuy: () => void;
  canBuy: boolean;
  /** Statuts chargés depuis l'API (pour les tooltips + icônes des chips). */
  statuses: Map<string, Status>;
}) {
  // « Atq X » : l'attaque de l'arme (seule, sans la stat — celle-ci est dans
  // le sous-titre de catégorie).
  const atq = item.kind === 'weapon' && item.weaponStat ? `Atq ${item.weaponStat}` : null;
  // Chips statut / élément (armes) : affichées à côté de la catégorie.
  const statusChip = item.kind === 'weapon' && item.status ? item.status : null;
  const elementChip = item.kind === 'weapon' && item.element ? item.element : null;
  // Tooltip du statut : effet + contre-statut (depuis statuses_data.json).
  const statusInfo = statusChip ? statuses.get(statusChip) : undefined;
  const statusTitle = statusInfo
    ? statusInfo.counterItem
      ? `${statusInfo.description} (Contre : ${statusInfo.counterItem})`
      : statusInfo.description
    : statusChip ?? '';
  return (
    <li className="shop-item">
      <div className="shop-item-row">
        <span className="shop-name">
          {item.name}
          {(subtitle || statusChip || elementChip) ? (
            <span className="shop-meta">
              {subtitle ? <em className="shop-sub">{subtitle}</em> : null}
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
        {atq ? <span className="shop-atq">{atq}</span> : null}
        <span className="shop-price">{item.price} or</span>
        <button onClick={onBuy} disabled={!canBuy}>Acheter</button>
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
  const bagWeapons = (buyer?.bag ?? []).filter((i) => i.type === 'weapon');

  // Nombre d'objets déjà en stock, **sur toute l'équipe** (sacs + armes
  // équipées en main droite/gauche), par nom.
  const stockByName = new Map<string, number>();
  for (const m of state.party.members) {
    for (const it of m.bag) {
      stockByName.set(it.name, (stockByName.get(it.name) ?? 0) + 1);
    }
    if (m.rightHand) stockByName.set(m.rightHand.name, (stockByName.get(m.rightHand.name) ?? 0) + 1);
    if (m.leftHand) stockByName.set(m.leftHand.name, (stockByName.get(m.leftHand.name) ?? 0) + 1);
  }
  const stockOf = (name: string) => stockByName.get(name) ?? 0;

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

      <p className="hint">Pot commun : <b>{gold}</b> or</p>

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
                    subtitle={weaponSubtitle(item)}
                    stock={stockOf(item.name)}
                    onBuy={() => actions.buy(item.name)}
                    canBuy={gold >= item.price}
                    statuses={statuses}
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
          {buyer && buyer.bag.length > 0 ? (
            <>
              <h5>Revendre (sac)</h5>
              <ul className="shop-list">
                {buyer.bag.map((item) => (
                  <li key={item.id} className="shop-item">
                    <div className="shop-item-row">
                      <span className="shop-name">{item.name}</span>
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
