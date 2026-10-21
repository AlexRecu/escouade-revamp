// src/services/Battle/CombatSessionService.ts
import { BattleManager } from "../../classes/Combat/BattleManager";
import { CombatState, GRID_SIZE } from "../../classes/Combat/CombatState";
import { Unit } from "../../classes/UnitTypes/Unit";
import { Character } from "../../classes/UnitTypes/Character";
import { Monster } from "../../classes/UnitTypes/Monster";
import { Encounter } from "../../classes/Exploration/Encounter";
import { Party } from "../../classes/Exploration/Party";
import { Position } from "../../classes/Types";
import { LootEngine } from "../../classes/Progression/LootEngine";
import {
  ExplorationSessionService,
  DungeonSession,
} from "../dungeon/ExplorationSessionService";

/**
 * Vue sérialisée d'une unité pour le front (plateau de combat).
 */
export interface CombatUnitView {
  id: string;
  name: string;
  type: "Hero" | "Enemy";
  position: Position;
  currentHp: number;
  maxHp: number;
  isDead: boolean;
  isReplaced: boolean;
  status: { name: string; statusType?: "boon" | "curse"; nbTurnEffect: number | null }[];
  /** Héros : id du joueur qui contrôle l'unité. */
  ownerId?: string | null;
  /** Héros : nom de la classe. */
  jobName?: string;
  /** Héros : mana / AP. */
  currentMp?: number;
  maxMp?: number;
  currentAp?: number;
  maxAp?: number;
  /** Ennemi : rang (≈ vitesse). */
  rank?: number;
}

/** Cibles valides d'une action (ids d'unités). */
export interface ActionTargetView {
  validTargets: string[];
}

/** Sort utilisable par l'unité courante. */
export interface SpellView {
  name: string;
  mpCost: number | null;
  target: "ally" | "self" | "enemy";
  description: string;
  validTargets: string[];
}

/** Compétence utilisable par l'unité courante. */
export interface SkillView {
  name: string;
  apCost: number;
  target: "ally" | "self" | "enemy";
  type: "single" | "multi";
  description: string;
  validTargets: string[];
}

/** Objet utilisable par l'unité courante. */
export interface ItemView {
  id: string;
  name: string;
  target: "ally" | "self" | "enemy";
  validTargets: string[];
}

/** Ensemble des actions disponibles pour l'unité courante. */
export interface ActionsView {
  canMove: boolean;
  moveRange: number;
  attack: ActionTargetView;
  spells: SpellView[];
  skills: SkillView[];
  items: ItemView[];
  canFlee: boolean;
}

/** Entrée de la file d'ordre des actions (pour l'affichage au-dessus du plateau). */
export interface ActionOrderEntry {
  id: string;
  name: string;
  type: "Hero" | "Enemy";
  /** Vitesse (Dextérité du héros / rang du monstre). */
  speed: number;
  /** true si l'unité a déjà agi ce tour (grisé dans la file). */
  acted: boolean;
}

/** État complet du combat pour le front. */
export interface CombatStateView {
  units: CombatUnitView[];
  gridSize: number;
  turn: number;
  result: "victory" | "defeat" | "fled" | "ongoing";
  /** Id de l'unité dont c'est le tour (héros contrôlé par le joueur), ou null. */
  currentUnitId: string | null;
  /** Actions disponibles pour l'unité courante (null si pas de tour joueur). */
  actions: ActionsView | null;
  /** File d'ordre des actions du tour courant (héros + ennemis, par vitesse). */
  actionOrder: ActionOrderEntry[];
  /** true si le combat est en phase de placement (le joueur doit positionner
   *  ses héros sur les 2 lignes du bas avant de valider). */
  placement: boolean;
  /** Journal du combat (dernières entrées). */
  log: string[];
  /** Métadonnées de la dernière action exécutée (pour l'animation front :
   *  potion, sort, compétence, attaque de zone). `seq` croît à chaque action
   *  pour que le front détecte un changement même si deux actions identiques
   *  se suivent. */
  lastAction: {
    actorId: string;
    targetId: string | null;
    targetIds: string[];
    kind: "attack" | "spell" | "skill" | "item" | "combo";
    name?: string;
    seq: number;
  } | null;
}

