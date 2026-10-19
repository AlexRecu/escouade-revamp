import type { GameState } from '../types/game';
import { classTokenUrl, tokenUrl } from '../utils/tokens';

type Props = {
  state: GameState | null;
  connected: boolean;
};

/**
 * Colonne latérale permanente de l'équipe (visible sur la mappemonde ET en
 * ville). Affiche les membres (PV/MP/or) + les armes équipées.
 */
export default function PartySidebar({ state, connected }: Props) {
  return (
    <aside className="party-sidebar">
      <div className="party-sidebar-head">
        <h3>Équipe</h3>
        <span className="conn" data-on={connected}>
          {connected ? '● En ligne' : '○ Connexion…'}
        </span>
      </div>

      {!state ? (
        <p className="hint">Chargement de l'équipe…</p>
      ) : (
        <>
          <p className="party-level">
            Niveau du monde : <b>{state.party.worldLevel}</b>
          </p>
          <div className="party-gold-pot" title="Pot commun d'or de l'équipe">
            💰 <b>{state.party.gold}</b> or
          </div>
          <ul className="party-list">
            {state.party.members.map((m) => (
              <li key={m.id} className={m.isDead ? 'dead' : ''}>
                <div className="party-head">
                  <img
                    className="party-token"
                    src={m.avatar ? tokenUrl(m.avatar) : classTokenUrl(m.job)}
                    alt={m.job}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src =
                        '/assets/tokens/default.png';
                    }}
                  />
                  <span>{m.name}</span>
                  <span className="party-job">
                    {m.job} · niv.{m.level}
                  </span>
                </div>
                <div className="bar" title={`PV ${m.hp}/${m.maxHp}`}>
                  <div className="bar-hp" style={{ width: `${(m.hp / m.maxHp) * 100}%` }} />
                </div>
                <div className="bar" title={`MP ${m.mp}/${m.maxMp}`}>
                  <div className="bar-mp" style={{ width: `${(m.mp / m.maxMp) * 100}%` }} />
                </div>
                {(m.rightHand || m.leftHand) && (
                  <div className="party-weapons">
                    {m.rightHand && <span title="Main droite">🗡️ {m.rightHand.name}</span>}
                    {m.leftHand && <span title="Main gauche">🛡️ {m.leftHand.name}</span>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
