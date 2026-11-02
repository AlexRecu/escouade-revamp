// Composant de toasts : affiche les notifications éphémères (sauvegarde,
// nouvel aventurier, renommage de partie…) en surimpression, en haut à droite.
// Chaque toast disparaît automatiquement (géré par `useGame.pushToast`).

import type { Toast } from '../game/useGame';

type Props = {
  toasts: Toast[];
};

export default function ToastContainer({ toasts }: Props) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-container" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
