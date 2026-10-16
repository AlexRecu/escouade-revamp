// Client d'authentification (REST) + stockage du token JWT.

const BASE = '/api';
const TOKEN_KEY = 'escouade_token';
const USER_KEY = 'escouade_user';

export type AuthResult = { token: string; username: string };

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Erreur ${res.status}`);
  return data as T;
}

/** Inscrit un nouveau joueur. */
export const register = (username: string, email: string, password: string): Promise<AuthResult> =>
  post<AuthResult>('/auth/register', { username, email, password, rememberMe: true });

/** Connecte un joueur existant. */
export const login = (email: string, password: string): Promise<AuthResult> =>
  post<AuthResult>('/auth/login', { email, password });

/** Stocke le token + le pseudo. */
export const saveSession = (token: string, username: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, username);
};

/** Récupère le token stocké (ou null). */
export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);

/** Récupère le pseudo stocké (ou null). */
export const getUsername = (): string | null => localStorage.getItem(USER_KEY);

/** Détruit la session locale. */
export const clearSession = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};
