// Utilitaires d'affichage des armes : emoji par type, libellé français et
// test d'équipabilité (selon les types autorisés par la classe).
//
// Les clés correspondent aux `weaponType` normalisés du backend
// (voir `ItemFactory.normalizeWeaponType`) : "epee", "katana", "marteau",
// "masse", "lance", "poing", "dague", "arc", "sceptre", "bouclier".

/** Emoji distinct par type d'arme. */
export const WEAPON_EMOJI: Record<string, string> = {
  poing: '🤛',
  lance: '🦯',
  masse: '🪒',
  dague: '🗡',
  epee: '🗡️',
  marteau: '🔨',
  katana: '🥢',
  arc: '🏹',
  sceptre: '🪄',
  bouclier: '🛡️',
};

/** Libellé français (singulier) par type d'arme. */
export const WEAPON_LABEL: Record<string, string> = {
  poing: 'Poings',
  lance: 'Lance',
  masse: 'Masse',
  dague: 'Dague',
  epee: 'Épée',
  marteau: 'Marteau',
  katana: 'Katana',
  arc: 'Arc',
  sceptre: 'Sceptre',
  bouclier: 'Bouclier',
};

/** Emoji d'un type d'arme (repli 🗡️ si inconnu). */
export function weaponEmoji(weaponType: string | null | undefined): string {
  return (weaponType && WEAPON_EMOJI[weaponType]) || '🗡️';
}

/** Libellé français d'un type d'arme (repli sur la clé si inconnu). */
export function weaponLabel(weaponType: string | null | undefined): string {
  if (!weaponType) return '';
  return WEAPON_LABEL[weaponType] ?? weaponType;
}

/**
 * Le personnage peut-il équiper ce type d'arme ?
 *
 * `equippableWeapons` est la liste des `weaponType` autorisés par la classe
 * (ex. un Guerrier : ["epee", "marteau", "masse", "lance", "poing"]).
 */
export function canEquip(
  equippableWeapons: string[] | undefined,
  weaponType: string | null | undefined
): boolean {
  if (!weaponType) return false;
  return (equippableWeapons ?? []).includes(weaponType);
}

/**
 * Libellé compact de la statistique d'attaque d'une arme.
 *
 * - Arme à une stat : `Force +5` / `Dextérité +5`.
 * - Arme à deux stats (lance) : `Force/Dextérité +2/+2`.
 *
 * Remplace l'ancien affichage séparé « type d'arme + stat + Atq X ».
 */
export function weaponStatLabel(w: {
  mainStat?: string;
  subStat?: string;
  weaponStat?: number;
  weaponSubStat?: number;
}): string {
  const main = w.mainStat;
  if (!main) return '';
  const mainVal = w.weaponStat ?? 0;
  const subVal = w.weaponSubStat ?? 0;
  // Arme sans attaque (ex. bouclier) : pas de libellé de stat.
  if (mainVal === 0 && subVal === 0) return '';
  if (w.subStat && subVal > 0) {
    return `${main}/${w.subStat} +${mainVal}/+${subVal}`;
  }
  return `${main} +${mainVal}`;
}

/**
 * Libellé de la portée (affiché seulement si > 1, ex. lances et arcs).
 * Un émoji + la valeur de range signale la portée augmentée.
 */
export function weaponRangeLabel(w: { range?: number }): string {
  const r = w.range ?? 1;
  return r > 1 ? `📏 ${r}` : '';
}
