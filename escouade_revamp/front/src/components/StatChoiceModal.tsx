import { useState } from 'react';
import type { Statistics } from '../types/game';

type Props = {
  /** Montées de niveau reportées (une entrée = un +1 stat à choisir). */
  levelUps: { characterId: string; name: string; level: number }[];
  /** Soumet les stats choisies (une par montée). */
  onSubmit: (choices: { characterId: string; stat: string }[]) => void;
};

/**
 * Ordre d'affichage des 7 stats + leur rôle (identique à l'écran de création
 * de personnage, pour un choix éclairé et cohérent).
 */
const STAT_META: { key: keyof Statistics; label: string; short: string; desc: string }[] = [
  { key: 'strength', label: 'Force', short: 'F', desc: 'Fait plus de dégâts avec les armes basées sur la Force.' },
  { key: 'dexterity', label: 'Dextérité', short: 'D', desc: 'Fait plus de dégâts avec les armes basées sur la Dextérité.' },
  { key: 'endurance', label: 'Endurance', short: 'E', desc: 'Détermine le nombre de points de vie (PV).' },
  { key: 'mana', label: 'Mana', short: 'M', desc: 'Détermine la quantité de points de magie (PM).' },
  { key: 'intelligence', label: 'Intelligence', short: 'I', desc: 'Fait plus de dégâts avec les sorts.' },
  { key: 'perception', label: 'Perception', short: 'P', desc: 'Détecte les objets cachés et réduit les attaques des monstres.' },
  { key: 'charisma', label: 'Charisme', short: 'C', desc: 'Permet de négocier (baisser) les prix chez les marchands.' },
];

/**
 * Écran de choix de stat après un combat victorieux avec montée de niveau.
 *
 * Le serveur **reporte** l'application de la stat (le niveau et l'XP sont
 * déjà appliqués, mais le +1 stat attend le choix du joueur). Pour chaque
 * montée de niveau, le joueur choisit laquelle des 7 stats augmenter. Quand
 * tout est choisi, on soumet les choix au serveur (`combat:submitStats`).
 */
export default function StatChoiceModal({ levelUps, onSubmit }: Props) {
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

        {levelUps.map((lu, i) => (
          <div key={`${lu.characterId}-${i}`} className="stat-choice-block">
            <div className="stat-choice-title">
              <span className="stat-choice-name">{lu.name}</span>
              <span className="stat-choice-level">Niveau {lu.level}</span>
            </div>
            <div className="stat-choice-grid">
              {STAT_META.map((s) => (
                <button
                  key={s.key}
                  className={`stat-choice-btn ${choices[i] === s.key ? 'active' : ''}`}
                  title={s.desc}
                  onClick={() => pick(i, s.key)}
                >
                  <span className="stat-choice-short">{s.short}</span>
                  <span className="stat-choice-label">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}

        <button className="stat-choice-submit" disabled={!allChosen} onClick={submit}>
          ✅ Valider les choix
        </button>
      </div>
    </div>
  );
}