/** Session de combat en mémoire. */
interface CombatSession {
  battle: BattleManager;
  sessionKey: string;
  exploration: DungeonSession;
  /** Le héros courant a-t-il déjà bougé ce tour ? */
  hasMoved: boolean;
  /** Le héros courant a-t-il déjà agi ce tour ? */
  hasActed: boolean;
  /** Phase de placement initial : tant que false, le joueur peut repositionner
   *  ses héros sur les 2 lignes du bas avant le début du combat. */
  placementDone: boolean;
  /** Montées de niveau **reportées** (stat à choisir par le joueur) — remplies
   *  par `applyEnd` en cas de victoire avec montée, consommées par
   *  `submitStatChoices`. Une entrée = une montée = un +1 stat à choisir. */
  pendingLevelUps?: { characterId: string; name: string; level: number }[];
}

/** Montée de niveau reportée, vue pour le front (écran de choix de stat). */
export interface PendingLevelUpView {
  characterId: string;
  name: string;
  level: number;
}

/**
 * Gère une **session de combat interactive** (temps réel, pilotée par le
 * joueur) liée à une session d'exploration.
 *
 * Contrairement à `CombatService.runCombat` (mode automatique, IA vs IA), ce
 * service pilote le combat **acteur par acteur** : les ennemis sont exécutés
 * par l'IA, les héros attendent l'input du joueur (déplacement + action).
 *
 * Cycle de vie :
 *  1. `startCombat` : une rencontre se déclenche → on construit le plateau
 *     (équipe en bas, ennemis en haut) et on avance jusqu'au 1er héros.
 *  2. `move` / `act` / `endTurn` / `flee` : le joueur pilote son héros.
 *  3. Quand le combat est terminé, `applyEnd` distribue le butin (victoire) ou
 *     gère la défaite, persiste l'équipe et retourne l'état d'exploration.
 */
export class CombatSessionService {
  private static sessions: Map<string, CombatSession> = new Map();

  /** La session de combat est-elle active pour cette clé ? */
  static isActive(sessionKey: string): boolean {
    return this.sessions.has(sessionKey);
  }

  /**
   * Démarre un combat à partir d'une rencontre.
   *
   * Place l'équipe en bas du plateau (lignes 6-7) et les ennemis en haut
   * (lignes 0-3, aléatoire). Le combat **ne démarre pas** immédiatement :
   * on entre en **phase de placement** où le joueur peut repositionner ses
   * héros sur les 2 lignes du bas. Quand il valide (`confirmPlacement`), le
   * combat avance jusqu'au premier héros.
   *
   * @returns l'état sérialisé du combat (en phase de placement).
   */
  static startCombat(
    sessionKey: string,
    exploration: DungeonSession,
    encounter: Encounter
  ): CombatStateView {
    // On nettoie une éventuelle session précédente. S'il restait des montées
    // de niveau **reportées** (stat non choisie, ex. le joueur a enchaîné une
    // nouvelle rencontre sans passer par l'écran de choix), on les applique
    // avec une stat par défaut (Force) pour ne pas perdre le bonus.
    const prev = this.sessions.get(sessionKey);
    if (prev?.pendingLevelUps?.length) {
      prev.pendingLevelUps.forEach((p) => {
        const c = exploration.party.members.find((m) => m.id === p.characterId);
        if (c) LootEngine.applyPendingStat(c, "strength");
      });
    }
    this.sessions.delete(sessionKey);

    const units: Unit[] = [];

    // Héros vivants en bas du plateau (lignes 6-7).
    const aliveHeroes = exploration.party.getAliveMembers();
    aliveHeroes.forEach((hero, i) => {
      hero.position = { row: 6 + Math.floor(i / 4), col: i % 4 };
      // Chaque combat démarre avec l'AP **pleine** (le livret : 10 AP au
      // départ). L'AP n'est pas portée d'un combat à l'autre.
      if (hero instanceof Character) hero.currentAp = hero.maxAp;
      units.push(hero);
    });

    // Ennemis en haut du plateau (lignes 0-3), répartis aléatoirement.
    encounter.enemies.forEach((monster, i) => {
      monster.position = {
        row: Math.floor(Math.random() * 4), // rows 0-3
        col: (i * 2 + Math.floor(Math.random() * 2)) % GRID_SIZE,
      };
      units.push(monster);
    });

    const battle = new BattleManager(units);
    // Pas de stepToPlayer ici : on attend la validation du placement.

    const session: CombatSession = {
      battle,
      sessionKey,
      exploration,
      hasMoved: false,
      hasActed: false,
      placementDone: false,
    };
    this.sessions.set(sessionKey, session);

    return this.serialize(battle, session);
  }

