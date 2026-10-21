import { useMemo } from 'react';
import type { PartyMember, Statistics } from '../types/game';
import { classTokenUrl, tokenUrl } from '../utils/tokens';

type Props = {
  /** Membre à afficher (null = modal fermé). */
  member: PartyMember | null;
  /** Ferme le panneau. */
  onClose: () => void;
};

/** Libellés français des 7 stats (ordre d'affichage). */
const STAT_LABELS: { key: keyof Statistics; label: string }[] = [
  { key: 'strength', label: 'Force' },
  { key: 'dexterity', label: 'Dextérité' },
  { key: 'endurance', label: 'Endurance' },
  { key: 'mana', label: 'Mana' },
  { key: 'intelligence', label: 'Intelligence' },
  { key: 'perception', label: 'Perception' },
  { key: 'charisma', label: 'Charisme' },
];

/** Libellé d'une cible (ally/self/enemy). */
const targetLabel = (t: string): string =>
  t === 'self' ? 'soi' : t === 'ally' ? 'allié' : t === 'enemy' ? 'ennemi' : t;

/**
 * Panneau de détail d'un personnage : statistiques (7 stats), compétences de
 * classe, sorts, armes équipées et sac. Ouvert en cliquant sur un membre de
 * l'équipe dans la barre latérale.
 */
export default function CharacterDetailModal({ member, onClose }: Props) {
  // Sac groupé par nom (les doublons identiques sont empilés avec ×N).
  const bagGroups = useMemo(() => {
    if (!member) return [];
    const map = new Map<string, { name: string; count: number; description: string }>();
    for (const it of member.bag) {
      const g = map.get(it.name);
      if (g) g.count += 1;
      else map.set(it.name, { name: it.name, count: 1, description: it.description });
    }
    return Array.from(map.values());
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
          {/* Statistiques */}
          {stats && (
            <section className="char-detail-section">
              <h4>📊 Statistiques</h4>
              <div className="char-detail-stats">
                {STAT_LABELS.map((s) => (
                  <div key={s.key} className="char-detail-stat">
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

          {/* Équipement */}
          <section className="char-detail-section">
            <h4>🗡️ Équipement</h4>
            <div className="char-detail-equip">
              <div className="char-detail-equip-row">
                <span className="char-detail-equip-label">Main droite</span>
                <span>{member.rightHand ? `🗡️ ${member.rightHand.name}` : '—'}</span>
              </div>
              <div className="char-detail-equip-row">
                <span className="char-detail-equip-label">Main gauche</span>
                <span>{member.leftHand ? `🛡️ ${member.leftHand.name}` : '—'}</span>
              </div>
            </div>
          </section>

          {/* Sac */}
          <section className="char-detail-section">
            <h4>🎒 Sac</h4>
            {bagGroups.length > 0 ? (
              <ul className="char-detail-list">
                {bagGroups.map((g) => (
                  <li key={g.name} title={g.description}>
                    <span className="char-detail-item-name">
                      {g.name}
                      {g.count > 1 && <span className="bag-count"> ×{g.count}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="char-detail-empty">Sac vide.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
