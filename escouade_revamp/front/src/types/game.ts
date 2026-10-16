// Types du front — miroir de l'état de session sérialisé par le backend
// (HubSessionService.serialize).

import type { Hub } from './world';

export type BagItem = {
  id: string;
  name: string;
  type: string;
  description: string;
  purchasePrice: number;
  // Détails d'arme (présents si l'objet est une arme).
  weaponType?: string;
  mainStat?: string;
  weaponStat?: number;
  element?: string;
};

/** Arme équipée (main droite ou gauche). */
export type EquippedWeapon = {
  id: string;
  name: string;
  weaponType: string;
  subType: string;
  mainStat: string;
  weaponStat: number;
  element: string;
  status: string | null;
};

export type PartyMember = {
  id: string;
  name: string;
  job: string;
  jobLevel: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  gold: number;
  level: number;
  isDead: boolean;
  /** Types d'armes que ce personnage peut équiper (selon sa classe). */
  equippableWeapons: string[];
  /** Peut-il tenir une arme en main gauche (passif Double Armement) ? */
  canDualWield: boolean;
  rightHand: EquippedWeapon | null;
  leftHand: EquippedWeapon | null;
  bag: BagItem[];
};

export type QuestStep = {
  id: string;
  description: string;
  type: string;
  target: string;
  done: boolean;
};

export type Quest = {
  id: string;
  name: string;
  giver: { npc: string; hub: string; dialogue: string } | null;
  steps: QuestStep[];
  reward: { demon?: string; gold?: number; xp?: number; description: string };
  accepted: boolean;
  completed: boolean;
};

export type ShopItem = {
  name: string;
  /** "weapon" (arme) ou "consommable". */
  kind: 'weapon' | 'consumable';
  price: number;
  effect: string;
  // Champs d'arme (présents si kind === "weapon").
  subType?: string;
  mainStat?: string;
  weaponStat?: number;
  element?: string;
  status?: string | null;
};

/** État de session complet renvoyé par le serveur après chaque action. */
export type GameState = {
  hub: Hub;
  party: {
    id: string;
    worldLevel: number;
    completedZones: string[];
    /** Pot commun d'or de l'équipe (source de vérité des transactions de ville). */
    gold: number;
    /** Monstres déjà vus (bestiaire, persisté côté serveur). */
    seenMonsters: string[];
    members: PartyMember[];
  };
  quests: {
    available: Quest[];
    accepted: Quest[];
  };
  shop: ShopItem[];
};
