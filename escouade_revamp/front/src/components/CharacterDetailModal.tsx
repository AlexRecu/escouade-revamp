import { useMemo, useState } from 'react';
import type { PartyMember, Statistics } from '../types/game';
import type { GameActions } from '../game/useGame';
import { classTokenUrl, tokenUrl } from '../utils/tokens';
import { weaponEmoji, weaponLabel } from '../utils/weapons';

type Props = {
  /** Membre à afficher (null = modal fermé). */
  member: PartyMember | null;
  /** Ferme le panneau. */
  onClose: () => void;
  /** Actions de ville (équiper, utiliser un objet). */
  actions: GameActions;
};

/** Libellés français des 7 stats (ordre d'affichage). */
const STAT_LABELS: { key: keyof Statistics; label: string; desc: string }[] = [
  { key: 'strength', label: 'Force', desc: 'Fait plus de dégâts avec les armes basées sur la Force.' },
  { key: 'dexterity', label: 'Dextérité', desc: 'Augmente l\'initiative et les dégâts d\'armes basées sur la Dextérité.' },
  { key: 'endurance', label: 'Endurance', desc: 'Détermine le nombre de points de vie (PV).' },
  { key: 'mana', label: 'Mana', desc: 'Détermine la quantité de points de magie (PM).' },
  { key: 'intelligence', label: 'Intelligence', desc: 'Fait plus de dégâts avec les sorts.' },
  { key: 'perception', label: 'Perception', desc: 'Détecte les objets cachés et réduit les attaques des monstres.' },
  { key: 'charisma', label: 'Charisme', desc: 'Permet de négocier (baisser) les prix chez les marchands.' },
];

/** Libellé d'une cible (ally/self/enemy). */
const targetLabel = (t: string): string =>
  t === 'self' ? 'soi' : t === 'ally' ? 'allié' : t === 'enemy' ? 'ennemi' : t;

/**
 * Panneau de détail d'un personnage : statistiques (7 stats), compétences de
 * classe, sorts, types d'armes équipables, armes équipées (avec attaque et
 * statut) et sac (onglets Consommables / Armes, avec équipement et usage).
 * Ouvert en cliquant sur un membre de l'équipe dans la barre latérale.
 */
