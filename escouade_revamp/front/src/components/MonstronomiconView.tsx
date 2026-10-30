import type { MonstronomiconEntry } from '../types/game';
import { monsterTokenUrl, DEFAULT_TOKEN_URL } from '../utils/tokens';

type Props = {
  /** Monstres/classes étudiés (données dérivées du bestiaire côté serveur). */
  entries: MonstronomiconEntry[];
};

/**
 * Fiche consultable du **Monstronomicon** : liste les créatures étudiées par
 * le Mage bleu (via "Scan"). Pour chaque monstre : sprite, rang, type
 * (Physique/Magique), PV par zone (6 valeurs) et attaques (avec badge
 * « apprise » si l'attaque a été apprise via "Apprendre").
 */
export default function MonstronomiconView({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <div className="mono-view">
        <p className="char-detail-empty">
          Aucune créature étudiée. Utilisez « Scan » en combat pour étudier un adversaire.
        </p>
      </div>
    );
  }

  return (
    <div className="mono-view">
      <h5 className="mono-view-title">📖 Monstronomicon — {entries.length} entrée(s)</h5>
      <ul className="mono-view-list">
        {entries.map((e) => (
          <li key={e.name} className="mono-entry">
            <img
              className="mono-entry-token"
              src={e.isMonster ? monsterTokenUrl(e.name) : DEFAULT_TOKEN_URL}
              alt={e.name}
              onError={(ev) => {
                (ev.currentTarget as HTMLImageElement).src = DEFAULT_TOKEN_URL;
              }}
            />
            <div className="mono-entry-body">
              <div className="mono-entry-head">
                <span className="mono-entry-name">{e.name}</span>
                {e.isMonster && (
                  <span className="mono-entry-meta">
                    Rang {e.rank} · {e.attackType}
                  </span>
                )}
                {e.isLearned && <span className="mono-entry-learned">✦ apprise</span>}
              </div>

              {e.isMonster && e.pvByZone && (
                <div className="mono-entry-pv">
                  <span className="mono-entry-pv-label">PV par zone</span>
                  <div className="mono-entry-pv-grid">
                    {e.pvByZone.map((pv, i) => (
                      <span key={i} className="mono-entry-pv-cell" title={`Zone ${i + 1}`}>
                        <em>{i + 1}</em> {pv}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {e.isMonster && e.attacks && e.attacks.length > 0 && (
                <div className="mono-entry-attacks">
                  <span className="mono-entry-pv-label">Attaques</span>
                  <div className="mono-entry-attack-list">
                    {e.attacks.map((a) => (
                      <span key={a} className="mono-entry-attack">
                        {a}
                        {e.isLearned && e.learnedAttack === a && (
                          <em className="mono-entry-attack-learned">apprise</em>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {!e.isMonster && (
                <div className="mono-entry-attacks">
                  <span className="mono-entry-pv-label">Classe étudiée</span>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