  /**
   * Repositionne un héros pendant la phase de placement (lignes 6-7 uniquement,
   * case libre).
   * @returns l'état sérialisé du combat.
   */
  static placeHero(sessionKey: string, unitId: string, position: Position): CombatStateView {
    const session = this.require(sessionKey);
    if (session.placementDone) throw new Error("Le placement est déjà terminé.");
    const { battle } = session;
    const unit = battle.combatState.units.find((u) => u.id === unitId);
    if (!unit || unit.type !== "Hero") throw new Error("Unité invalide.");
    // Limité aux 2 lignes du bas (rows 6-7).
    if (position.row < GRID_SIZE - 2 || position.row >= GRID_SIZE) {
      throw new Error("Vous ne pouvez vous placer que sur les deux dernières lignes.");
    }
    if (position.col < 0 || position.col >= GRID_SIZE) {
      throw new Error("Position hors du plateau.");
    }
    const occupant = battle.combatState.units.find(
      (u) => u !== unit && u.position.row === position.row && u.position.col === position.col
    );
    if (occupant) throw new Error(`La case est occupée par ${occupant.name}.`);
    unit.position = { ...position };
    return this.serialize(battle, session);
  }

  /**
   * Valide le placement et démarre réellement le combat (avance les IA jusqu'au
   * premier héros).
   * @returns l'état sérialisé du combat.
   */
  static confirmPlacement(sessionKey: string): CombatStateView {
    const session = this.require(sessionKey);
    if (session.placementDone) return this.serialize(session.battle, session);
    session.placementDone = true;
    // On avance jusqu'au premier acteur « interactif » (héros → tour joueur,
    // ennemi → le front le pilotera via `aiStep`, un tour à la fois).
    session.battle.advanceAfterPlayerTurn();
    return this.serialize(session.battle, session);
  }

  /**
   * Déplace le héros courant d'une case (une fois par tour).
   * @returns l'état sérialisé du combat.
   */
  static move(sessionKey: string, unitId: string, position: Position): CombatStateView {
    const session = this.requireStarted(sessionKey);
    const { battle } = session;
    const unit = battle.combatState.units.find((u) => u.id === unitId);
    if (!unit || unit.type !== "Hero") throw new Error("Unité invalide.");
    if (session.hasMoved || session.hasActed) {
      throw new Error("Vous avez déjà agi ce tour.");
    }
    // Distance max = portée de déplacement (1 case par défaut).
    // Distance de Chebyshev (le déplacement en diagonale compte pour 1 case,
    // comme le montre le front).
    const range = unit.getMovementRange();
    const dist = Math.max(
      Math.abs(position.row - unit.position.row),
      Math.abs(position.col - unit.position.col)
    );
    if (dist > range) throw new Error("Trop loin : vous ne pouvez vous déplacer que d'une case.");

    const msg = battle.playerMove(unitId, position);
    if (msg.includes("occupée") || msg.includes("hors du plateau") || msg.includes("KO")) {
      throw new Error(msg);
    }
    session.hasMoved = true;
    return this.serialize(battle, session);
  }

  /**
   * Exécute l'action du héros courant, termine son tour, puis avance le combat.
   * @returns l'état sérialisé du combat.
   */
  static act(
    sessionKey: string,
    unitId: string,
    action: "attack" | "spell" | "skill" | "item" | "combo",
    targetId: string | null,
    extra: { spell?: { name: string }; skill?: { name: string }; item?: any; combo?: string[] } = {}
  ): CombatStateView {
    const session = this.requireStarted(sessionKey);
    const { battle } = session;
    if (session.hasActed) throw new Error("Vous avez déjà agi ce tour.");

    // Résout l'objet en **instance** depuis le sac de l'unité. Le front envoie
    // `extra.item` comme objet sérialisé `{ id, name }` (pas une instance) :
    // on le retrouve par son id dans le sac pour que `useItem` (qui teste
    // `instanceof Consumable`) fonctionne. `targetId` est l'id de la **cible**,
    // pas celui de l'objet.
    if (action === "item") {
      const unit = battle.combatState.units.find((u) => u.id === unitId);
      const itemId = extra.item?.id ?? targetId;
      const item = unit?.bag.find((it) => it.id === itemId);
      if (item) extra.item = item;
    }

    battle.playerAct(unitId, action, targetId, extra);
    // Le tour a avancé (stepToPlayer) → on réinitialise les flags pour le
    // prochain héros (sinon il ne pourrait plus agir/déplacer).
    session.hasMoved = false;
    session.hasActed = false;
    return this.serialize(battle, session);
  }

