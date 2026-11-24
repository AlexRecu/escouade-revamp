import { useEffect, useMemo, useRef, useState } from 'react';
import type { PartyMember } from '../types/game';
import { classTokenUrl, monsterTokenUrl } from '../utils/tokens';

/**
 * Démo animée d'une compétence : une mini-scène (personnage + 2 ennemis) qui
 * rejoue le tour du personnage en boucle, avec un journal synchronisé qui met
 * en focus chaque étape. Purement illustratif — aucune logique de jeu.
 *
 * Le système est extensible : `getSkillDemoScript` contient des scripts
 * spécifiques pour les compétences connues, et un fallback générique pour les
 * autres (basé sur la description + la cible).
 */

type UnitKey = 'hero' | 'e1' | 'e2';

/** État visuel d'une unité à un instant donné (positions en cases 4×4). */
type UnitState = {
  /** Colonne de la grille (0-3). */
  col: number;
  /** Ligne de la grille (0-3). */
  row: number;
  hp: number;
  maxHp: number;
  /** Unité « active » (halo). */
  active?: boolean;
  /** Emoji d'effet superposé (🌀 ⚔️ 💥 ✨ …). */
  effect?: string;
  dead?: boolean;
};

/** Une étape de la démo : une ligne de journal + l'état des 3 unités. */
type DemoStep = {
  log: string;
  units: Record<UnitKey, UnitState>;
  /** Durée de l'étape en ms (défaut 1600). */
  ms?: number;
};

type Skill = { name: string; target: string; description: string };

/** Positions de base sur la grille 4×4 : héros à gauche, ennemis à droite. */
const BASE = {
  hero: { col: 0, row: 1 },
  e1: { col: 3, row: 0 },
  e2: { col: 3, row: 3 },
};

const ENEMY_NAMES = ['Gobelin', 'Frelon'];

/** Construit l'état initial des 3 unités. */
function baseUnits(): Record<UnitKey, UnitState> {
  return {
    hero: { ...BASE.hero, hp: 18, maxHp: 18 },
    e1: { ...BASE.e1, hp: 12, maxHp: 12 },
    e2: { ...BASE.e2, hp: 12, maxHp: 12 },
  };
}

/**
 * Renvoie le script de démo (liste d'étapes) pour une compétence.
 * Scripts spécifiques d'abord, sinon fallback générique.
 */
