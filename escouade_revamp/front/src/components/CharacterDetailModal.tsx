import { useMemo, useState } from 'react';
import type { PartyMember, Statistics, BagItem } from '../types/game';
import type { GameActions } from '../game/useGame';
import { classTokenUrl, tokenUrl, defeatedTokenStyle } from '../utils/tokens';
import { weaponEmoji, weaponLabel, weaponStatLabel, weaponRangeLabel } from '../utils/weapons';
import MonstronomiconView from './MonstronomiconView';

type Props = {
  /** Membre à afficher (null = modal fermé). */
  member: PartyMember | null;
  /** Sac commun de l'équipe (objets partagés, accessibles par tous). */
  sharedBag: BagItem[];
  /** Ferme le panneau. */
  onClose: () => void;
  /** Actions de ville (équiper, utiliser un objet). */
  actions: GameActions;
  /** true si un combat est en cours : désactive l'équipement/usage depuis le sac. */
  inCombat?: boolean;
  /**
   * Liste des membres de l'équipe (PV/MP à jour) — pour cibler un allié avec
   * un sort de soin hors combat (Soin/Grâce/Vie).
   */
  members?: PartyMember[];
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
 * Un sort est **lançable hors combat** s'il est un sort de soin (cible
 * alliée/soi) : Soin / Grâce / Vie et leurs variantes. Les sorts offensifs
 * (cible ennemie) ne le sont pas.
 */
const isOutOfCombatHeal = (s: { name: string; target: string }): boolean =>
  (s.name.startsWith('Soin') || s.name.startsWith('Grace') || s.name.startsWith('Vie')) &&
  (s.target === 'ally' || s.target === 'self');

/**
 * Panneau de détail d'un personnage : statistiques (7 stats), compétences de
 * classe, sorts, types d'armes équipables, armes équipées (avec attaque et
 * statut) et sac (onglets Consommables / Armes, avec équipement et usage).
 * Ouvert en cliquant sur un membre de l'équipe dans la barre latérale.
 */