export default function CharacterDetailModal({ member, onClose, actions }: Props) {
  // Onglet actif du sac : consommables ou armes.
  const [bagTab, setBagTab] = useState<'consumable' | 'weapon'>('consumable');

  // Consommables groupés par nom (les doublons identiques sont empilés ×N).
  // On garde un id représentatif pour l'usage (les doublons sont identiques).
  const consumableGroups = useMemo(() => {
    if (!member) return [];
    const map = new Map<string, { name: string; count: number; description: string; id: string }>();
    for (const it of member.bag) {
      if (it.type !== 'consumable') continue;
      const g = map.get(it.name);
      if (g) g.count += 1;
      else map.set(it.name, { name: it.name, count: 1, description: it.description, id: it.id });
    }
    return Array.from(map.values());
  }, [member]);

  // Armes du sac **non équipées** (les armes équipées sont dans la section
  // Équipement — on ne les liste pas deux fois).
  const bagWeapons = useMemo(() => {
    if (!member) return [];
    const equippedIds = new Set([member.rightHand?.id, member.leftHand?.id].filter(Boolean));
    return member.bag.filter((i) => i.type === 'weapon' && !equippedIds.has(i.id));
  }, [member]);

  if (!member) return null;

  const stats = member.stats;

  return (
    <div className="char-detail-overlay" onClick={onClose}>
      <div className="char-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="char-detail-head">
          <img
            className="char-detail-token"
            src={member.avatar ? tokenUrl(member.avatar) : classTokenUrl(member.job)}
            alt={member.job}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/assets/tokens/default.png';
            }}
          />
          <div className="char-detail-id">
            <h3>{member.name}</h3>
            <span className="char-detail-job">{member.job} · niveau {member.level}</span>
            <span className="char-detail-hpmp">
              PV {member.hp}/{member.maxHp} · PM {member.mp}/{member.maxMp}
            </span>
          </div>
          <button className="char-detail-close" onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        <div className="char-detail-body">
          {/* XP (cumulée + progression vers le prochain niveau) */}
          <section className="char-detail-section">
            <h4>⭐ Expérience</h4>
            <div className="char-detail-xp">
              <div className="char-detail-xp-row">
                <span className="char-detail-xp-label">XP cumulée</span>
                <span className="char-detail-xp-value">{member.xp ?? 0}</span>
              </div>
              {member.xpToNext != null && member.xpNeeded ? (
                <>
                  <div className="char-detail-xpbar">
                    <div
                      className="char-detail-xpfill"
                      style={{
                        width: `${Math.min(100, Math.max(0, ((member.xpNeeded - member.xpToNext) / member.xpNeeded) * 100))}%`,
                      }}
                    />
                  </div>
                  <div className="char-detail-xp-row">
                    <span className="char-detail-xp-label">Prochain niveau</span>
                    <span className="char-detail-xp-value">
                      {member.xpToNext} XP restantes
                    </span>
                  </div>
                </>
              ) : (
                <p className="char-detail-empty">Niveau maximum atteint.</p>
              )}
            </div>
          </section>

          {/* Statistiques */}
          {stats && (
            <section className="char-detail-section">
              <h4>📊 Statistiques</h4>
              <div className="char-detail-stats">
                {STAT_LABELS.map((s) => (
                  <div key={s.key} className="char-detail-stat" data-desc={s.desc}>
                    <span className="char-detail-stat-label">{s.label}</span>
                    <span className="char-detail-stat-value">{stats[s.key]}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Compétences */}
          <section className="char-detail-section">
            <h4>✨ Compétences</h4>
            {member.skills && member.skills.length > 0 ? (
              <ul className="char-detail-list">
                {member.skills.map((s) => (
                  <li key={s.name} title={s.description}>
                    <span className="char-detail-item-name">{s.name}</span>
                    <span className="char-detail-item-meta">
                      {s.apCost} AP{s.mpCost ? ` · ${s.mpCost} PM` : ''} · {targetLabel(s.target)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="char-detail-empty">Aucune compétence débloquée.</p>
            )}
          </section>

          {/* Sorts */}
          <section className="char-detail-section">
            <h4>🔮 Sorts</h4>
            {member.spells && member.spells.length > 0 ? (
              <ul className="char-detail-list">
                {member.spells.map((s) => (
                  <li key={s.name} title={s.description}>
                    <span className="char-detail-item-name">{s.name}</span>
                    <span className="char-detail-item-meta">
                      {s.mpCost != null ? `${s.mpCost} PM` : '—'} · {targetLabel(s.target)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="char-detail-empty">Aucun sort débloqué.</p>
            )}
          </section>

          {/* Types d'armes équipables (selon la classe) */}
          <section className="char-detail-section">
            <h4>🛡️ Armes équipables</h4>
            {member.equippableWeapons && member.equippableWeapons.length > 0 ? (
              <div className="char-detail-equipable">
                {member.equippableWeapons.map((wt) => (
                  <span key={wt} className="char-detail-equipable-chip">
                    {weaponEmoji(wt)} {weaponLabel(wt)}
                  </span>
                ))}
              </div>
            ) : (
              <p className="char-detail-empty">Aucune arme.</p>
            )}
          </section>

          {/* Équipement (armes équipées, avec attaque et statut) */}
          <section className="char-detail-section">
            <h4>🗡️ Équipement</h4>
            <div className="char-detail-equip">
              <div className="char-detail-equip-row">
                <span className="char-detail-equip-label">Main droite</span>
                {member.rightHand ? (
                  <span className="char-detail-weapon">
                    <span className="shop-weapon-emoji">{weaponEmoji(member.rightHand.weaponType)}</span>
                    {member.rightHand.name}
                    {member.rightHand.weaponStat ? (
                      <span className="char-detail-atq">Atq {member.rightHand.weaponStat}</span>
                    ) : null}
                    {member.rightHand.status ? (
                      <span className="char-detail-status">{member.rightHand.status}</span>
                    ) : null}
                  </span>
                ) : (
                  <span>—</span>
                )}
              </div>
              <div className="char-detail-equip-row">
                <span className="char-detail-equip-label">Main gauche</span>
                {member.leftHand ? (
                  <span className="char-detail-weapon">
                    <span className="shop-weapon-emoji">{weaponEmoji(member.leftHand.weaponType)}</span>
                    {member.leftHand.name}
                    {member.leftHand.weaponStat ? (
                      <span className="char-detail-atq">Atq {member.leftHand.weaponStat}</span>
                    ) : null}
                    {member.leftHand.status ? (
                      <span className="char-detail-status">{member.leftHand.status}</span>
                    ) : null}
                  </span>
                ) : (
                  <span>—</span>
                )}
              </div>
            </div>
          </section>

          {/* Sac (onglets Consommables / Armes) */}
          <section className="char-detail-section">
            <h4>🎒 Sac</h4>
            <div className="char-detail-bag-tabs">
              <button
                className={bagTab === 'consumable' ? 'char-detail-bag-tab active' : 'char-detail-bag-tab'}
                onClick={() => setBagTab('consumable')}
              >
                Consommables
              </button>
              <button
                className={bagTab === 'weapon' ? 'char-detail-bag-tab active' : 'char-detail-bag-tab'}
                onClick={() => setBagTab('weapon')}
              >
                Armes
              </button>
            </div>

            {bagTab === 'consumable' ? (
              consumableGroups.length > 0 ? (
                <ul className="char-detail-list">
                  {consumableGroups.map((g) => (
                    <li key={g.name} className="char-detail-bag-item" title={g.description}>
                      <span className="char-detail-item-name">
                        {g.name}
                        {g.count > 1 && <span className="bag-count"> ×{g.count}</span>}
                      </span>
                      <button
                        className="char-detail-bag-btn"
                        onClick={() => actions.useItem(member.id, g.id)}
                      >
                        Utiliser
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="char-detail-empty">Aucun consommable.</p>
              )
            ) : bagWeapons.length > 0 ? (
              <ul className="char-detail-list">
                {bagWeapons.map((item) => {
                  const canRight = member.equippableWeapons?.includes(item.weaponType ?? '');
                  return (
                    <li key={item.id} className="char-detail-bag-item" title={item.description}>
                      <span className="char-detail-item-name">
                        <span className="shop-weapon-emoji">{weaponEmoji(item.weaponType)}</span>
                        {item.name}
                        {item.weaponStat ? (
                          <span className="char-detail-atq"> Atq {item.weaponStat}</span>
                        ) : null}
                        {item.status ? (
                          <span className="char-detail-status"> {item.status}</span>
                        ) : null}
                      </span>
                      <span className="char-detail-bag-actions">
                        <button
                          className="char-detail-bag-btn"
                          onClick={() => actions.equip(member.id, item.id, 'right')}
                          disabled={!canRight}
                          title={canRight ? 'Équiper en main droite' : 'Type d\'arme non équipables par cette classe'}
                        >
                          Main D
                        </button>
                        <button
                          className="char-detail-bag-btn"
                          onClick={() => actions.equip(member.id, item.id, 'left')}
                          disabled={!member.canDualWield}
                          title={
                            member.canDualWield
                              ? 'Équiper en main gauche'
                              : 'Réservé au passif Double Armement'
                          }
                        >
                          Main G
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="char-detail-empty">Aucune arme dans le sac.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
