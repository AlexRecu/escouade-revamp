// src/services/Battle/CombatSessionService.ts
import { BattleManager } from "../../classes/Combat/BattleManager";
import { CombatState, GRID_SIZE } from "../../classes/Combat/CombatState";
import { Unit } from "../../classes/UnitTypes/Unit";
import { Character } from "../../classes/UnitTypes/Character";
import { Monster } from "../../classes/UnitTypes/Monster";
import { Demon } from "../../classes/UnitTypes/Demon";
import { Encounter } from "../../classes/Exploration/Encounter";
import { Party } from "../../classes/Exploration/Party";
import { Position } from "../../classes/Types";
import { LootEngine } from "../../classes/Progression/LootEngine";
import { QuestService } from "../Progression/QuestService";
import { BlackMage } from "../../classes/Jobs/BlackMage";
import {
  ExplorationSessionService,
  DungeonSession,
} from "../dungeon/ExplorationSessionService";
import { PartyRoomService } from "../Hub/PartyRoomService";
import { WorldService } from "../World/WorldService";

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
  /** Ennemi : nature de l'attaque ("Physique" corps-à-corps / "Magique" à distance). */
  attackType?: "Physique" | "Magique";
}

/**
 * Récapitulatif de **défaite / game over** (équipe anéantie).
 * Affiché au front : le dernier héros tombé (sprite vaincu) + l'ennemi qui
 * l'a tué (sprite) + le log du dernier tour de combat.
 *
 * - **hard** : game over définitif (partie supprimée, retour au lobby).
 * - **easy** : « Vous avez péri » — l'équipe est ramenée en ville, le joueur
 *   paie le sanctuaire pour ranimer les morts restants.
 */
