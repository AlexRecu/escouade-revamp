import { Character } from "../UnitTypes/Character";
import { Monster } from "../UnitTypes/Monster";
import { Unit } from "../UnitTypes/Unit";
import { Item } from "./Item";

/**
 * Une entrée du Monstronomicon : un monstre (ou une classe) **étudié** via
 * "Scan". Les détails (PV par zone, rang, sprite, attaques) sont dérivés du
 * bestiaire par le `name` au moment de l'affichage — on ne stocke que le nom
 * et l'état d'apprentissage (persistable en JSON).
 */
export interface StudiedEntry {
  /** Nom du monstre (clé du bestiaire) ou nom de classe étudiée. */
  name: string;
  /** L'attaque a-t-elle été apprise (via "Apprendre") ? */
  isLearned: boolean;
  /** Nom de l'attaque apprise (si `isLearned`). */
  learnedAttack?: string;
}

export class Monstronomicon extends Item {
    /** Monstres/classes étudiés (persistance : sérialisé dans le job). */
    entries: StudiedEntry[];
    level: number;

    constructor(id: string) {
        super(
            id,
            "Monstronomicon",
            "special",
            "Une encyclopédie compilant l'ensemble des créatures du royaume, on y trouve leur forces et faiblesses seuls les plus grands Sages bleus peuvent l'utiliser pleinement.",
            0,
            0
        );
        this.entries = [];
        this.level = 2;
    }

    /** Ajoute un monstre/classe comme étudié (idempotent par nom). */
    addEntry(name: string): void {
        if (!this.isRegisteredByName(name)) {
            this.entries.push({ name, isLearned: false });
        }
    }

    /** Marque l'attaque apprise pour un monstre déjà étudié. */
    markLearned(name: string, attack: string): void {
        const entry = this.entries.find((e) => e.name === name);
        if (entry) {
            entry.isLearned = true;
            entry.learnedAttack = attack;
        }
    }

    isRegisteredByName(name: string): boolean {
        return this.entries.some((e) => e.name === name);
    }

    isRegistered(target: Unit): boolean {
        return this.isRegisteredByName(target.name);
    }

    isScannable(target: Unit): boolean {
        return (target instanceof Monster && this.level >= target.rank) || target instanceof Character;
    }

    setLevel(newLevel: number): void {
        if (newLevel > 0) {
            this.level = newLevel;
        }
    }

}