function getSkillDemoScript(skill: Skill, heroName: string): DemoStep[] {
  const u = baseUnits();
  const e1 = ENEMY_NAMES[0];
  const e2 = ENEMY_NAMES[1];

  // ── Pas de l'ombre (Voleur) : téléportation + bonus de critique ──────────
  if (skill.name === "Pas de l'ombre") {
    return [
      { log: `Le tour de ${heroName} commence.`, units: { ...u, hero: { ...u.hero, active: true } }, ms: 1500 },
      { log: `${heroName} utilise Pas de l'ombre.`, units: { ...u, hero: { ...u.hero, active: true, effect: '🌀' } }, ms: 1500 },
      {
        log: `${heroName} est téléporté derrière la cible la plus éloignée.`,
        units: {
          hero: { col: 2, row: 3, hp: 18, maxHp: 18, active: true, effect: '🌀' },
          e1: u.e1,
          e2: { ...u.e2, active: true },
        },
        ms: 1900,
      },
      {
        log: `Son taux de coup critique augmente.`,
        units: {
          hero: { col: 2, row: 3, hp: 18, maxHp: 18, active: true, effect: '⚔️' },
          e1: u.e1,
          e2: u.e2,
        },
        ms: 1600,
      },
      {
        log: `${heroName} attaque ${e2}.`,
        units: {
          hero: { col: 2, row: 3, hp: 18, maxHp: 18, active: true, effect: '⚔️' },
          e1: u.e1,
          e2: { ...u.e2, active: true, effect: '💥', hp: 5 },
        },
        ms: 1900,
      },
      { log: `Fin du tour de ${heroName}.`, units: { ...u, hero: { col: 2, row: 3, hp: 18, maxHp: 18 }, e2: { ...u.e2, hp: 5 } }, ms: 1500 },
    ];
  }

  // ── Vol (Voleur) : vol d'objet sur un ennemi ─────────────────────────────
  if (skill.name === 'Vol') {
    return [
      { log: `Le tour de ${heroName} commence.`, units: { ...u, hero: { ...u.hero, active: true } }, ms: 1500 },
      { log: `${heroName} utilise Vol sur ${e1}.`, units: { ...u, hero: { ...u.hero, active: true, effect: '🤫' }, e1: { ...u.e1, active: true } }, ms: 1600 },
      { log: `${heroName} fouille le sac de ${e1}…`, units: { ...u, hero: { ...u.hero, active: true, effect: '🤫' }, e1: { ...u.e1, active: true, effect: '🎒' } }, ms: 1700 },
      { log: `${heroName} vole un objet !`, units: { ...u, hero: { ...u.hero, active: true, effect: '💰' }, e1: { ...u.e1, effect: '💸' } }, ms: 1700 },
      { log: `Fin du tour de ${heroName}.`, units: u, ms: 1500 },
    ];
  }

  // ── Frappe empoisonnée (Voleur) : dégâts + poison ────────────────────────
  if (skill.name === 'Frappe empoisonnée') {
    return [
      { log: `Le tour de ${heroName} commence.`, units: { ...u, hero: { ...u.hero, active: true } }, ms: 1500 },
      { log: `${heroName} utilise Frappe empoisonnée sur ${e1}.`, units: { ...u, hero: { ...u.hero, active: true, effect: '🗡️' }, e1: { ...u.e1, active: true } }, ms: 1600 },
      { log: `${e1} perd des PV et est empoisonné.`, units: { ...u, hero: { ...u.hero, active: true }, e1: { ...u.e1, active: true, effect: '☠️', hp: 6 } }, ms: 1800 },
      { log: `Le poison ronge ${e1}.`, units: { ...u, hero: { ...u.hero }, e1: { ...u.e1, effect: '☠️', hp: 4 } }, ms: 1700 },
      { log: `Fin du tour de ${heroName}.`, units: { ...u, e1: { ...u.e1, hp: 4 } }, ms: 1500 },
    ];
  }

  // ── Bouclier impénétrable (Guerrier) : protection / interception ─────────
  if (skill.name === 'Bouclier impénétrable') {
    return [
      { log: `Le tour de ${heroName} commence.`, units: { ...u, hero: { ...u.hero, active: true } }, ms: 1500 },
      { log: `${heroName} utilise Bouclier impénétrable.`, units: { ...u, hero: { ...u.hero, active: true, effect: '🛡️' } }, ms: 1600 },
      { log: `Un bouclier de lumière l'enveloppe (lui et ses alliés, 4 tours).`, units: { ...u, hero: { ...u.hero, active: true, effect: '🛡️' } }, ms: 1900 },
      { log: `${e1} attaque ${heroName}.`, units: { ...u, hero: { ...u.hero, active: true, effect: '🛡️' }, e1: { ...u.e1, active: true, effect: '⚔️' } }, ms: 1800 },
      { log: `Le bouclier intercepte l'attaque !`, units: { ...u, hero: { ...u.hero, active: true, effect: '🛡️' }, e1: { ...u.e1, effect: '💥' } }, ms: 1900 },
      { log: `Fin du tour de ${heroName}.`, units: u, ms: 1500 },
    ];
  }

  // ── Scan / Apprendre (Mage bleu) ─────────────────────────────────────────
  if (skill.name === 'Scan') {
    return [
      { log: `Le tour de ${heroName} commence.`, units: { ...u, hero: { ...u.hero, active: true } }, ms: 1500 },
      { log: `${heroName} utilise Scan sur ${e1}.`, units: { ...u, hero: { ...u.hero, active: true, effect: '🔍' }, e1: { ...u.e1, active: true } }, ms: 1700 },
      { log: `${heroName} étudie ${e1} (rang, attaques, faiblesses).`, units: { ...u, hero: { ...u.hero, active: true, effect: '📖' }, e1: { ...u.e1, active: true, effect: '📖' } }, ms: 1900 },
      { log: `Fin du tour de ${heroName}.`, units: u, ms: 1500 },
    ];
  }

  // ── Fallback générique : basé sur la cible + la description ──────────────
  const targetEnemy = skill.target === 'enemy' ? e1 : null;
  const steps: DemoStep[] = [
    { log: `Le tour de ${heroName} commence.`, units: { ...u, hero: { ...u.hero, active: true } }, ms: 1500 },
    { log: `${heroName} utilise ${skill.name}.`, units: { ...u, hero: { ...u.hero, active: true, effect: '✨' } }, ms: 1500 },
  ];
  if (skill.description) {
    steps.push({
      log: skill.description,
      units: {
        hero: { ...u.hero, active: true, effect: '✨' },
        e1: targetEnemy ? { ...u.e1, active: true, effect: '💥', hp: 6 } : u.e1,
        e2: u.e2,
      },
      ms: 2100,
    });
  }
  steps.push({
    log: `Fin du tour de ${heroName}.`,
    units: { ...u, e1: targetEnemy ? { ...u.e1, hp: 6 } : u.e1 },
    ms: 1500,
  });
  return steps;
}

