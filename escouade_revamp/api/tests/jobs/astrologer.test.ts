// tests/jobs/astrologer.test.ts
import { WhiteMage } from "../../src/classes/Jobs/WhiteMage";
import { Warrior } from "../../src/classes/Jobs/Warrior";
import { Character } from "../../src/classes/UnitTypes/Character";
import { Monster } from "../../src/classes/UnitTypes/Monster";
import { AstroCard } from "../../src/classes/Types";

/**
 * Tests de l'évolution Astromancien (Mage Blanc) et de la mécanique
 * d'astromancie : tirage de cartes, arcanes (mineure/majeure), Le Mat,
 * Dévoilement, Exaltation, et l'utilisation des sceaux (soleil/lune/étoile)
 * via `playCard` (Roi/Reine des couronnes).
 *
 * Mécanique (livret) :
 *  - **Tirage** : tire une carte du deck dans la main.
 *  - **Arcane mineure** : tire immédiatement un atout (Roi/Reine des couronnes).
 *  - **Exaltation** : +1 toutes les stats pendant 3 tours.
 *  - **Arcane majeure** : octroie 3 sceaux (un de chaque) puis tire un atout.
 *  - **Le Mat** : tire des cartes jusqu'à avoir un atout.
 *  - **Dévoilement** : consulte/réarrange les 4 prochaines cartes du deck.
 *  - Les **sceaux** (soleil/lune/étoile) amplifient le Roi (dégâts) et la
 *    Reine (soin), puis sont remis à zéro.
 */

/** Renvoie le job d'un personnage casté en WhiteMage (accès aux méthodes d'astromancie). */
function wm(c: Character): WhiteMage {
  return c.job as WhiteMage;
}

/** Fabrique un Astromancien (Mage Blanc évolué) au niveau donné. */
function makeAstrologer(id: string, level = 20): Character {
  const c = new Character(id, "Astromancien", "Hero", { row: 0, col: 0 }, new WhiteMage(), null, null);
  c.job.jobLevel = level;
  c.characterLevel = level;
  c.evolveJob("Astromancien");
  return c;
}

/** Fabrique un allié (Guerrier). */
function makeAlly(id: string): Character {
  return new Character(id, "Ally", "Hero", { row: 3, col: 1 }, new Warrior(), null, null);
}

/** Fabrique un ennemi avec les PV max donnés. */
function makeEnemy(id: string, maxHp: number): Monster {
  return new Monster(1, id, "Enemy", 1, { row: 1, col: 1 }, [], [], [1], [maxHp], [100], [100], [], [], [], []);
}

describe("Évolution Astromancien", () => {
  test("L'évolution applique les bonus de stats (Mana+1, Intelligence+1, Perception+2)", () => {
    const c = makeAstrologer("a1");
    expect(c.job.name).toBe("Astromancien");
    // Base WhiteMage : mana 3, int 2, per 1 → +1/+1/+2.
    expect(c.stats.mana).toBe(4);
    expect(c.stats.intelligence).toBe(3);
    expect(c.stats.perception).toBe(3);
  });

  test("Au niveau 20, seul le Tirage est débloqué ; au niveau 30, les 6 compétences", () => {
    const names20 = makeAstrologer("a2", 20).getAvailableAbilities().map((s) => s.name);
    expect(names20).toEqual(["Tirage"]);

    const names30 = makeAstrologer("a3", 30).getAvailableAbilities().map((s) => s.name);
    expect(names30).toEqual(["Tirage", "Arcane Mineure", "Exaltation", "Arcane Majeure", "Le Mat", "Dévoilement"]);
  });
});

describe("Tirage de cartes", () => {
  test("drawCard tire la première carte du deck et la place dans la main", () => {
    const c = makeAstrologer("d1");
    const job = wm(c);
    const card: AstroCard = { name: "TestCard", description: "", isAce: false };
    job.deck = [card];
    job.hand = [];
    const drawn = job.drawCard();
    expect(drawn).toBe(card);
    expect(job.hand).toContain(card);
    expect(job.deck).toHaveLength(0);
  });

  test("drawCard remélange le deck s'il est vide", () => {
    const c = makeAstrologer("d2");
    const job = wm(c);
    job.deck = [];
    job.hand = [];
    const drawn = job.drawCard();
    expect(job.deck.length).toBeGreaterThan(0); // remélangé
    expect(job.hand).toContain(drawn);
  });
});