  /**
   * Termine le tour du héros courant sans agir (déplacement uniquement).
   * @returns l'état sérialisé du combat.
   */
  static endTurn(sessionKey: string, unitId: string): CombatStateView {
    const session = this.requireStarted(sessionKey);
    const { battle } = session;
    if (session.hasActed) throw new Error("Vous avez déjà agi ce tour.");
    battle.playerEndTurn(unitId);
    // Le tour a avancé (stepToPlayer) → on réinitialise les flags pour le
    // prochain héros (sinon il ne pourrait plus agir/déplacer).
    session.hasMoved = false;
    session.hasActed = false;
    return this.serialize(battle, session);
  }

  /**
   * Exécute **un seul** tour d'acteur piloté par l'IA (ennemi / invocation),
   * puis renvoie l'état. Le front appelle cette méthode en boucle (avec un
   * délai pour l'animation) tant que l'acteur courant est un ennemi ; dès que
   * c'est un héros, il s'arrête et rend la main au joueur. C'est ce qui permet
   * de voir les ennemis agir **un par un** au lieu de tout en même temps.
   *
   * @returns l'état sérialisé du combat.
   */
  static aiStep(sessionKey: string): CombatStateView {
    const session = this.requireStarted(sessionKey);
    const { battle } = session;
    battle.stepOneAiTurn();
    return this.serialize(battle, session);
  }

  /**
   * Tente la fuite (décision commune de l'escouade).
   * @returns l'état sérialisé du combat.
   */
  static flee(sessionKey: string): CombatStateView {
    const session = this.require(sessionKey);
    const { battle } = session;
    battle.attemptFlee();
    return this.serialize(battle, session);
  }

  /**
   * Renvoie l'état sérialisé du combat courant.
   */
  static getState(sessionKey: string): CombatStateView {
    const session = this.require(sessionKey);
    return this.serialize(session.battle, session);
  }

  /**
   * Applique la fin du combat (butin / défaite), persiste l'équipe et supprime
   * la session de combat.
   *
   * @returns l'état d'exploration mis à jour (pour que le front reprenne le
   *          déplacement) + les logs de fin.
   */
  static async applyEnd(sessionKey: string): Promise<{ state: any; logs: string[]; exited?: boolean; pendingLevelUps?: PendingLevelUpView[] }> {
    const session = this.sessions.get(sessionKey);
    if (!session) throw new Error("Aucun combat en cours.");
    const { battle, exploration } = session;
    const result = battle.result;
    const logs: string[] = [];
    let exited = false;
    let pendingLevelUps: PendingLevelUpView[] | undefined;

    if (result === "victory") {
      // Butin : gold + XP partagés entre les survivants. Le choix de la stat
      // de montée de niveau est **reporté** (deferStats) : le front affiche un
      // écran de choix après le combat, puis `submitStatChoices` applique.
      const survivors = battle.combatState.aliveHeroes.filter(
        (u) => u instanceof Character
      ) as Character[];
      const defeated = battle.combatState.enemies.filter(
        (u) => u instanceof Monster && u.isDead()
      ) as Monster[];
      const loot = LootEngine.distributeLoot(survivors, defeated, () => "strength", "easy", true);
      logs.push(...loot.logs);
      logs.push("🏆 Victoire !");
      // Marque les monstres comme vus (bestiaire).
      defeated.forEach((m) => exploration.party.markMonsterSeen(m.name));
      // Montées reportées (stat = null) → à choisir par le joueur.
      const pending = loot.levelUps.filter((lu) => lu.stat === null);
      if (pending.length > 0) {
        pendingLevelUps = pending.map((lu) => ({
          characterId: lu.character.id,
          name: lu.character.name,
          level: lu.character.characterLevel,
        }));
        // On **conserve** la session : `submitStatChoices` appliquera les
        // stats choisies. (Le front a un délai de sécurité : sans réponse,
        // les stats sont appliquées par défaut.)
        session.pendingLevelUps = pendingLevelUps;
      }
    } else if (result === "defeat") {
      // Défaite : l'équipe est ramenée à la **première ville du donjon** (le
      // hub d'où l'on est entré), morts ressuscités à 1 PV. On quitte le
      // donjon (exited) pour que le front revienne à la mappemonde.
      exploration.party.members.forEach((m) => {
        if (m.isDead()) m.currentHp = 1;
      });
      exploration.currentNodeId = exploration.hubId ?? "";
      exploration.activeCampfire = undefined;
      exploration.activeChest = undefined;
      logs.push("💀 Défaite… L'équipe est ramenée à la dernière ville.");
      exited = true;
    } else if (result === "fled") {
      logs.push("💨 L'équipe s'est échappée du combat.");
    }

    // Persiste l'équipe (PV, or, XP mis à jour). En cas de défaite, la
    // position est le hub d'origine (sortie du donjon).
    await ExplorationSessionService.persistForCombat(exploration);

    // On supprime la session **sauf** s'il reste des stats à choisir.
    if (!pendingLevelUps) this.sessions.delete(sessionKey);
    if (exited) ExplorationSessionService.deleteSession(sessionKey);
    return { state: ExplorationSessionService.serializeForCombat(exploration), logs, exited, pendingLevelUps };
  }