type Props = {
  member: PartyMember;
  skill: Skill;
};

/**
 * Démo animée d'une compétence : scène (personnage + 2 ennemis) + journal
 * synchronisé, rejouée en boucle.
 */
export default function SkillDemo({ member, skill }: Props) {
  const steps = useMemo(() => getSkillDemoScript(skill, member.name), [skill, member.name]);
  const [stepIndex, setStepIndex] = useState(0);
  const journalRef = useRef<HTMLDivElement>(null);

  // Avance les étapes en boucle.
  useEffect(() => {
    const step = steps[stepIndex];
    const timer = setTimeout(() => {
      setStepIndex((i) => (i + 1) % steps.length);
    }, step?.ms ?? 1600);
    return () => clearTimeout(timer);
  }, [stepIndex, steps]);

  // Remet la démo à zéro quand on change de compétence.
  useEffect(() => {
    setStepIndex(0);
  }, [skill.name]);

  // Auto-scroll du journal sur l'étape courante.
  useEffect(() => {
    const el = journalRef.current?.querySelector('.skill-demo-log-current');
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [stepIndex]);

  const step = steps[stepIndex];
  const heroToken = member.avatar ? `/assets/tokens/${encodeURIComponent(member.avatar)}` : classTokenUrl(member.job);

  const renderUnit = (key: UnitKey) => {
    const s = step.units[key];
    const isHero = key === 'hero';
    const name = isHero ? member.name : ENEMY_NAMES[key === 'e1' ? 0 : 1];
    const token = isHero ? heroToken : monsterTokenUrl(name);
    const hpPct = Math.max(0, Math.round((s.hp / s.maxHp) * 100));
    return (
      <div
        key={key}
        className={`skill-demo-unit ${isHero ? 'hero' : 'enemy'}${s.active ? ' active' : ''}${s.dead ? ' dead' : ''}`}
        style={{ left: `${(s.col + 0.5) * 25}%`, top: `${(s.row + 0.5) * 25}%` }}
      >
        {s.effect && <span className="skill-demo-fx" aria-hidden>{s.effect}</span>}
        <img className="skill-demo-token" src={token} alt={name} />
        <span className="skill-demo-name">{name}</span>
        <div className="skill-demo-hpbar">
          <div className={`skill-demo-hpfill ${isHero ? 'hp' : 'enemy'}`} style={{ width: `${hpPct}%` }} />
        </div>
      </div>
    );
  };

  return (
    <div className="skill-demo">
      <div className="skill-demo-scene" aria-label={`Démo de ${skill.name}`}>
        {(['hero', 'e1', 'e2'] as UnitKey[]).map(renderUnit)}
      </div>
      <div className="skill-demo-journal" ref={journalRef}>
        {steps.map((st, i) => (
          <div
            key={i}
            className={`skill-demo-log ${i === stepIndex ? 'skill-demo-log-current' : ''} ${i < stepIndex ? 'skill-demo-log-past' : ''}`}
          >
            {st.log}
          </div>
        ))}
      </div>
    </div>
  );
}
