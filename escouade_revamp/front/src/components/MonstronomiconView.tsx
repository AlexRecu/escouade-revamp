import type { MonstronomiconEntry } from '../types/game';
import { monsterTokenUrl, DEFAULT_TOKEN_URL } from '../utils/tokens';

type Props = {
  /** Monstres/classes étudiés (données dérivées du bestiaire côté serveur). */
  entries: MonstronomiconEntry[];
};

/** Emoji par élément (pour les faiblesses/résistances/immunités). */
const ELEMENT_ICON: Record<string, string> = {
  Feu: '🔥',
  Glace: '❄️',
  Air: '💨',
  Foudre: '⚡',
  Terre: '🪨',
  Sacré: '✨',
  'Ténèbres': '🌑',
};

/** Renvoie l'emoji d'un élément (ou un point neutre si inconnu). */
function elementIcon(el: string): string {
  return ELEMENT_ICON[el] ?? '•';
}

/**
 * Affiche les traits élémentaires d'un monstre : faiblesses, résistances et
 * immunités. Chaque ligne n'est rendue que si elle contient au moins un
 * élément (un monstre sans faiblesse n'affiche pas la ligne « Faible à »).
 */
function ElementTraits({
  weakness,
  resistance,
  immunity,
}: {
  weakness?: string[];
  resistance?: string[];
  immunity?: string[];
}) {
  const rows: { label: string; items: string[]; cls: string }[] = [];
  if (weakness && weakness.length > 0) rows.push({ label: 'Faible à', items: weakness, cls: 'weak' });
  if (resistance && resistance.length > 0) rows.push({ label: 'Résiste à', items: resistance, cls: 'resist' });
  if (immunity && immunity.length > 0) rows.push({ label: 'Immunisé à', items: immunity, cls: 'immune' });
  if (rows.length === 0) return null;

  return (
    <div className="mono-entry-elements">
      {rows.map((r) => (
        <div key={r.cls} className={`mono-entry-element mono-entry-element-${r.cls}`}>
          <span className="mono-entry-pv-label">{r.label}</span>
          <span className="mono-entry-element-list">
            {r.items.map((el) => (
              <span key={el} className="mono-entry-element-item" title={el}>
                {elementIcon(el)} {el}
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

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

              {/* Éléments : faiblesses / résistances / immunités (chacune
                  affichée seulement si non vide). */}
              {e.isMonster && (
                <ElementTraits
                  weakness={e.weakness}
                  resistance={e.resistance}
                  immunity={e.immunity}
                />
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
