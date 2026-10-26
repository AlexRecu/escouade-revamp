import type { GameOverRecap } from '../types/game';
import { defeatedTokenStyle, monsterTokenUrl } from '../utils/tokens';

type Props = {
  recap: GameOverRecap;
  /** Ferme l'écran (retour au lobby). */
  onDismiss: () => void;
};

/**
 * Écran de **game over** (mode difficile) : l'équipe est anéantie sans assez
 * d'or pour se ranimer. La partie est supprimée côté serveur. Affiche le
 * dernier héros tombé (sprite vaincu) + l'ennemi qui l'a tué (sprite) + le
 * log du dernier tour de combat.
 */
export default function GameOverScreen({ recap, onDismiss }: Props) {
  const heroStyle = defeatedTokenStyle(recap.heroJob);
  return (
    <div className="gameover-overlay">
      <div className="gameover-modal">
        <h2 className="gameover-title">
          {recap.mode === 'hard' ? '💀 Game over' : '💀 Vous avez péri'}
        </h2>
        <p className="gameover-sub">
          {recap.mode === 'hard'
            ? "L'équipe est anéantie. La partie a été supprimée."
            : "L'équipe est anéantie. Retour à la ville pour se ranimer au sanctuaire."}
        </p>

        <div className="gameover-duel">
          <div className="gameover-side">
            <span className="gameover-side-label">Dernier héros tombé</span>
            {heroStyle ? (
              <div
                className="gameover-hero-token"
                style={heroStyle}
                title={`${recap.heroName} (${recap.heroJob})`}
              />
            ) : (
              <div className="gameover-hero-token gameover-hero-token-fallback">💀</div>
            )}
            <span className="gameover-side-name">{recap.heroName}</span>
            {recap.heroJob && <span className="gameover-side-job">{recap.heroJob}</span>}
          </div>

          <span className="gameover-vs">par</span>

          <div className="gameover-side">
            <span className="gameover-side-label">Tueur</span>
            <img
              className="gameover-killer-token"
              src={monsterTokenUrl(recap.killerName)}
              alt={recap.killerName}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/assets/tokens/default.png';
              }}
            />
            <span className="gameover-side-name">{recap.killerName}</span>
          </div>
        </div>

        {recap.lastTurnLog.length > 0 && (
          <div className="gameover-log">
            <h4>Dernier tour de combat</h4>
            <ul>
              {recap.lastTurnLog.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        )}

        <button className="gameover-btn" onClick={onDismiss}>
          {recap.mode === 'hard'
            ? 'Retour au lobby'
            : `Retour à ${recap.hubName ?? 'la ville'}${recap.reviveCost ? ` (${recap.reviveCost} or)` : ''}`}
        </button>
      </div>
    </div>
  );
}