describe("Arcanes", () => {
  test("Arcane mineure (drawMinorArcana) tire immédiatement un atout", () => {
    const c = makeAstrologer("m1");
    const job = wm(c);
    const ace: AstroCard = { name: "Le Roi des couronnes", description: "", power: 20, isAce: true };
    const normal: AstroCard = { name: "La Balance", description: "", isAce: false };
    job.deck = [normal, ace];
    job.hand = [];
    const drawn = job.drawMinorArcana();
    expect(drawn.isAce).toBe(true);
    expect(job.hand).toContain(ace);
    expect(job.deck).not.toContain(ace);
  });

  test("Arcane majeure (drawMajorArcana) octroie 3 sceaux puis tire un atout", () => {
    const c = makeAstrologer("m2");
    const job = wm(c);
    const ace: AstroCard = { name: "Le Roi des couronnes", description: "", power: 20, isAce: true };
    job.deck = [ace];
    job.hand = [];
    job.sigils = [{ solar: 0 }, { moon: 0 }, { stellar: 0 }];
    const drawn = job.drawMajorArcana();
    expect(drawn.isAce).toBe(true);
    // Un sceau de chaque type octroyé.
    expect(job.sigils[0].solar).toBe(1);
    expect(job.sigils[1].moon).toBe(1);
    expect(job.sigils[2].stellar).toBe(1);
  });

  test("Le Mat (drawFoolCard) tire des cartes jusqu'à avoir un atout", () => {
    const c = makeAstrologer("m3");
    const job = wm(c);
    const ace: AstroCard = { name: "Le Roi des couronnes", description: "", power: 20, isAce: true };
    const c1: AstroCard = { name: "C1", description: "", isAce: false };
    const c2: AstroCard = { name: "C2", description: "", isAce: false };
    job.deck = [c1, c2, ace];
    job.hand = [];
    const drawn = job.drawFoolCard();
    expect(drawn.isAce).toBe(true);
    // Les cartes intermédiaires sont aussi dans la main.
    expect(job.hand).toContain(c1);
    expect(job.hand).toContain(c2);
    expect(job.hand).toContain(ace);
  });
});

describe("Dévoilement (revealFourFirst / pushOnTopOfDeck)", () => {
  test("revealFourFirst met les 4 premières cartes dans le handBuffer", () => {
    const c = makeAstrologer("r1");
    const job = wm(c);
    const c1: AstroCard = { name: "C1", description: "", isAce: false };
    const c2: AstroCard = { name: "C2", description: "", isAce: false };
    const c3: AstroCard = { name: "C3", description: "", isAce: false };
    const c4: AstroCard = { name: "C4", description: "", isAce: false };
    job.deck = [c1, c2, c3, c4];
    job.handBuffer = [];
    job.revealFourFirst();
    expect(job.handBuffer).toHaveLength(4);
    expect(job.handBuffer).toContain(c1);
    expect(job.handBuffer).toContain(c4);
  });

  test("pushOnTopOfDeck remet une carte du handBuffer au dessus du deck", () => {
    const c = makeAstrologer("r2");
    const job = wm(c);
    const c1: AstroCard = { name: "C1", description: "", isAce: false };
    const c2: AstroCard = { name: "C2", description: "", isAce: false };
    job.handBuffer = [c1, c2];
    job.deck = [];
    job.pushOnTopOfDeck(c1);
    expect(job.deck[0]).toBe(c1);
    expect(job.handBuffer).not.toContain(c1);
  });
});

describe("Exaltation", () => {
  test("Exaltation augmente toutes les stats de 1 et applique le statut (3 tours)", () => {
    const c = makeAstrologer("e1");
    const job = wm(c);
    const ally = makeAlly("e1a");
    const strBefore = ally.stats.strength;
    job.exaltation(ally);
    expect(ally.stats.strength).toBe(strBefore + 1);
    expect(ally.status.some((s) => s.name === "Exaltation")).toBe(true);
  });

  test("Exaltation rafraîchit le statut sans ré-incrémenter les stats", () => {
    const c = makeAstrologer("e2");
    const job = wm(c);
    const ally = makeAlly("e2a");
    job.exaltation(ally);
    const strAfter1 = ally.stats.strength;
    job.exaltation(ally); // 2e usage : rafraîchit, pas d'incrément
    expect(ally.stats.strength).toBe(strAfter1);
    // Un seul statut Exaltation (pas de doublon).
    expect(ally.status.filter((s) => s.name === "Exaltation")).toHaveLength(1);
  });
});

