// Animation de transition à l'entrée en combat (façon rencontre Pokémon) :
// des bandes noires horizontales qui se referment (obscurcissent l'écran)
// puis s'ouvrent (révèlent le combat). Composant overlay plein écran,
// pointer-events:none (ne bloque pas les clics), auto-démonté par App.tsx.
//
// Deux phases pilotées par App.tsx :
//  - `closing` : les bandes se referment SUR L'ÉCRAN D'EXPLORATION (le combat
//    n'est pas encore rendu) ;
//  - `opening` : les bandes s'ouvrent SUR L'ÉCRAN DE COMBAT (déjà rendu).
export default function CombatTransition({ phase }: { phase: 'closing' | 'opening' }) {
  return (
    <div className="combat-transition" aria-hidden="true">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className={`combat-transition-bar ${phase === 'closing' ? 'bar-close' : 'bar-open'}`}
          style={{ animationDelay: `${i * 0.03}s` }}
        />
      ))}
    </div>
  );
}
