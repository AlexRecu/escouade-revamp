import { useEffect, useMemo, useState } from 'react';
import { fetchJobs } from '../api/client';
import { CLASS_AVATARS, classTokenFile, tokenUrl, DEFAULT_TOKEN_URL } from '../utils/tokens';
import type { JobInfo, Statistics } from '../types/game';

type Props = {
  /** Pseudo du joueur (pré-remplit le nom du personnage). */
  defaultName: string;
  /** Crée le personnage (job + stats réparties + avatar). */
  onCreate: (data: {
    name: string;
    job: string;
    stats: Record<string, number>;
    avatar?: string | null;
  }) => void;
  /** Message d'erreur renvoyé par le serveur (ex. budget mal réparti). */
  error: string | null;
};

/**
 * Ordre d'affichage des 7 stats + leur rôle (pour éclairer le choix du joueur).
 * Le budget est de **1 point par niveau** (niveau 1 = 1 point à placer).
 */
const STAT_META: { key: keyof Statistics; label: string; short: string; desc: string }[] = [
  { key: 'strength', label: 'Force', short: 'F', desc: 'Fait plus de dégâts avec les armes basées sur la Force.' },
  { key: 'dexterity', label: 'Dextérité', short: 'D', desc: 'Augmente l\'initiative et les dégâts d\'armes basées sur la Dextérité.' },
  { key: 'endurance', label: 'Endurance', short: 'E', desc: 'Détermine le nombre de points de vie (PV).' },
  { key: 'mana', label: 'Mana', short: 'M', desc: 'Détermine la quantité de points de magie (PM).' },
  { key: 'intelligence', label: 'Intelligence', short: 'I', desc: 'Fait plus de dégâts avec les sorts.' },
  { key: 'perception', label: 'Perception', short: 'P', desc: 'Détecte les objets cachés et réduit les attaques des monstres.' },
  { key: 'charisma', label: 'Charisme', short: 'C', desc: 'Permet de négocier (baisser) les prix chez les marchands.' },
];

/** Budget de points à répartir (1 par niveau, niveau 1 = 1 point). */
const BUDGET = 1;

/**
 * Écran de création de personnage (multi-joueurs). Chaque joueur crée **son**
 * personnage : choix du job, répartition de 1 point (par niveau) dans une stat,
 * et choix de l'avatar parmi les tokens de classe. Une fois validé, le
 * personnage rejoint l'équipe partagée (diffusé à toute la partie).
 */
