import { useState } from 'react';

/**
 * Journal repliable (mobile) : un bouton 📜 flottant ouvre/ferme une feuille
 * en bas d'écran. Replié par défaut pour libérer l'espace de jeu.
 *
 * Visible uniquement sur mobile (masqué en CSS sur desktop, où le journal
 * reste intégré au layout). `entries` = les lignes du journal (plus récent en
 * dernier).
 */
export default function CollapsibleLog({ entries }: { entries: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="log-toggle"
        data-open={open}
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Fermer le narrateur' : 'Ouvrir le narrateur'}
        title="Narrateur"
      >
        📜
      </button>
      <div className="log-sheet" data-open={open}>
        <div className="log">
          {entries.length === 0 && <div className="entry">—</div>}
          {[...entries].reverse().map((e, i) => (
            <div className="entry" key={i}>
              {e}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
