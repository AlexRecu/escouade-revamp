import { useMemo } from 'react';
import type { GameState, ExplorationState, CombatState } from '../types/game';
import { classTokenUrl, tokenUrl, defeatedTokenStyle } from '../utils/tokens';
import { weaponEmoji, weaponStatLabel, weaponRangeLabel } from '../utils/weapons';

type Props = {
  state: GameState | null;
  connected: boolean;
  /** État d'exploration courant (PV/MP/or à jour pendant le donjon). */
  exploration: ExplorationState | null;
  /** État de combat courant (PV/MP à jour en temps réel pendant le combat). */
  combat: CombatState | null;
  /** Id du joueur connecté (pour mettre son personnage en premier). */
  myPlayerId: string | null;
  /** Ouvre le panneau de détail d'un personnage (stats, compétences, sorts, équipement). */
  onSelectMember?: (memberId: string) => void;
};

/**
 * Colonne latérale permanente de l'équipe (visible sur la mappemonde, en ville
 * ET en donjon). Affiche les membres (PV/MP) + les armes équipées.
 *
 * Pendant l'exploration, les PV/MP/or proviennent de l'état d'exploration
 * (`exploration.party`) — l'état de ville (`state.party`) n'est pas mis à jour
 * pendant le donjon. Le personnage du joueur connecté est affiché en premier
 * pour qu'il puisse suivre ses PV sans scroller (surtout en mobile).
 */
export default function PartySidebar({ state, connected, exploration, combat, myPlayerId, onSelectMember }: Props) {
  // Fusionne les PV/MP à jour sur les membres de base (ville). Priorité :
  // combat (temps réel) > exploration (donjon) > ville. Pendant le combat,
  // l'état d'exploration n'est pas rafraîchi (seul `combat:state` l'est), donc
  // on prend les PV/MP du plateau de combat pour qu'ils bougent en direct.
  const members = useMemo(() => {
    if (!state) return [];
    const base = state.party.members;
    const expMembers = exploration?.party.members ?? [];
    const combatUnits = combat?.units ?? [];
    const merged = base.map((m) => {
      const exp = expMembers.find((e) => e.id === m.id);
      const cu = combatUnits.find((u) => u.id === m.id);
      return {
        ...m,
        level: exp?.level ?? m.level,
        xp: exp?.xp ?? m.xp,
        xpToNext: exp?.xpToNext ?? m.xpToNext,
        xpNeeded: exp?.xpNeeded ?? m.xpNeeded,
        hp: cu ? cu.currentHp : exp ? exp.hp : m.hp,
        maxHp: cu ? cu.maxHp : exp ? exp.maxHp : m.maxHp,
        mp: cu ? (cu.currentMp ?? m.mp) : exp ? exp.mp : m.mp,
        maxMp: cu ? (cu.maxMp ?? m.maxMp) : exp ? exp.maxMp : m.maxMp,
        isDead: cu ? cu.isDead : exp ? exp.isDead : m.isDead,
      };
    });
    // Le personnage du joueur connecté en premier.
    merged.sort((a, b) => {
      const aMine = a.ownerId === myPlayerId ? 0 : 1;
      const bMine = b.ownerId === myPlayerId ? 0 : 1;
      return aMine - bMine;
    });
    return merged;
  }, [state, exploration, combat, myPlayerId]);

  // Or du groupe : on arrondit à 2 décimales pour éviter les artefacts de
  // virgule flottante (ex. "125.46000000000001").
  const gold = Math.round((exploration ? exploration.party.gold : state?.party.gold ?? 0) * 100) / 100;

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
          {/* Niveau du monde + or du groupe sur une seule ligne (compact mobile). */}
          <div className="party-level-row">
            <span className="party-level">
              Niveau du monde : <b>{state.party.worldLevel}</b>
            </span>
            <span className="party-gold-inline" title="Pot commun d'or de l'équipe">
              💰 <b>{gold}</b>
            </span>
          </div>
          <ul className="party-list">
            {members.map((m) => (
              <li
                key={m.id}
                className={`${m.isDead ? 'dead' : ''} ${m.ownerId === myPlayerId ? 'mine' : ''} ${onSelectMember ? 'clickable' : ''}`}
                onClick={() => onSelectMember?.(m.id)}
                title={onSelectMember ? 'Voir le détail du personnage' : undefined}
              >
                <div className="party-head">
                  {m.isDead && defeatedTokenStyle(m.job) ? (
                    <div
                      className="party-token party-token-defeated"
                      style={defeatedTokenStyle(m.job)!}
                      title="Personnage vaincu"
                    />
                  ) : (
                    <img
                      className={`party-token${m.isDead ? ' party-token-dead' : ''}`}
                      src={m.avatar ? tokenUrl(m.avatar) : classTokenUrl(m.job)}
                      alt={m.job}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          '/assets/tokens/default.png';
                      }}
                    />
                  )}
                  <span>{m.name}</span>
                  <span className="party-job">
                    {m.job} · niv.{m.level}
                  </span>
                </div>
                <div className="bar-row">
                  <span className="bar-label">PV</span>
                  <div className="bar">
                    <div className="bar-hp" style={{ width: `${(m.hp / m.maxHp) * 100}%` }} />
                  </div>
                  <span className="bar-value">{m.hp}/{m.maxHp}</span>
                </div>
                <div className="bar-row">
                  <span className="bar-label">MP</span>
                  <div className="bar">
                    <div className="bar-mp" style={{ width: `${(m.mp / m.maxMp) * 100}%` }} />
                  </div>
                  <span className="bar-value">{m.mp}/{m.maxMp}</span>
                </div>
                {(m.rightHand || m.leftHand) && (
                  <div className="party-weapons">
                    {m.rightHand && (
                      <span title="Main droite">
                        {weaponEmoji(m.rightHand.weaponType)} {m.rightHand.name}
                        {weaponStatLabel(m.rightHand) && <span className="party-weapon-stat"> {weaponStatLabel(m.rightHand)}</span>}
                        {weaponRangeLabel(m.rightHand) && <span className="party-weapon-range" title="Portée"> {weaponRangeLabel(m.rightHand)}</span>}
                      </span>
                    )}
                    {m.leftHand && (
                      <span title="Main gauche">
                        {weaponEmoji(m.leftHand.weaponType)} {m.leftHand.name}
                        {weaponStatLabel(m.leftHand) && <span className="party-weapon-stat"> {weaponStatLabel(m.leftHand)}</span>}
                        {weaponRangeLabel(m.leftHand) && <span className="party-weapon-range" title="Portée"> {weaponRangeLabel(m.leftHand)}</span>}
                      </span>
                    )}
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
