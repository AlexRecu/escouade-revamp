// Animation de transition à l'entrée en combat (façon rencontre Pokémon) :
// des bandes noires horizontales qui se referment (obscurcissent l'écran)
// puis s'ouvrent (révèlent le combat). Composant overlay plein écran,
// pointer-events:none (ne bloque pas les clics), auto-démonté par App.tsx.
export default function CombatTransition() {
  return (
    <div className="combat-transition" aria-hidden="true">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="combat-transition-bar"
          style={{ animationDelay: `${i * 0.03}s` }}
        />
      ))}
    </div>
  );
}