export default function CharacterCreationScreen({ defaultName, onCreate, error }: Props) {
  const [jobs, setJobs] = useState<JobInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [name, setName] = useState(defaultName);
  // Bonus réparti par stat (0 ou 1 au niveau 1).
  const [bonus, setBonus] = useState<Record<string, number>>({});
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    fetchJobs()
      .then((data) => {
        setJobs(data);
        if (data.length > 0) setSelectedJob(data[0].name);
      })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const job = useMemo(
    () => jobs.find((j) => j.name === selectedJob) ?? null,
    [jobs, selectedJob]
  );

  // Avatar par défaut = token de la classe sélectionnée.
  const defaultAvatar = selectedJob ? classTokenFile(selectedJob) : null;
  const effectiveAvatar = avatar ?? defaultAvatar;

  const allocated = useMemo(
    () => Object.values(bonus).reduce((sum, v) => sum + (v || 0), 0),
    [bonus]
  );
  const remaining = BUDGET - allocated;

  const changeBonus = (key: string, delta: number) => {
    setBonus((prev) => {
      const cur = prev[key] || 0;
      const next = cur + delta;
      // On ne dépasse jamais le budget ni les bornes 0..12.
      if (next < 0) return prev;
      if (delta > 0 && remaining <= 0) return prev;
      return { ...prev, [key]: next };
    });
  };

  const totalFor = (key: keyof Statistics): number => {
    const base = job?.defaultStats[key] ?? 0;
    return base + (bonus[key] || 0);
  };

  const canSubmit = !!job && name.trim().length > 0 && allocated === BUDGET;

  const submit = () => {
    if (!job || !canSubmit) return;
    onCreate({
      name: name.trim(),
      job: job.name,
      stats: bonus,
      avatar: effectiveAvatar,
    });
  };

  if (loading) return <div className="worldmap">Chargement des classes…</div>;
  if (loadError) return <div className="worldmap">Erreur : {loadError}</div>;

  return (
    <div className="creation">
      <div className="creation-head">
        <h2>Créer votre personnage</h2>
        <p className="creation-sub">
          Choisissez votre classe, répartissez vos points et choisissez votre avatar.
        </p>
      </div>

      {/* ── Choix de la classe ─────────────────────────────────────────── */}
      <section className="creation-section">
        <h3>1. Classe</h3>
        <div className="creation-jobs">
          {jobs.map((j) => (
            <button
              key={j.name}
              className={`creation-job ${selectedJob === j.name ? 'selected' : ''}`}
              onClick={() => {
                setSelectedJob(j.name);
                setBonus({}); // réinitialise la répartition (stats de base changent)
                setAvatar(null); // retourne au token de la nouvelle classe
              }}
            >
              <img
                className="creation-job-token"
                src={tokenUrl(classTokenFile(j.name) ?? 'default.png')}
                alt={j.name}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = DEFAULT_TOKEN_URL;
                }}
              />
              <span className="creation-job-name">{j.name}</span>
              <span className="creation-job-desc">{j.description}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Nom ────────────────────────────────────────────────────────── */}
      <section className="creation-section">
        <h3>2. Nom du personnage</h3>
        <input
          className="creation-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          placeholder="Nom du personnage"
        />
      </section>

      {/* ── Répartition des stats ──────────────────────────────────────── */}
      <section className="creation-section">
        <h3>
          3. Statistiques
          <span className={`creation-budget ${remaining === 0 ? 'ok' : ''}`}>
            {remaining} point{remaining > 1 ? 's' : ''} à répartir
          </span>
        </h3>
        <p className="creation-sub">
          Vous disposez de <strong>1 point par niveau</strong> (niveau 1 = 1 point) à
          placer en plus des stats de base de votre classe.
        </p>
        <div className="creation-stats">
          {STAT_META.map((s) => (
            <div className="creation-stat" key={s.key} title={s.desc}>
              <div className="creation-stat-head">
                <span className="creation-stat-name">
                  <span className="creation-stat-short">{s.short}</span> {s.label}
                </span>
                <span className="creation-stat-value">
                  {job ? job.defaultStats[s.key] : 0}
                  {bonus[s.key] ? <em> +{bonus[s.key]}</em> : null}
                  <strong> = {totalFor(s.key)}</strong>
                </span>
              </div>
              <div className="creation-stat-desc">{s.desc}</div>
              <div className="creation-stat-controls">
                <button
                  className="creation-stat-btn"
                  onClick={() => changeBonus(s.key, -1)}
                  disabled={(bonus[s.key] || 0) <= 0}
                  aria-label={`Retirer un point à ${s.label}`}
                >
                  −
                </button>
                <button
                  className="creation-stat-btn"
                  onClick={() => changeBonus(s.key, 1)}
                  disabled={remaining <= 0}
                  aria-label={`Ajouter un point à ${s.label}`}
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Avatar ─────────────────────────────────────────────────────── */}
      <section className="creation-section">
        <h3>4. Avatar</h3>
        <div className="creation-avatars">
          {CLASS_AVATARS.map(({ job, file }) => (
            <button
              key={file}
              className={`creation-avatar ${effectiveAvatar === file ? 'selected' : ''}`}
              onClick={() => setAvatar(file)}
              title={job}
            >
              <img
                src={tokenUrl(file)}
                alt={job}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = DEFAULT_TOKEN_URL;
                }}
              />
            </button>
          ))}
        </div>
      </section>

      {error && <div className="creation-error">{error}</div>}

      <button
        className="creation-submit"
        onClick={submit}
        disabled={!canSubmit}
        title={
          !canSubmit
            ? allocated !== BUDGET
              ? `Répartissez vos ${BUDGET} point(s) pour continuer.`
              : 'Choisissez un nom.'
            : undefined
        }
      >
        Créer le personnage
      </button>
    </div>
  );
}