export interface GameOverRecap {
  /** "hard" = game over définitif ; "easy" = wipe survivable (retour en ville). */
  mode: "easy" | "hard";
  /** Nom du dernier héros tombé. */
  heroName: string;
  /** Classe du dernier héros (pour le sprite vaincu). */
  heroJob: string;
  /** Nom de l'ennemi qui l'a tué (pour son sprite). */
  killerName: string;
  /** Log du dernier tour de combat (les dernières entrées du journal). */
  lastTurnLog: string[];
  /** Nom de la ville de retour (mode easy). */
  hubName?: string;
  /** Coût max pour ranimer l'équipe au sanctuaire (200 or × morts restants). */
  reviveCost?: number;
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
  /** Budget de déplacement **restant** ce tour (cases). Le héros peut faire
   *  tout ce déplacement d'un coup (Chebyshev ≤ moveRange) ou le splitter. */
  moveRange: number;
  /** Le héros peut-il encore agir ce tour ? (false après une action.) */
  canAct: boolean;
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
  /**
   * **Budget de déplacement** restant ce tour (nombre de cases). Le héros peut
   * se déplacer de 1 case par clic, avant ET/OU après son action, tant que le
   * budget n'est pas épuisé. Réinitialisé à `getMovementRange()` à chaque tour
   * de héros (1 par défaut, 2 pour le Voleur, Dextérité pour le Moine Maître).
   */
  moveBudget: number;
  /** Id de l'unité à qui `moveBudget` s'applique (pour réinitialiser au changement de tour). */
  moveBudgetFor?: string;
  /** Le héros courant a-t-il déjà agi ce tour ? (1 action par tour.) */
  hasActed: boolean;
  /**
   * Clé du tour courant (`turn:actionIndex`) pour détecter un **nouveau tour**
   * et réinitialiser le budget de déplacement / le flag d'action du héros.
   */
  turnKey?: string;
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
      moveBudget: 0,
      hasActed: false,
      placementDone: false,
    };
    this.sessions.set(sessionKey, session);

    return this.serialize(battle, session);
  }

  /**
   * Démarre un **combat de démon de zone** (Phase B) : l'équipe en bas, le
   * démon seul en haut. Même mécanique que `startCombat` (placement, tour par
   * tour) mais l'ennemi est un `Demon` (pas de PV : il s'épuise en perdant de
   * l'endurance, cf. `Demon.isDead`).
   *
   * @param demonName nom exact du démon (cf. `demons_data.json`).
   * @returns l'état sérialisé du combat (en phase de placement).
   */
  static startDemonCombat(
    sessionKey: string,
    exploration: DungeonSession,
    demonName: string
  ): CombatStateView {
    // On nettoie une éventuelle session précédente (montées reportées → stat
    // par défaut, comme dans `startCombat`).
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
      if (hero instanceof Character) hero.currentAp = hero.maxAp;
      units.push(hero);
    });

    // Le démon seul, en haut du plateau (ligne 1, centré).
    const demon = new Demon(demonName, "Enemy", { row: 1, col: 3 });
    units.push(demon);

    const battle = new BattleManager(units);

    const session: CombatSession = {
      battle,
      sessionKey,
      exploration,
      moveBudget: 0,
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
    // Réinitialise le budget de déplacement / le flag d'action du héros courant.
    this.syncTurnState(session);
    return this.serialize(session.battle, session);
  }

  /**
   * Déplace le héros courant de **jusqu'à `moveBudget` cases** (Chebyshev). Le
   * héros peut faire tout son déplacement d'un coup (ex. le Voleur : 2 cases)
   * ou le **splitter** en plusieurs déplacements (1 avant + 1 après l'action).
   * Le budget est décrémenté de la distance parcourue.
   * @returns l'état sérialisé du combat.
   */
  static move(sessionKey: string, unitId: string, position: Position): CombatStateView {
    const session = this.requireStarted(sessionKey);
    this.syncTurnState(session);
    const { battle } = session;
    const unit = battle.combatState.units.find((u) => u.id === unitId);
    if (!unit || unit.type !== "Hero") throw new Error("Unité invalide.");
    if (session.moveBudgetFor !== unit.id) throw new Error("Ce n'est pas le tour de ce héros.");
    if (session.moveBudget <= 0) {
      throw new Error("Vous avez déjà utilisé tout votre déplacement ce tour.");
    }
    // Distance de Chebyshev (la diagonale compte pour 1 case) : on autorise
    // jusqu'au budget restant d'un coup, ou moins (split).
    const dist = Math.max(
      Math.abs(position.row - unit.position.row),
      Math.abs(position.col - unit.position.col)
    );
    if (dist < 1) throw new Error("Vous ne pouvez pas vous déplacer sur votre case.");
    if (dist > session.moveBudget) {
      throw new Error(`Trop loin : il vous reste ${session.moveBudget} case(s) de déplacement ce tour.`);
    }

    const msg = battle.playerMove(unitId, position);
    if (msg.includes("occupée") || msg.includes("hors du plateau") || msg.includes("KO")) {
      throw new Error(msg);
    }
    session.moveBudget -= dist;
    // Fin de tour auto si le héros a agi ET épuisé son déplacement.
    this.maybeAutoEndTurn(session);
    return this.serialize(battle, session);
  }

  /**
   * Exécute l'action du héros courant **sans terminer son tour** (fin de tour
   * manuelle). Le héros peut encore se déplacer (budget de cases) puis cliquer
   * « Fin de tour ». Le tour se termine automatiquement seulement s'il a agi
   * ET épuisé son déplacement.
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
    this.syncTurnState(session);
    const { battle } = session;
    if (session.hasActed) throw new Error("Vous avez déjà agi ce tour.");

    // Résout l'objet en **instance** depuis le **sac commun**. Le front envoie
    // `extra.item` comme objet sérialisé `{ id, name }` (pas une instance) :
    // on le retrouve par son id dans le sac pour que `useItem` (qui teste
    // `instanceof Consumable`) fonctionne. `targetId` est l'id de la **cible**,
    // pas celui de l'objet. Les objets sont dans `party.bag` (les sacs
    // individuels sont vidés par `migrateMemberBags`).
    if (action === "item") {
      const itemId = extra.item?.id ?? targetId;
      const item = session.exploration.party.bag.find((it) => it.id === itemId);
      if (item) extra.item = item;
    }

    // **Fin de tour manuelle** : l'action ne termine plus le tour (le héros
    // peut encore se déplacer). La fin de combat est quand même détectée
    // (`performAction` appelle `checkEnd`).
    battle.playerActNoEnd(unitId, action, targetId, extra);
    session.hasActed = true;
    // L'objet consommé est retiré du **sac commun** : `Character.consumeItem`
    // opère sur le sac individuel (vide ici). Le front ne permet de cibler que
    // des cibles valides → l'objet est bien consommé.
    if (action === "item" && extra.item?.id) {
      const idx = session.exploration.party.bag.findIndex((it) => it.id === extra.item.id);
      if (idx !== -1) session.exploration.party.bag.splice(idx, 1);
    }
    // Fin de tour auto si le héros a agi ET épuisé son déplacement.
    this.maybeAutoEndTurn(session);
    return this.serialize(battle, session);
  }

  /**
   * Termine le tour du héros courant (fin de tour manuelle), puis avance le
   * combat vers le prochain acteur.
   * @returns l'état sérialisé du combat.
   */
  static endTurn(sessionKey: string, unitId: string): CombatStateView {
    const session = this.requireStarted(sessionKey);
    this.syncTurnState(session);
    const { battle } = session;
    battle.playerEndTurn(unitId);
    // Le tour a avancé → réinitialise l'état du prochain héros (s'il y en a un).
    this.syncTurnState(session);
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
    // Un tour de héros peut avoir démarré → réinitialise son budget de
    // déplacement / son flag d'action.
    this.syncTurnState(session);
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
  static async applyEnd(sessionKey: string): Promise<{ state: any; logs: string[]; exited?: boolean; pendingLevelUps?: PendingLevelUpView[]; gameOver?: GameOverRecap }> {
    const session = this.sessions.get(sessionKey);
    if (!session) throw new Error("Aucun combat en cours.");
    const { battle, exploration } = session;
    const result = battle.result;
    const logs: string[] = [];
    let exited = false;
    let pendingLevelUps: PendingLevelUpView[] | undefined;
    let gameOver: GameOverRecap | undefined;

    if (result === "victory") {
      // Butin : gold + XP partagés entre les survivants. Le choix de la stat
      // de montée de niveau est **reporté** (deferStats) : le front affiche un
      // écran de choix après le combat, puis `submitStatChoices` applique.
      // Un combat de **démon** n'a pas de butin or/XP (le « butin » est le
      // pacte, géré plus bas) : on ne distribue que s'il y a des monstres.
      const survivors = battle.combatState.aliveHeroes.filter(
        (u) => u instanceof Character
      ) as Character[];
      const defeated = battle.combatState.enemies.filter(
        (u) => u instanceof Monster && u.isDead()
      ) as Monster[];
      logs.push("🏆 Victoire !");
      if (defeated.length > 0) {
        const loot = LootEngine.distributeLoot(survivors, defeated, () => "strength", "easy", true);
        logs.push(...loot.logs);
        // L'or gagné est d'abord sur les personnages : on le migre dans le pot
        // commun pour que l'interface (qui affiche `party.gold`) soit à jour
        // immédiatement, sans attendre la sortie du donjon.
        exploration.party.consolidateGold();
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
      }

      // **Démon de zone vaincu** (Phase B) : le « butin » d'un démon n'est pas
      // de l'or/XP mais son **pacte**. On marque le démon vaincu (il ne se
      // re-détecte plus dans la session), on signale la quête (`defeat`), et
      // un Démoniste avec un slot libre récupère le pacte (`recruit`).
      const defeatedDemons = battle.combatState.enemies.filter(
        (u) => u instanceof Demon && u.isDead()
      ) as Demon[];
      for (const demon of defeatedDemons) {
        if (!exploration.defeatedDemonsThisZone.includes(demon.name)) {
          exploration.defeatedDemonsThisZone.push(demon.name);
        }
        logs.push(`${demon.name} est vaincu !`);
        // Quêtes : le démon est vaincu (étapes `defeat` — ex. quête 2 : Adrammelech).
        QuestService.onDefeat(exploration.questSystem, demon.name);
        // Récupération du pacte : un Démoniste avec un slot libre.
        const demonist = exploration.party.members.find(
          (c) => c.job instanceof BlackMage && c.job.name === "Démoniste"
        ) as Character | undefined;
        if (demonist) {
          const bm = demonist.job as BlackMage;
          if (bm.canRecruit()) {
            logs.push(...bm.recruitDemon(demon.name));
            // Quêtes : signale le recrutement du démon (étapes `recruit`).
            QuestService.onRecruit(exploration.questSystem, demon.name);
          } else {
            logs.push(`Aucun pacte libre : le pacte de ${demon.name} est perdu.`);
          }
        } else {
          logs.push(`Aucun Démoniste dans l'équipe : le pacte de ${demon.name} est perdu.`);
        }
      }
    } else if (result === "defeat") {
      // **Défaite (wipe)** : toute l'équipe est KO. Logique à 3 paliers :
      //  1. Or ≥ 200 × nb de morts → on déduit, on ranime **tous** à la
      //     moitié des PV max (comme le sanctuaire).
      //  2. Or ≥ 200 mais < total → on ranime autant que l'or permet
      //     (200 chacun, à la moitié des PV max), le reste reste à 0 PV
      //     (à ranimer au sanctuaire en ville).
      //  3. Or < 200 (personne ne peut être ranimé) :
      //     - **easy** : seul le dernier à mourir revient à 1 PV.
      //     - **hard** : game over → partie supprimée + écran de récap.
      const difficulty = exploration.difficulty ?? "easy";
      const dead = exploration.party.members.filter((m) => m.isDead());
      const SANCTUARY_COST = 200;
      const totalCost = dead.length * SANCTUARY_COST;
      let revived: string[] = [];

      if (exploration.party.gold >= totalCost) {
        // Cas 1 : assez d'or pour tout le monde.
        exploration.party.gold -= totalCost;
        dead.forEach((m) => {
          m.currentHp = Math.floor(m.maxHp / 2);
          revived.push(m.name);
        });
        logs.push(`💰 ${totalCost} or dépensés pour ranimer toute l'équipe.`);
      } else {
        // Cas 2 : on ranime autant que l'or permet (200 chacun).
        for (const m of dead) {
          if (exploration.party.gold >= SANCTUARY_COST) {
            exploration.party.gold -= SANCTUARY_COST;
            m.currentHp = Math.floor(m.maxHp / 2);
            revived.push(m.name);
          }
        }
        if (revived.length > 0) {
          logs.push(`💰 ${revived.length} allié(s) ranimé(s) avec l'or disponible.`);
        }
      }

      const stillDead = exploration.party.members.filter((m) => m.isDead());
      const lastDeath = battle.combatState.lastHeroDeath;
      const lastTurnLog = this.extractLastTurnLog(battle.combatState.log);
      const hub = exploration.hubId ? await WorldService.getHubById(exploration.hubId) : null;
      const hubName = hub?.name;

      if (difficulty === "hard" && stillDead.length > 0) {
        // Cas 3 + hard : **game over**. On renvoie le récap ; le socket
        // supprime la room et diffuse l'écran à tous les membres.
        gameOver = {
          mode: "hard",
          heroName: lastDeath?.heroName ?? stillDead[stillDead.length - 1].name,
          heroJob: lastDeath?.heroJob ?? "",
          killerName: lastDeath?.killerName ?? "",
          lastTurnLog,
        };
        logs.push("💀 Game over… L'équipe est anéantie.");
        // On ne sort pas du donjon normalement : le front bascule sur
        // l'écran de récap (la room sera supprimée par le socket).
        return { state: null, logs, exited: true, gameOver };
      }

      if (difficulty === "easy") {
        // **Wipe survivable** (mode facile) : à chaque défaite, on affiche
        // l'écran « Vous avez péri » (dernier héros tombé + tueur + dernier
        // tour). L'équipe est ramenée en ville ; le joueur paie le sanctuaire
        // pour les morts restants.
        const lastHero = lastDeath
          ? exploration.party.members.find((m) => m.id === lastDeath.heroId)
          : stillDead[stillDead.length - 1];
        if (stillDead.length > 0 && lastHero) {
          // Seul le dernier à mourir revient à 1 PV (les autres restent à
          // 0 PV, à ranimer au sanctuaire en ville).
          lastHero.currentHp = 1;
          logs.push(`💀 Défaite… ${lastHero.name} revient à 1 PV. L'équipe est ramenée à ${hubName ?? "la dernière ville"}.`);
        } else {
          logs.push(`💀 Défaite… L'équipe est ramenée à ${hubName ?? "la dernière ville"}.`);
        }
        // Coût **réel restant** au sanctuaire : les membres encore à 0 PV
        // (après ranimation par l'or + dernier héros revenu à 1 PV) × 200.
        // Les morts déjà ranimés par l'or (à moitié PV) ne coûtent plus rien.
        const remainingDead = exploration.party.members.filter((m) => m.isDead()).length;
        gameOver = {
          mode: "easy",
          heroName: lastDeath?.heroName ?? lastHero?.name ?? "",
          heroJob: lastDeath?.heroJob ?? "",
          killerName: lastDeath?.killerName ?? "",
          lastTurnLog,
          hubName,
          reviveCost: remainingDead * SANCTUARY_COST,
        };
      } else {
        // hard + stillDead vide : l'or a tout ranimé, pas de game over.
        logs.push("💀 Défaite… L'équipe est ramenée à la dernière ville.");
      }

      // Retour au hub d'origine (sortie du donjon) — sauf game over (retour
      // ci-dessus). Les membres restés à 0 PV seront ranimés au sanctuaire.
      exploration.currentNodeId = exploration.hubId ?? "";
      exploration.activeCampfire = undefined;
      exploration.activeChest = undefined;
      exited = true;
    } else if (result === "fled") {
      logs.push("💨 L'équipe s'est échappée du combat.");
    }

    // **Re-détection de la case** : si le combat s'est déclenché en marchant
    // sur un coffre / un feu / une échelle / une porte, l'événement de la case
    // doit être re-calculé à la fin du combat (sinon il faudrait se déplacer
    // d'une case et revenir). On ne le fait pas en cas de défaite (on sort du
    // donjon) ni si des stats sont à choisir (re-détecté dans submitStatChoices).
    let finalState = ExplorationSessionService.serializeForCombat(exploration);
    if (result !== "defeat" && !pendingLevelUps) {
      const tileResult = await ExplorationSessionService.resolveTileEvents(
        exploration, exploration.party.position, sessionKey
      );
      logs.push(...(tileResult.logs ?? []));
      finalState = tileResult.state;
      if (tileResult.exited) exited = true;
    }

    // Persiste l'équipe (PV, or, XP mis à jour). En cas de défaite, la
    // position est le hub d'origine (sortie du donjon).
    await ExplorationSessionService.persistForCombat(exploration);

    // On supprime la session **sauf** s'il reste des stats à choisir.
    if (!pendingLevelUps) this.sessions.delete(sessionKey);
    if (exited) ExplorationSessionService.deleteSession(sessionKey);
    return { state: finalState, logs, exited, pendingLevelUps, gameOver };
  }

  /**
   * Applique les stats choisies par le joueur pour les montées de niveau
   * reportées (voir `applyEnd`). Appelé par le front après l'écran de choix.
   *
   * @param choices Tableau de `{ characterId, stat }` (un par montée reportée).
   * @returns l'état d'exploration mis à jour + les logs.
   */
  static async submitStatChoices(sessionKey: string, choices: { characterId: string; stat: keyof import("../../classes/Types").Statistics }[]): Promise<{ state: any; logs: string[]; exited?: boolean }> {
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

    // **Re-détection de la case** (comme dans applyEnd) : le combat s'est
    // terminé après le choix des stats, l'événement de la case doit être
    // re-calculé (coffre / feu / échelle / porte).
    let finalState = ExplorationSessionService.serializeForCombat(exploration);
    let exited = false;
    const tileResult = await ExplorationSessionService.resolveTileEvents(
      exploration, exploration.party.position, sessionKey
    );
    logs.push(...(tileResult.logs ?? []));
    finalState = tileResult.state;
    if (tileResult.exited) exited = true;

    await ExplorationSessionService.persistForCombat(exploration);
    this.sessions.delete(sessionKey);
    if (exited) ExplorationSessionService.deleteSession(sessionKey);
    return { state: finalState, logs, exited };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Extrait le log du **dernier tour** de combat (pour l'écran de récap de
   * game over). Le log est structuré par marqueurs `--- Tour N ---` : on
   * prend tout ce qui suit le dernier marqueur.
   */
  private static extractLastTurnLog(log: string[]): string[] {
    let lastTurnIdx = -1;
    for (let i = log.length - 1; i >= 0; i--) {
      if (log[i].startsWith("--- Tour")) {
        lastTurnIdx = i;
        break;
      }
    }
    return lastTurnIdx >= 0 ? log.slice(lastTurnIdx) : log.slice(-10);
  }

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

  /**
   * Synchronise l'état de tour du héros courant (fin de tour manuelle).
   *
   * À chaque **nouveau tour** de héros (détection via la clé `turn:actionIndex`),
   * on réinitialise le **budget de déplacement** (portée de déplacement : 1 par
   * défaut, 2 pour le Voleur, Dextérité pour le Moine Maître) et le flag
   * d'action. Le joueur peut alors se déplacer (1 case par clic) avant ET/OU
   * après son action, et termine son tour manuellement (« Fin de tour »).
   *
   * Appelé en début de chaque opération de combat (move / act / endTurn /
   * aiStep / confirmPlacement) pour que l'état soit à jour.
   */
  private static syncTurnState(session: CombatSession): void {
    const state = session.battle.combatState;
    const actor = state.currentActor;
    if (!actor || actor.type !== "Hero") return;
    const key = `${state.turn}:${state.actionIndex}`;
    if (session.turnKey !== key) {
      session.turnKey = key;
      session.moveBudgetFor = actor.id;
      session.moveBudget = actor.getMovementRange();
      session.hasActed = false;
    }
  }

  /**
   * **Fin de tour automatique** : si le héros a agi ET épuisé tout son budget
   * de déplacement, on termine son tour (avance le combat). Sinon, le joueur
   * doit cliquer « Fin de tour » (fin de tour manuelle).
   */
  private static maybeAutoEndTurn(session: CombatSession): void {
    const state = session.battle.combatState;
    if (state.isOver) return;
    const actor = state.currentActor;
    if (!actor || actor.type !== "Hero") return;
    if (session.hasActed && session.moveBudget <= 0) {
      session.battle.playerEndTurn(actor.id);
      // Le tour a avancé → réinitialise l'état du prochain héros (budget de
      // déplacement + flag d'action) pour que `canMove` soit juste.
      this.syncTurnState(session);
    }
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
      view.attackType = u.attackType;
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

    // Attaque : ennemis à portée de l'arme équipée (portée 1 par défaut,
    // lance = 2, arc = 3).
    const attackRange = unit.getAttackRange();
    const attackTargets = alive
      .filter(
        (u) =>
          u.type === "Enemy" &&
          Math.max(
            Math.abs(u.position.row - unit.position.row),
            Math.abs(u.position.col - unit.position.col)
          ) <= attackRange
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

      // Objets : consommables (soin → allié/soi, outil → ennemi). Les objets
      // sont dans le **sac commun** (les sacs individuels sont vidés par
      // `migrateMemberBags`) : on liste depuis `party.bag`, pas `unit.bag`.
      items = session.exploration.party.bag
        .filter((it) => it.type === "consumable")
        .map((it) => ({
          id: it.id,
          name: it.name,
          target: "ally" as const,
          validTargets: this.targetsByType(unit, "ally", alive),
        }));
    }

    return {
      // Déplacement autorisé tant que le budget de cases n'est pas épuisé
      // (peu importe si le héros a déjà agi : on peut bouger après l'action).
      canMove: session.moveBudget > 0 && session.moveBudgetFor === unit.id,
      // Budget de déplacement **restant** : le front affiche les cases à
      // Chebyshev ≤ moveRange (le héros peut tout faire d'un coup ou splitter).
      moveRange: session.moveBudgetFor === unit.id ? session.moveBudget : 0,
      // Le héros peut-il encore agir ce tour ? (1 action par tour.)
      canAct: !session.hasActed,
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
