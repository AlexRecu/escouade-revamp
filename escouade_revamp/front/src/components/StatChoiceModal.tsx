import { useState } from 'react';
import type { Statistics, PartyMember } from '../types/game';

type Props = {
  /** Montées de niveau reportées (une entrée = un +1 stat à choisir). */
  levelUps: { characterId: string; name: string; level: number }[];
  /** Membres fusionnés (stats/PV/MP à jour) pour afficher les valeurs courantes. */
  members: PartyMember[];
  /** Soumet les stats choisies (une par montée). */
  onSubmit: (choices: { characterId: string; stat: string }[]) => void;
};

/**
 * Ordre d'affichage des 7 stats + leur rôle.
 */
const STAT_META: { key: keyof Statistics; label: string; short: string; desc: string }[] = [
  { key: 'strength', label: 'Force', short: 'F', desc: 'Fait plus de dégâts avec les armes basées sur la Force.' },
  { key: 'dexterity', label: 'Dextérité', short: 'D', desc: 'Fait plus de dégâts avec les armes basées sur la Dextérité.' },
  { key: 'endurance', label: 'Endurance', short: 'E', desc: 'Détermine le nombre de points de vie (PV). +1 Endu = +2 PV.' },
  { key: 'mana', label: 'Mana', short: 'M', desc: 'Détermine la quantité de points de magie (PM). +1 Mana = +1 PM.' },
  { key: 'intelligence', label: 'Intelligence', short: 'I', desc: 'Fait plus de dégâts avec les sorts.' },
  { key: 'perception', label: 'Perception', short: 'P', desc: 'Détecte les objets cachés et réduit les attaques des monstres.' },
  { key: 'charisma', label: 'Charisme', short: 'C', desc: 'Permet de négocier (baisser) les prix chez les marchands.' },
];

/**
 * Écran de choix de stat après un combat victorieux avec montée de niveau.
 *
 * Affiche les stats courantes du personnage + PV/MP. Quand le joueur
 * sélectionne une stat, l'impact est prévisualisé en **vert** (la stat
 * augmente de 1, et PV/MP augmentent si c'est Endurance/Mana). L'effet
 * n'est appliqué qu'à la validation.
 */
export default function StatChoiceModal({ levelUps, members, onSubmit }: Props) {
  // Choix par montée : clé = index de la montée, valeur = stat choisie.
  const [choices, setChoices] = useState<Record<number, keyof Statistics | null>>({});

  const allChosen = levelUps.every((_, i) => choices[i] != null);

  const pick = (index: number, stat: keyof Statistics) => {
    setChoices((prev) => ({ ...prev, [index]: stat }));
  };

  const submit = () => {
    if (!allChosen) return;
    onSubmit(
      levelUps.map((lu, i) => ({
        characterId: lu.characterId,
        stat: choices[i] as string,
      }))
    );
  };

  return (
    <div className="stat-choice-overlay">
      <div className="stat-choice-modal">
        <h3>🎉 Montée de niveau !</h3>
        <p className="stat-choice-intro">
          Choisissez une statistique à augmenter pour chaque montée de niveau.
        </p>

        {levelUps.map((lu, i) => {
          const member = members.find((m) => m.id === lu.characterId);
          const stats = member?.stats;
          const selected = choices[i];

          // Impact prévisualisé : la stat sélectionnée +1, et PV/MP si Endu/Mana.
          const previewHp = selected === 'endurance' && stats ? (stats.endurance + 1) * 2 + 10 : null;
          const previewMp = selected === 'mana' && stats ? (stats.mana + 1) + 10 : null;

          return (
            <div key={`${lu.characterId}-${i}`} className="stat-choice-block">
              <div className="stat-choice-title">
                <span className="stat-choice-name">{lu.name}</span>
                <span className="stat-choice-level">Niveau {lu.level}</span>
              </div>

              {/* PV / MP courants (avec aperçu en vert si Endu/Mana sélectionné). */}
              {member && (
                <div className="stat-choice-vitals">
                  <span className="stat-choice-vital">
                    ❤️ PV : {member.maxHp}
                    {previewHp != null && (
                      <em className="stat-choice-impact"> → {previewHp}</em>
                    )}
                  </span>
                  <span className="stat-choice-vital">
                    💧 PM : {member.maxMp}
                    {previewMp != null && (
                      <em className="stat-choice-impact"> → {previewMp}</em>
                    )}
                  </span>
                </div>
              )}

              {/* Grille des 7 stats avec valeurs courantes + aperçu. */}
              <div className="stat-choice-grid">
                {STAT_META.map((s) => {
                  const current = stats?.[s.key] ?? 0;
                  const isSelected = selected === s.key;
                  const preview = isSelected ? current + 1 : null;
                  return (
                    <button
                      key={s.key}
                      className={`stat-choice-btn ${isSelected ? 'active' : ''}`}
                      title={s.desc}
                      onClick={() => pick(i, s.key)}
                    >
                      <span className="stat-choice-short">{s.short}</span>
                      <span className="stat-choice-label">{s.label}</span>
                      <span className={`stat-choice-value ${preview != null ? 'stat-choice-value-preview' : ''}`}>
                        {current}
                        {preview != null && <em> → {preview}</em>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        <button className="stat-choice-submit" disabled={!allChosen} onClick={submit}>
          ✅ Valider les choix
        </button>
      </div>
    </div>
  );
}
