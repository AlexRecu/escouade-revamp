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
