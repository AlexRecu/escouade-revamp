import type { WorldSummary, Hub, Status } from '../types/world';
import type { JobInfo } from '../types/game';

// En dev, Vite proxy `/api` vers http://localhost:5000 (voir vite.config.ts).
// En prod, on utilisera l'URL absolue du backend.
const BASE = '/api';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Erreur ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** Récupère le monde (mappemonde : hubs, donjons, connexions). */
export const fetchWorld = (): Promise<WorldSummary> => get<WorldSummary>('/world');

/** Récupère le détail d'une ville (layout, services). */
export const fetchHub = (hubId: string): Promise<Hub> => get<Hub>(`/world/hub/${hubId}`);

/** Récupère la liste des statuts (armes + sorts + compétences). */
export const fetchStatuses = (): Promise<Status[]> => get<Status[]>('/world/statuses');

/** Récupère les jobs disponibles (création de personnage). */
export const fetchJobs = (): Promise<JobInfo[]> => get<JobInfo[]>('/world/jobs');
