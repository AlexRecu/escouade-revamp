// Paramètres utilisateur persistés en localStorage.
//
// Deux réglages (activés par défaut, désactivables depuis le menu 👤) :
//  - `confirmCombatEnd` : à la fin d'un combat, afficher un écran de
//    validation (journal complet : dégâts + butin/XP + montée de niveau)
//    avec un bouton « Valider la fin du combat » pour passer à la suite.
//  - `combatTransition` : animation de transition (bandes noires qui se
//    referment/s'ouvrent, façon rencontre Pokémon) à l'entrée en combat.

import { useCallback, useState } from 'react';

export type Settings = {
  /** Valider manuellement la fin d'un combat (relecture du journal). */
  confirmCombatEnd: boolean;
  /** Animation de transition à l'entrée en combat. */
  combatTransition: boolean;
};

const STORAGE_KEY = 'escouade_settings';

const DEFAULTS: Settings = {
  confirmCombatEnd: true,
  combatTransition: true,
};

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      confirmCombatEnd: parsed.confirmCombatEnd ?? DEFAULTS.confirmCombatEnd,
      combatTransition: parsed.combatTransition ?? DEFAULTS.combatTransition,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(s: Settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // localStorage indisponible (mode privé) → on ignore.
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(load);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      save(next);
      return next;
    });
  }, []);

  return { settings, update };
}