  /**
   * Applique les stats choisies par le joueur pour les montées de niveau
   * reportées (voir `applyEnd`). Appelé par le front après l'écran de choix.
   *
   * @param choices Tableau de `{ characterId, stat }` (un par montée reportée).
   * @returns l'état d'exploration mis à jour + les logs.
   */
  static async submitStatChoices(sessionKey: string, choices: { characterId: string; stat: keyof import("../../classes/Types").Statistics }[]): Promise<{ state: any; logs: string[] }> {
    const session = this.sessions.get(sessionKey);
    if (!session) throw new Error("Aucun combat en cours.");
    const { exploration } = session;
    const pending = session.pendingLevelUps ?? [];
    const logs: string[] = [];
    // Un personnage peut avoir monté **plusieurs** fois (plusieurs entrées au
    // même characterId) : on consomme les entrées une à une pour ne pas
    // appliquer deux fois la même montée.
    const consumed = new Set<number>();

    choices.forEach((choice) => {
      const idx = pending.findIndex((p, i) => p.characterId === choice.characterId && !consumed.has(i));
      if (idx === -1) return;
      consumed.add(idx);
      const character = exploration.party.members.find((m) => m.id === choice.characterId);
      if (!character) return;
      LootEngine.applyPendingStat(character, choice.stat);
      logs.push(`${character.name} gagne +1 ${choice.stat} (niveau ${character.characterLevel}).`);
    });

    await ExplorationSessionService.persistForCombat(exploration);
    this.sessions.delete(sessionKey);
    return { state: ExplorationSessionService.serializeForCombat(exploration), logs };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private static require(sessionKey: string): CombatSession {
    const session = this.sessions.get(sessionKey);
    if (!session) throw new Error("Aucun combat en cours.");
    return session;
  }

  /**
   * Renvoie la session **une fois le placement validé** (le combat a démarré).
   * Refuse les actions de combat pendant la phase de placement.
   */
  private static requireStarted(sessionKey: string): CombatSession {
    const session = this.require(sessionKey);
    if (!session.placementDone) {
      throw new Error("Validez d'abord le placement de l'équipe.");
    }
    return session;
  }

  /** Sérialise l'état du combat pour le front. */
  private static serialize(battle: BattleManager, session: CombatSession): CombatStateView {
    const state: CombatState = battle.combatState;
    const units = state.units.map((u) => this.serializeUnit(u));
    const currentUnit = state.currentActor;
    // Pas de tour joueur pendant la phase de placement (le combat n'a pas
    // encore démarré).
    const isPlayerTurn =
      session.placementDone &&
      currentUnit !== null &&
      currentUnit.type === "Hero" &&
      !state.isOver;

    // File d'ordre des actions du tour courant (unités vivantes, par vitesse).
    // Les unités déjà passées (index < actionIndex) sont marquées "acted".
    const actionOrder: ActionOrderEntry[] = state.actionOrder
      .filter((u) => !u.isDead() && !u.isReplaced)
      .map((u, i) => ({
        id: u.id,
        name: u.name,
        type: u.type,
        speed: state.getSpeed(u),
        acted: i < state.actionIndex,
      }));

    return {
      units,
      gridSize: GRID_SIZE,
      turn: state.turn,
      result: state.result,
      currentUnitId: isPlayerTurn ? currentUnit!.id : null,
      actions: isPlayerTurn
        ? this.getAvailableActions(currentUnit!, state.units, session)
        : null,
      actionOrder,
      placement: !session.placementDone,
      log: state.log.slice(-40),
      lastAction: state.lastAction
        ? {
            actorId: state.lastAction.actorId,
            targetId: state.lastAction.targetId,
            targetIds: state.lastAction.targetIds,
            kind: state.lastAction.kind,
            name: state.lastAction.name,
            seq: state.lastAction.seq,
          }
        : null,
    };
  }

  /** Sérialise une unité pour le plateau. */
  private static serializeUnit(u: Unit): CombatUnitView {
    const view: CombatUnitView = {
      id: u.id,
      name: u.name,
      type: u.type,
      position: { ...u.position },
      currentHp: u.currentHp,
      maxHp: u.maxHp,
      isDead: u.isDead(),
      isReplaced: u.isReplaced,
      status: u.status.map((s) => ({
        name: s.name,
        statusType: s.statusType,
        nbTurnEffect: s.nbTurnEffect,
      })),
    };
    if (u instanceof Character) {
      view.ownerId = u.ownerId;
      view.jobName = u.job.name;
      view.currentMp = u.currentMp;
      view.maxMp = u.maxMp;
      view.currentAp = u.currentAp;
      view.maxAp = u.maxAp;
    }
    if (u instanceof Monster) {
      view.rank = u.rank;
    }
    return view;
  }

  /** Calcule les actions disponibles pour l'unité courante (ciblage inclus). */
  private static getAvailableActions(
    unit: Unit,
    allUnits: Unit[],
    session: CombatSession
  ): ActionsView {
    const alive = allUnits.filter((u) => !u.isDead() && !u.isReplaced);

    // Attaque : ennemis adjacents (portée 1).
    const attackTargets = alive
      .filter(
        (u) =>
          u.type === "Enemy" &&
          Math.max(
            Math.abs(u.position.row - unit.position.row),
            Math.abs(u.position.col - unit.position.col)
          ) <= 1
      )
      .map((u) => u.id);

    let spells: SpellView[] = [];
    let skills: SkillView[] = [];
    let items: ItemView[] = [];

    if (unit instanceof Character) {
      // Sorts : portée illimitée (le type Spell ne porte pas de range).
      spells = unit.getAvailableSpells().map((s) => ({
        name: s.name,
        mpCost: s.mpCost,
        target: s.target,
        description: s.description,
        validTargets: this.targetsByType(unit, s.target, alive),
      }));

      // Compétences : portée selon le range du skill.
      skills = unit.getAvailableAbilities().map((sk) => ({
        name: sk.name,
        apCost: sk.apCost,
        target: sk.target,
        type: sk.type,
        description: sk.description,
        validTargets: this.skillTargets(unit, sk, allUnits),
      }));

      // Objets : consommables (soin → allié/soi, outil → ennemi).
      items = unit.bag
        .filter((it) => it.type === "consumable")
        .map((it) => ({
          id: it.id,
          name: it.name,
          target: "ally" as const,
          validTargets: this.targetsByType(unit, "ally", alive),
        }));
    }

    return {
      canMove: !session.hasMoved && !session.hasActed,
      moveRange: unit.getMovementRange(),
      attack: { validTargets: attackTargets },
      spells,
      skills,
      items,
      canFlee: true,
    };
  }

  /** Cibles valides selon le type de cible (ally / self / enemy), portée illimitée. */
  private static targetsByType(
    unit: Unit,
    target: "ally" | "self" | "enemy",
    alive: Unit[]
  ): string[] {
    if (target === "self") return [unit.id];
    if (target === "ally") {
      return alive.filter((u) => u.type === "Hero").map((u) => u.id);
    }
    return alive.filter((u) => u.type === "Enemy").map((u) => u.id);
  }

  /**
   * Cibles valides d'une compétence (portée selon `range` + `move`, type de
   * cible selon `target`). Reprend la logique de `getValidTargets` sans exiger
   * le champ `formula` (absent de `Omit<Skill, "formula">`).
   */
  private static skillTargets(
    unit: Unit,
    skill: { target: "ally" | "self" | "enemy"; range: number; move: number; type: "single" | "multi" },
    allUnits: Unit[]
  ): string[] {
    const move = skill.move ?? 0;
    const valid = allUnits.filter((u) => {
      if (u.isReplaced || u.isDead()) return false;
      const distance = Math.max(
        Math.abs(u.position.row - unit.position.row),
        Math.abs(u.position.col - unit.position.col)
      );
      if (skill.range > 0 && distance > skill.range + move) return false;
      if (skill.target === "self") return u === unit;
      if (skill.target === "ally") return u.type === "Hero" || u === unit;
      if (skill.target === "enemy") return u.type === "Enemy";
      return false;
    });
    if (skill.type === "single" && valid.length > 0) return [valid[0].id];
    return valid.map((u) => u.id);
  }
}
