import { useState } from 'react';
import { login, register, saveSession } from '../api/auth';

type Props = {
  onAuthed: (username: string) => void;
};

/**
 * Écran d'authentification (connexion / inscription).
 *
 * Une fois connecté, le token JWT est stocké en localStorage et le socket
 * pourra se connecter avec.
 */
export default function AuthScreen({ onAuthed }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result =
        mode === 'login'
          ? await login(email, password)
          : await register(username, email, password);
      saveSession(result.token, result.username);
      onAuthed(result.username);
    } catch (err: any) {
      setError(err?.message ?? 'Erreur inconnue');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      {/* Fond d'écran (image de la précédente version du projet). */}
      <div
        className="auth-bg"
        style={{
          backgroundImage: `url('/assets/login/friends.png')`,
        }}
        aria-hidden
      />
      <form className="auth-card" onSubmit={submit}>
        <h2>ESCOUADE</h2>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === 'login' ? 'tab active' : 'tab'}
            onClick={() => setMode('login')}
          >
            Connexion
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'tab active' : 'tab'}
            onClick={() => setMode('register')}
          >
            Inscription
          </button>
        </div>

        {mode === 'register' && (
          <label>
            Pseudo
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              placeholder="Votre pseudo"
            />
          </label>
        )}

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="vous@exemple.com"
          />
        </label>

        <label>
          Mot de passe
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            placeholder="••••••"
          />
        </label>

        {error && <div className="auth-error">{error}</div>}

        <button type="submit" disabled={busy} className="auth-submit">
          {busy ? '…' : mode === 'login' ? 'Se connecter' : "S'inscrire"}
        </button>
      </form>
    </div>
  );
}
