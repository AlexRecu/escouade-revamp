// tests/jobs/blackMagePacts.test.ts
import { BlackMage } from "../../src/classes/Jobs/BlackMage";
import { Character } from "../../src/classes/UnitTypes/Character";
import { Demon } from "../../src/classes/UnitTypes/Demon";

/** Fabrique un Démoniste (BlackMage évolué) au niveau donné. */
function makeDemonist(level: number): Character {
  const c = new Character("d1", "Démoniste", "Hero", { row: 3, col: 3 }, 30, 30, [], 12, 12, 10, 10, new BlackMage(), null, null);
  c.job.jobLevel = level;
  c.characterLevel = level;
  if (level >= 20) c.evolveJob("Démoniste");
  return c;
}

describe("BlackMage — Système de pactes (Phase A)", () => {
  test("pactSlots : 0 avant le niveau 20", () => {
    const d = makeDemonist(10);
    expect((d.job as BlackMage).pactSlots).toBe(0);
    expect((d.job as BlackMage).canRecruit()).toBe(false);
  });

  test("pactSlots : 1 au niveau 20, 2 au niveau 21", () => {
    expect((makeDemonist(20).job as BlackMage).pactSlots).toBe(1);
    expect((makeDemonist(21).job as BlackMage).pactSlots).toBe(2);
  });

  test("pactSlots : 6 au niveau 30 (tous les pactes)", () => {
    expect((makeDemonist(30).job as BlackMage).pactSlots).toBe(6);
  });

  test("recruitDemon : consomme un pacte, availablePacts diminue", () => {
    const d = makeDemonist(21); // 2 slots
    const bm = d.job as BlackMage;
    expect(bm.availablePacts).toBe(2);

    bm.recruitDemon("Mateus, le Corrompu");
    expect(bm.recruitedDemons).toEqual(["Mateus, le Corrompu"]);
    expect(bm.availablePacts).toBe(1);
    expect(bm.canRecruit()).toBe(true);

    bm.recruitDemon("Adrammelech, le Grand Courroux");
    expect(bm.availablePacts).toBe(0);
    expect(bm.canRecruit()).toBe(false);
  });

  test("recruitDemon : refuse un double pacte avec le même démon", () => {
    const d = makeDemonist(20);
    const bm = d.job as BlackMage;
    bm.recruitDemon("Mateus, le Corrompu");
    const logs = bm.recruitDemon("Mateus, le Corrompu");
    expect(logs.some((l) => l.includes("déjà pactisé"))).toBe(true);
    expect(bm.recruitedDemons).toHaveLength(1);
  });

  test("recruitDemon : refuse si plus de pacte libre", () => {
    const d = makeDemonist(20); // 1 slot
    const bm = d.job as BlackMage;
    bm.recruitDemon("Mateus, le Corrompu");
    expect(() => bm.recruitDemon("Bélias, le Titan")).toThrow(/plus de pacte libre/);
  });

  test("recruitDemon : refuse un démon inconnu", () => {
    const d = makeDemonist(20);
    expect(() => (d.job as BlackMage).recruitDemon("Zorglub")).toThrow(/démon inconnu/);
  });

  test("listDemon : renvoie les démons pactisés (vide au départ)", () => {
    const d = makeDemonist(21); // 2 slots
    const bm = d.job as BlackMage;
    expect(bm.listDemon()).toHaveLength(0);
    bm.recruitDemon("Mateus, le Corrompu");
    bm.recruitDemon("Ultima, le Grand Séraphin");
    expect(bm.listDemon()).toEqual(["Mateus, le Corrompu", "Ultima, le Grand Séraphin"]);
  });

  test("summonDemon : ne peut invoquer qu'un démon pactisé", () => {
    const d = makeDemonist(20);
    const bm = d.job as BlackMage;
    // Non pactisé → refus.
    expect(() => bm.summonDemon("Mateus, le Corrompu", d)).toThrow(/pas pactisé/);
    // Pactisé → OK.
    bm.recruitDemon("Mateus, le Corrompu");
    const demon = bm.summonDemon("Mateus, le Corrompu", d);
    expect(demon).toBeInstanceOf(Demon);
    expect(bm.demons).toContain(demon);
  });
});
