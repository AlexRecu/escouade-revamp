import { useState } from 'react';
import type { RoomSummary } from '../types/game';

type Props = {
  rooms: RoomSummary[];
  connected: boolean;
  /** Id du joueur connecté (pour savoir s'il est l'hôte d'une partie). */
  myPlayerId: string | null;
  onCreate: (opts: { name?: string; isPublic?: boolean; maxPlayers?: number; difficulty?: 'easy' | 'hard' }) => void;
  onJoin: (roomId: string, isSpectator?: boolean) => void;
  /** Supprime définitivement une partie (hôte uniquement). */
  onDelete: (roomId: string) => void;
};

/**
 * Écran de lobby : liste les parties en cours et permet d'en **créer** une
 * (en devenant l'hôte) ou d'en **rejoindre** une (en joueur ou en
 * spectateur). C'est la porte d'entrée du mode multi-joueurs : une fois dans
 * une partie, le joueur accède à la mappemonde / ville / donjons.
 */
export default function LobbyScreen({ rooms, connected, myPlayerId, onCreate, onJoin, onDelete }: Props) {
  const [name, setName] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [difficulty, setDifficulty] = useState<'easy' | 'hard'>('easy');

  const create = () => {
    onCreate({ name: name.trim() || undefined, isPublic, maxPlayers, difficulty });
    setName('');
  };

  return (
    <div className="lobby">
      <div className="lobby-head">
        <h2>Parties en cours</h2>
        <span className="lobby-status">{connected ? '● En ligne' : '○ Connexion…'}</span>
      </div>

      <div className="lobby-create">
        <input
          className="lobby-input"
          type="text"
          placeholder="Nom de la partie (optionnel)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
        />
        <label className="lobby-check">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
          />
          Publique (visible dans le lobby)
        </label>
        <label className="lobby-check">
          Joueurs max :
          <select
            className="lobby-select"
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(Number(e.target.value))}
          >
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="lobby-check">
          Difficulté :
          <select
            className="lobby-select"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as 'easy' | 'hard')}
            title="Facile : défaite = ranimation payante (ou dernier survivant à 1 PV). Difficile : défaite sans or = game over, partie supprimée."
          >
            <option value="easy">Facile</option>
            <option value="hard">Difficile</option>
          </select>
        </label>
        <button className="lobby-btn primary" onClick={create} disabled={!connected}>
          + Créer une partie
        </button>
      </div>

      <div className="lobby-list">
        {rooms.length === 0 && (
          <p className="lobby-empty">
            Aucune partie publique pour le moment. Créez-en une pour commencer !
          </p>
        )}
        {rooms.map((r) => {
          const full = r.playerCount >= r.maxPlayers;
          const isHost = myPlayerId != null && r.hostId === myPlayerId;
          return (
            <div key={r.roomId} className="lobby-room">
              <div className="lobby-room-info">
                <span className="lobby-room-name">
                  {r.name}
                  {r.isPublic ? '' : ' 🔒'}
                </span>
                <span className="lobby-room-meta">
                  Hôte : {r.hostName} · {r.playerCount}/{r.maxPlayers} joueurs
                  {r.members.some((m) => m.isSpectator) &&
                    ` · ${r.members.filter((m) => m.isSpectator).length} spect.`}
                </span>
              </div>
              <div className="lobby-room-actions">
                <button
                  className="lobby-btn"
                  onClick={() => onJoin(r.roomId, false)}
                  disabled={!connected || full}
                  title={full ? 'Partie pleine' : 'Rejoindre en joueur'}
                >
                  Rejoindre
                </button>
                <button
                  className="lobby-btn ghost"
                  onClick={() => onJoin(r.roomId, true)}
                  disabled={!connected}
                  title="Rejoindre en spectateur (consultation uniquement)"
                >
                  Spectateur
                </button>
                {isHost && (
                  <button
                    className="lobby-btn danger"
                    onClick={() => {
                      if (window.confirm(`Supprimer définitivement la partie « ${r.name} » ?`)) {
                        onDelete(r.roomId);
                      }
                    }}
                    title="Supprimer définitivement cette partie (hôte uniquement)"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
