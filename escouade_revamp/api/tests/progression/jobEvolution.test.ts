// tests/progression/jobEvolution.test.ts
import { Character } from "../../src/classes/UnitTypes/Character";
import { Warrior } from "../../src/classes/Jobs/Warrior";
import { BlackMage } from "../../src/classes/Jobs/BlackMage";
import { Monster } from "../../src/classes/UnitTypes/Monster";
import { Hammer } from "../../src/classes/Items/Weapon";
import { LootEngine } from "../../src/classes/Progression/LootEngine";

/**
 * Tests des évolutions de classe + demonToken (passe TODO).
 *
 * Avant cette passe :
 *  - `jobLevel` n'était **jamais incrémenté** en jeu (seul `characterLevel`
 *    montait via `applyXp`) → `evolveJob` refusait toujours ("niveau requis 20"),
 *    et les compétences/sorts/pactes (qui dépendent de `jobLevel`) ne se
 *    débloquaient jamais.
 *  - `evolveJob` appliquait 6 bonus de stats mais **oubliait `endurance`**.
 *  - `demonToken` (Berserk / Chevalier Noir) était incrémenté mais **jamais lu**
 *    dans la formule d'attaque.
 *
 * Ces tests verrouillent les 3 corrections.
 */

/** Fabrique un Guerrier niveau 1 (stats de base). */
function makeWarrior(id: string): Character {
  return new Character(id, "Guerrier", "Hero", { row: 0, col: 0 }, 30, 30, [], 10, 10, 10, 10, new Warrior(), null, null);
}

/** Fabrique une cible (Frelon, PV élevés). L'arme n'ayant pas d'élément, le
 *  multiplicateur de dégâts est toujours 1. */
function makeTarget(): Monster {
  return new Monster("Frelon", { row: 0, col: 0 }, "Enemy", 1);
}

describe("Évolutions de classe — câblage", () => {
  test("applyXp incrémente jobLevel (le niveau de classe suit le personnage)", () => {
    const w = makeWarrior("w1");
    expect(w.job.jobLevel).toBe(1);
    expect(w.characterLevel).toBe(1);

    // 100 XP → niveau 2 (level_data[0].xp = 100).
    LootEngine.applyXp(w, 100, () => "strength", [], []);
    expect(w.characterLevel).toBe(2);
    expect(w.job.jobLevel).toBe(2);
  });

  test("availableEvolutions : vide avant le niveau requis", () => {
    const w = makeWarrior("w2");
    w.job.jobLevel = 19;
    expect(w.availableEvolutions()).toHaveLength(0);
  });

  test("availableEvolutions : renvoie les évolutions au niveau 20", () => {
    const w = makeWarrior("w3");
    w.job.jobLevel = 20;
    const names = w.availableEvolutions().map((e) => e.name);
    expect(names).toContain("Paladin");
    expect(names).toContain("Chevalier Noir");
  });

  test("availableEvolutions : vide une fois évolué", () => {
    const w = makeWarrior("w4");
    w.job.jobLevel = 20;
    w.evolveTo("Paladin");
    expect(w.availableEvolutions()).toHaveLength(0);
  });

  test("evolveTo : change le nom et applique les bonus de stats", () => {
    const w = makeWarrior("w5");
    w.job.jobLevel = 20;
    const strBefore = w.stats.strength;
    const dexBefore = w.stats.dexterity;
    const manBefore = w.stats.mana;

    w.evolveTo("Chevalier Noir"); // +2 str, +2 dex, +2 mana.
    expect(w.job.name).toBe("Chevalier Noir");
    expect(w.job.evolvedName).toBe("Chevalier Noir");
    expect(w.stats.strength).toBe(strBefore + 2);
    expect(w.stats.dexterity).toBe(dexBefore + 2);
    expect(w.stats.mana).toBe(manBefore + 2);
  });

  test("evolveTo : applique le bonus d'endurance (bug corrigé)", () => {
    const w = makeWarrior("w6");
    w.job.jobLevel = 20;
    const endBefore = w.stats.endurance;

    w.evolveTo("Paladin"); // +3 endurance, +2 mana.
    expect(w.stats.endurance).toBe(endBefore + 3);
  });

  test("evolveTo : refuse si déjà évolué", () => {
    const w = makeWarrior("w7");
    w.job.jobLevel = 20;
    w.evolveTo("Paladin");
    expect(() => w.evolveTo("Chevalier Noir")).toThrow(/déjà évolué/);
  });

  test("Démoniste : l'évolution est dispo au niveau 20 (BlackMage)", () => {
    const d = new Character("d1", "Mage Noir", "Hero", { row: 0, col: 0 }, 30, 30, [], 12, 12, 10, 10, new BlackMage(), null, null);
    d.job.jobLevel = 20;
    const names = d.availableEvolutions().map((e) => e.name);
    expect(names).toContain("Démoniste");
    d.evolveTo("Démoniste");
    expect(d.job.name).toBe("Démoniste");
  });
});

describe("demonToken (Berserk / Chevalier Noir)", () => {
  /** Dégâts infligés par une attaque du guerrier (roll=3, pas de crit). */
  function dealDamage(warrior: Character): number {
    const target = makeTarget();
    const hpBefore = target.currentHp;
    warrior.attack(target, 3, 0);
    return hpBefore - target.currentHp;
  }

  test("Chaque marqueur demonToken ajoute +10% aux dégâts", () => {
    const w = makeWarrior("bw");
    w.job.jobLevel = 20;
    w.evolveTo("Chevalier Noir");
    w["rightHand"] = new Hammer("h", "Hammer", "", 0, 0, 2, "");

    const base = dealDamage(w);
    expect(base).toBeGreaterThan(0);

    (w.job as Warrior).demonToken = 2; // +20%.
    const boosted = dealDamage(w);
    expect(boosted).toBeCloseTo(base * 1.2, 5);
  });

  test("Sans marqueur, aucun bonus (demonToken = 0)", () => {
    const w = makeWarrior("bw2");
    w.job.jobLevel = 20;
    w.evolveTo("Chevalier Noir");
    w["rightHand"] = new Hammer("h", "Hammer", "", 0, 0, 2, "");

    const base = dealDamage(w);
    (w.job as Warrior).demonToken = 0;
    const noToken = dealDamage(w);
    expect(noToken).toBe(base);
  });

  test("Le demonToken ne s'applique qu'au Chevalier Noir (pas au Guerrier de base)", () => {
    const w = makeWarrior("bw3"); // Guerrier non évolué.
    w["rightHand"] = new Hammer("h", "Hammer", "", 0, 0, 2, "");
    (w.job as Warrior).demonToken = 5;

    const base = dealDamage(w);
    // Même valeur qu'avec 0 token (le bonus n'est pas appliqué hors Chevalier Noir).
    (w.job as Warrior).demonToken = 0;
    const noToken = dealDamage(w);
    expect(base).toBe(noToken);
  });
});