describe("Sceaux (incrementSigil / resetSigils)", () => {
  test("incrementSigil incrémente le sceau du type donné ; resetSigils remet à zéro", () => {
    const c = makeAstrologer("s1");
    const job = wm(c);
    job.sigils = [{ solar: 0 }, { moon: 0 }, { stellar: 0 }];
    job.incrementSigil("solar");
    expect(job.sigils[0].solar).toBe(1);
    job.resetSigils();
    expect(job.sigils[0].solar).toBe(0);
    expect(job.sigils[1].moon).toBe(0);
    expect(job.sigils[2].stellar).toBe(0);
  });
});

describe("playCard (utilisation des sceaux)", () => {
  test("La Balance : +2 Dextérité + sceau Soleil, carte retirée de la main", () => {
    const c = makeAstrologer("p1");
    const job = wm(c);
    const ally = makeAlly("p1a");
    const balance: AstroCard = {
      name: "La Balance", description: "",
      bonus: { strength: 0, dexterity: 2, endurance: 0, mana: 0, intelligence: 0, perception: 0, charisma: 0 },
      isAce: false, sigil: "solar",
    };
    const dexBefore = ally.stats.dexterity;
    job.hand = [balance];
    job.sigils = [{ solar: 0 }, { moon: 0 }, { stellar: 0 }];
    job.playCard(balance, ally, [c, ally]);
    expect(ally.stats.dexterity).toBe(dexBefore + 2);
    expect(job.sigils[0].solar).toBe(1);
    expect(job.hand).not.toContain(balance);
  });

  test("La Flèche : applique le statut + sceau Lune", () => {
    const c = makeAstrologer("p2");
    const job = wm(c);
    const ally = makeAlly("p2a");
    const fleche: AstroCard = {
      name: "La Flèche", description: "",
      status: { name: "La Flèche", statusType: "boon", nbTurnEffect: 2 } as any,
      isAce: false, sigil: "moon",
    };
    job.hand = [fleche];
    job.sigils = [{ solar: 0 }, { moon: 0 }, { stellar: 0 }];
    job.playCard(fleche, ally, [c, ally]);
    expect(ally.status.some((s) => s.name === "La Flèche")).toBe(true);
    expect(job.sigils[1].moon).toBe(1);
  });

  test("Le Tronc : soin de 7 PV + sceau Soleil", () => {
    const c = makeAstrologer("p3");
    const job = wm(c);
    const ally = makeAlly("p3a");
    ally.currentHp = 5;
    const tronc: AstroCard = { name: "Le Tronc", description: "", isAce: false, sigil: "solar" };
    job.hand = [tronc];
    job.sigils = [{ solar: 0 }, { moon: 0 }, { stellar: 0 }];
    job.playCard(tronc, ally, [c, ally]);
    expect(ally.currentHp).toBe(12); // 5 + 7
    expect(job.sigils[0].solar).toBe(1);
  });

  test("Le Roi des couronnes : dégâts AOE amplifiés par les sceaux, puis reset", () => {
    const c = makeAstrologer("p4");
    const job = wm(c);
    const enemy = makeEnemy("p4e", 10000);
    const roi: AstroCard = { name: "Le Roi des couronnes", description: "", power: 20, isAce: true };

    // 0 sceau : dégâts = 20^2/2 = 200.
    job.sigils = [{ solar: 0 }, { moon: 0 }, { stellar: 0 }];
    job.hand = [roi];
    const hp0 = enemy.currentHp;
    job.playCard(roi, enemy, [c, enemy]);
    const dmg0 = hp0 - enemy.currentHp;
    expect(dmg0).toBe(200);

    // 3 sceaux solaires : multiplicateur ×2 → dégâts = 400.
    enemy.currentHp = 10000;
    job.sigils = [{ solar: 3 }, { moon: 0 }, { stellar: 0 }];
    job.hand = [roi];
    const hp1 = enemy.currentHp;
    job.playCard(roi, enemy, [c, enemy]);
    const dmg1 = hp1 - enemy.currentHp;
    expect(dmg1).toBe(dmg0 * 2);
    // Les sceaux sont remis à zéro après usage.
    expect(job.sigils[0].solar).toBe(0);
  });

  test("La Reine des couronnes : soin AOE selon les sceaux, puis reset", () => {
    const c = makeAstrologer("p5");
    const job = wm(c);
    const ally = makeAlly("p5a");
    ally.currentHp = 5;
    const reine: AstroCard = { name: "La Reine des couronnes", description: "", isAce: true };
    job.hand = [reine];
    job.sigils = [{ solar: 0 }, { moon: 0 }, { stellar: 0 }];
    job.playCard(reine, ally, [c, ally]);
    // stellar = 0 → soin de 3 PV.
    expect(ally.currentHp).toBe(8);
    // Les sceaux sont remis à zéro après usage.
    expect(job.sigils[0].solar).toBe(0);
  });
});