export default function CharacterDetailModal({ member, sharedBag, onClose, actions, inCombat, members }: Props) {
  // Onglet actif du sac : consommables, armes ou spéciaux.
  const [bagTab, setBagTab] = useState<'consumable' | 'weapon' | 'special'>('consumable');
  // Sort de soin en cours de ciblage (nom du sort, null = aucun). Quand non
  // null, on affiche la liste des alliés à cibler.
  const [healSpell, setHealSpell] = useState<string | null>(null);
  // Monstronomicon ouvert (fiche consultable) : true = afficher la fiche.
  const [monoOpen, setMonoOpen] = useState(false);

  // Consommables du **sac commun** groupés par nom (les doublons identiques
  // sont empilés ×N). On garde un id représentatif pour l'usage.
  const consumableGroups = useMemo(() => {
    const map = new Map<string, { name: string; count: number; description: string; id: string }>();
    for (const it of sharedBag) {
      if (it.type !== 'consumable') continue;
      const g = map.get(it.name);
      if (g) g.count += 1;
      else map.set(it.name, { name: it.name, count: 1, description: it.description, id: it.id });
    }
    return Array.from(map.values());
  }, [sharedBag]);

  // Armes du **sac commun** non portées par le membre affiché (les armes
  // équipées sont dans la section Équipement — on ne les liste pas deux fois).
  const bagWeapons = useMemo(() => {
    if (!member) return [];
    const equippedIds = new Set([member.rightHand?.id, member.leftHand?.id].filter(Boolean));
    return sharedBag.filter((i) => i.type === 'weapon' && !equippedIds.has(i.id));
  }, [sharedBag, member]);

  // Objets **spéciaux** du sac commun (type "special" ou "quest") : objets de
  // quête, Monstronomicon, pièce marquée… Non vendables, non consommables.
  const specialItems = useMemo(
    () => sharedBag.filter((i) => i.type === 'special' || i.type === 'quest'),
    [sharedBag]
  );

  if (!member) return null;

  const stats = member.stats;

  return (
    <div className="char-detail-overlay" onClick={onClose}>
      <div className="char-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="char-detail-head">
          {member.isDead && defeatedTokenStyle(member.job) ? (
            <div
              className="char-detail-token char-detail-token-defeated"
              style={defeatedTokenStyle(member.job)!}
              title="Personnage vaincu"
            />
          ) : (
            <img
              className={`char-detail-token${member.isDead ? ' char-detail-token-dead' : ''}`}
              src={member.avatar ? tokenUrl(member.avatar) : classTokenUrl(member.job)}
              alt={member.job}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/assets/tokens/default.png';
              }}
            />
          )}
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
                {member.spells.map((s) => {
                  // Un personnage KO (0 PV) ne peut plus lancer de sort de soin.
                  const canCast = !inCombat && !member.isDead && isOutOfCombatHeal(s);
                  const isRevive = s.name.startsWith('Vie');
                  return (
                    <li key={s.name} title={s.description} className="char-detail-spell-row">
                      <span className="char-detail-item-name">{s.name}</span>
                      <span className="char-detail-item-meta">
                        {s.mpCost != null ? `${s.mpCost} PM` : '—'} · {targetLabel(s.target)}
                      </span>
                      {canCast && (
                        <button
                          className="char-detail-bag-btn"
                          onClick={() => setHealSpell(healSpell === s.name ? null : s.name)}
                          title={isRevive ? 'Ranime un allié mort' : 'Soigne un allié (hors combat)'}
                        >
                          {healSpell === s.name ? 'Annuler' : 'Lancer'}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="char-detail-empty">Aucun sort débloqué.</p>
            )}

            {/* Ciblage d'un sort de soin : liste des alliés à soigner/ranimer. */}
            {healSpell && members && (
              <div className="char-detail-heal-targets">
                <p className="char-detail-heal-title">
                  Cible de <b>{healSpell}</b> :
                </p>
                <div className="char-detail-heal-list">
                  {members.map((m) => {
                    const isRevive = healSpell.startsWith('Vie');
                    // Soin/Grâce : allié vivant pas à PV pleins. Vie : allié mort.
                    const valid = isRevive
                      ? m.isDead
                      : !m.isDead && m.hp < m.maxHp;
                    return (
                      <button
                        key={m.id}
                        className="char-detail-heal-target"
                        disabled={!valid}
                        title={
                          valid
                            ? `Lancer ${healSpell} sur ${m.name}`
                            : isRevive
                              ? `${m.name} n'est pas mort`
                              : m.isDead
                                ? `${m.name} est KO`
                                : `${m.name} est à PV pleins`
                        }
                        onClick={() => {
                          actions.castSpell(member.id, m.id, healSpell);
                          setHealSpell(null);
                        }}
                      >
                        <span>{m.name}</span>
                        <span className="char-detail-heal-hp">
                          {m.isDead ? 'KO' : `${m.hp}/${m.maxHp} PV`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
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
                    {weaponStatLabel(member.rightHand) ? (
                      <span className="char-detail-atq">{weaponStatLabel(member.rightHand)}</span>
                    ) : null}
                    {weaponRangeLabel(member.rightHand) ? (
                      <span className="char-detail-range" title="Portée">{weaponRangeLabel(member.rightHand)}</span>
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
                    {weaponStatLabel(member.leftHand) ? (
                      <span className="char-detail-atq">{weaponStatLabel(member.leftHand)}</span>
                    ) : null}
                    {weaponRangeLabel(member.leftHand) ? (
                      <span className="char-detail-range" title="Portée">{weaponRangeLabel(member.leftHand)}</span>
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

          {/* Sac commun de l'équipe (onglets Consommables / Armes) */}
          <section className="char-detail-section">
            <h4>🎒 Sac commun</h4>
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
              <button
                className={bagTab === 'special' ? 'char-detail-bag-tab active' : 'char-detail-bag-tab'}
                onClick={() => setBagTab('special')}
              >
                Spéciaux
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
                        disabled={inCombat || member.isDead}
                        title={inCombat ? 'Indisponible pendant le combat (voir Objets)' : member.isDead ? 'KO : indisponible' : 'Utiliser'}
                      >
                        Utiliser
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="char-detail-empty">Aucun consommable.</p>
              )
            ) : bagTab === 'weapon' ? (
              bagWeapons.length > 0 ? (
              <ul className="char-detail-list">
                {bagWeapons.map((item) => {
                  const canRight = member.equippableWeapons?.includes(item.weaponType ?? '');
                  return (
                    <li key={item.id} className="char-detail-bag-item" title={item.description}>
                      <span className="char-detail-item-name">
                        <span className="shop-weapon-emoji">{weaponEmoji(item.weaponType)}</span>
                        {item.name}
                        {weaponStatLabel(item) ? (
                          <span className="char-detail-atq"> {weaponStatLabel(item)}</span>
                        ) : null}
                        {weaponRangeLabel(item) ? (
                          <span className="char-detail-range" title="Portée"> {weaponRangeLabel(item)}</span>
                        ) : null}
                        {item.status ? (
                          <span className="char-detail-status"> {item.status}</span>
                        ) : null}
                      </span>
                      <span className="char-detail-bag-actions">
                        <button
                          className="char-detail-bag-btn"
                          onClick={() => actions.equip(member.id, item.id, 'right')}
                          disabled={inCombat || !canRight}
                          title={
                            inCombat
                              ? 'Indisponible pendant le combat'
                              : canRight
                                ? 'Équiper en main droite'
                                : 'Type d\'arme non équipables par cette classe'
                          }
                        >
                          Main D
                        </button>
                        <button
                          className="char-detail-bag-btn"
                          onClick={() => actions.equip(member.id, item.id, 'left')}
                          disabled={inCombat || !member.canDualWield}
                          title={
                            inCombat
                              ? 'Indisponible pendant le combat'
                              : member.canDualWield
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
              )
            ) : (
              /* Onglet Spéciaux : objets de quête, Monstronomicon, pièce marquée. */
              specialItems.length > 0 ? (
                <ul className="char-detail-list">
                  {specialItems.map((item) => {
                    const isMono = item.name === 'Monstronomicon';
                    const canOpen = isMono && !!member.monstronomicon;
                    return (
                      <li key={item.id} className="char-detail-bag-item" title={item.description}>
                        <span className="char-detail-item-name">
                          {isMono ? '📖 ' : '🔑 '}
                          {item.name}
                        </span>
                        {isMono ? (
                          <button
                            className="char-detail-bag-btn"
                            onClick={() => setMonoOpen((o) => !o)}
                            disabled={!canOpen}
                            title={canOpen ? (monoOpen ? 'Fermer' : 'Ouvrir le Monstronomicon') : 'Réservé au Mage bleu'}
                          >
                            {monoOpen ? 'Fermer' : 'Ouvrir'}
                          </button>
                        ) : (
                          <span className="char-detail-special-tag">non vendable</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="char-detail-empty">Aucun objet spécial.</p>
              )
            )}

            {/* Fiche du Monstronomicon (Monstres étudiés). */}
            {bagTab === 'special' && monoOpen && member.monstronomicon && (
              <MonstronomiconView entries={member.monstronomicon} />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
