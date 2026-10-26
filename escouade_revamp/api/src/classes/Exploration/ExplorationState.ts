// src/classes/Exploration/ExplorationState.ts
import { Zone, SpecialEncounter } from "../World/Zone";
import { Party } from "./Party";
import { Encounter } from "./Encounter";
import { EncounterEngine } from "./EncounterEngine";
import { Position } from "../Types";
import { CampfireService } from "../../services/dungeon/CampfireService";
import { Campfire } from "../Progression/Campfire";
import { Character } from "../UnitTypes/Character";
import { CharacterFactory } from "../../services/factory/CharacterFactory";
import { BattleManager, DiceRoller } from "../Combat/BattleManager";
import { CombatService, CombatOutcome } from "../../services/Battle/CombatService";
import { LootEngine, LootResult } from "../Progression/LootEngine";
import { Statistics, Difficulty } from "../Types";

/** Re-export pour compatibilité (le type vit désormais dans Types). */
export type { Difficulty };
import { Demon } from "../UnitTypes/Demon";
import { BlackMage } from "../Jobs/BlackMage";
import { QuestSystem } from "../Progression/QuestSystem";
import { QuestService } from "../../services/Progression/QuestService";

/** Résultat de la gestion d'une défaite. */
export interface DefeatResolution {
  /** "wiped" (easy) ou "gameOver" (hard). */
  mode: "wiped" | "gameOver";
  /** Ville de renvoi (mode easy). */
  hubId?: string;
}

export class ExplorationState {
  party: Party;
  zone: Zone;
  /** Système de quêtes (partagé avec la ville pour la continuité). */
  questSystem: QuestSystem;
  currentEncounter: Encounter | null = null;
  activeCampfire?: Campfire;
  stepsTaken: number = 0;
  turnsTaken: number = 0;
  /** Tours complets restants de l'effet Repousse (annule les rencontres). */
  repousseTurnsLeft: number = 0;
  /** Combat en cours (construit via startCombat, résolu via resolveCombat). */
  activeBattle: BattleManager | null = null;
  /** Démon en cours de combat (rencontre spéciale). */
  activeDemon: Demon | null = null;
  /** Rencontre spéciale (démon) en cours. */
  activeDemonEncounter: SpecialEncounter | null = null;
  /** Démons vaincus cette session de zone (à rebattre en quittant la zone). */
  defeatedDemonsThisZone: string[] = [];
  /** Mode de difficulté (easy = wipe à la ville, hard = game over). */
  difficulty: Difficulty = "easy";
  /** Identifiant de la dernière ville visitée (cible du wipe en mode easy). */
  lastHubId?: string;
  /** true si la partie est perdue (game over, mode hard). */
  gameOver: boolean = false;
  /** Ville vers laquelle l'équipe doit retourner après un wipe. */
  returnToHubId?: string;
  savedAt?: Date;
  lastExplorationDate?: Date;

  constructor(party: Party, zone: Zone, questSystem?: QuestSystem) {
    this.party = party;
    this.zone = zone;
    this.questSystem = questSystem ?? new QuestSystem();
    this.lastExplorationDate = new Date();
    // Quêtes : l'entrée dans la zone complète les étapes `goTo` correspondantes.
    // On utilise le nom du **donjon** (parentDungeonName) car les cibles `goTo`
    // du JSON pointent vers le donjon ("Forêt des soupirs"), pas vers le niveau
    // ("Forêt des soupirs E.1"). Pour une zone autonome (lac), c'est son nom.
    QuestService.onEnterZone(this.questSystem, zone.parentDungeonName ?? zone.name);
  }

  /**
   * Lance le dé de déplacement : nombre de pas pour ce tour (1-6).
   */
  rollSteps(rand: () => number = Math.random): number {
    return Math.floor(rand() * 6) + 1;
  }

  /**
   * Distance de Manhattan entre deux cases.
   */
  manhattanDistance(a: Position, b: Position): number {
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
  }

  /**
   * true si la case est praticable (présente dans la tuileMap de la zone) et
   * **non bloquée** (ex. porte de sang non ouverte).
   */
  isWalkable(pos: Position): boolean {
    const row = this.zone.tileMap[pos.row];
    if (!row || row[pos.col] !== true) return false;
    return !this.zone.isBlocked(pos);
  }

  /**
   * true si le groupe est **adjacent** (4 directions) à une case bloquée
   * (ex. la porte de sang). Requis pour pouvoir faire le rituel.
   */
  isAdjacentToBlockedTile(): boolean {
    const pos = this.party.position;
    const neighbors: Position[] = [
      { row: pos.row - 1, col: pos.col },
      { row: pos.row + 1, col: pos.col },
      { row: pos.row, col: pos.col - 1 },
      { row: pos.row, col: pos.col + 1 },
    ];
    return neighbors.some((n) => this.zone.isBlocked(n));
  }

  /**
   * Rituel de la porte de sang (Phase D) : débloque la case bloquée adjacente
   * en consommant l'objet "Cœur de sang".
   *
   * Conditions :
   *  - le groupe est adjacent à une case bloquée ;
   *  - un membre de l'équipe porte l'objet "Cœur de sang".
   *
   * Succès : l'objet est consommé (retiré du sac du porteur), la case est
   * débloquée, et le démon ancré dessus (Zeromus) est révélé — un défi
   * **optionnel** (le joueur choisit d'y marcher pour le combattre).
   *
   * @returns les logs du rituel.
   */
  performBloodRitual(): string[] {
    const logs: string[] = [];
    if (!this.isAdjacentToBlockedTile()) {
      logs.push("Il n'y a pas de porte de sang à proximité.");
      return logs;
    }

    // Trouve un porteur de l'objet "Cœur de sang".
    const holder = this.party.members.find((c) =>
      c.bag.some((i) => i.name === "Cœur de sang")
    );
    if (!holder) {
      logs.push("Le rituel échoue : il faut le Cœur de sang.");
      return logs;
    }

    // Consomme l'objet (1er exemplaire dans le sac du porteur).
    const idx = holder.bag.findIndex((i) => i.name === "Cœur de sang");
    holder.bag.splice(idx, 1);

    // Débloque la case adjacente (celle qui est bloquée).
    const pos = this.party.position;
    const neighbors: Position[] = [
      { row: pos.row - 1, col: pos.col },
      { row: pos.row + 1, col: pos.col },
      { row: pos.row, col: pos.col - 1 },
      { row: pos.row, col: pos.col + 1 },
    ];
    const blocked = neighbors.find((n) => this.zone.isBlocked(n));
    if (!blocked) {
      logs.push("La porte a déjà été ouverte.");
      return logs;
    }
    this.zone.unblockTile(blocked);

    // Le démon ancré sur la case (Zeromus) est révélé.
    const revealed = this.zone.getSpecialEncounterAt(blocked);
    logs.push("Le Cœur de sang pulse... La porte de sang s'ouvre dans un craquement de chair.");
    if (revealed) {
      logs.push(`${revealed.demonName} se dresse au-delà. (Défi optionnel : avancez pour l'affronter.)`);
    }
    return logs;
  }

  /**
   * Active l'effet Repousse : annule les rencontres pendant 3 tours complets.
   */
  activateRepousse(): string[] {
    this.repousseTurnsLeft = 3;
    return ["Le Repousse est actif : plus de rencontre aléatoire pendant 3 tours complets."];
  }

  /**
   * Déroule un tour d'exploration complet.
   *
   * Mécanique (livret) :
   *  - L'équipe lance un dé (1-6) : la valeur donne le nombre de pas.
   *  - L'équipe choisit une case d'arrivée à cette distance (Manhattan).
   *  - Plus il y a de pas, plus le taux de rencontre augmente (1 roll par pas).
   *  - 1 tour = N pas : le compteur de Repousse se décale à la fin du tour.
   *
   * @param targetPos Case d'arrivée choisie par l'équipe.
   * @param rand Fonction aléatoire injectable (déterminisme des tests).
   * @returns Les logs du tour.
   */
  takeTurn(targetPos: Position, rand: () => number = Math.random): string[] {
    const logs: string[] = [];

    if (this.gameOver) {
      logs.push("La partie est terminée (game over).");
      return logs;
    }

    if (this.currentEncounter || this.activeDemon) {
      logs.push("Impossible de se déplacer pendant un combat !");
      return logs;
    }

    const repousseActive = this.repousseTurnsLeft > 0;
    const steps = this.rollSteps(rand);
    logs.push(`Le groupe lance le dé : ${steps} pas.`);

    if (!this.isWalkable(targetPos)) {
      logs.push(`La case ${targetPos.row},${targetPos.col} n'est pas praticable.`);
      return logs;
    }

    const dist = this.manhattanDistance(this.party.position, targetPos);
    if (dist === 0) {
      logs.push("Le groupe reste sur place.");
    } else if (dist > steps) {
      logs.push(`Trop loin ! La case ${targetPos.row},${targetPos.col} est à ${dist} pas (max ${steps}).`);
      return logs;
    } else {
      this.party.moveTo(targetPos);
      this.stepsTaken += dist;
      logs.push(`Le groupe avance vers la case ${targetPos.row},${targetPos.col}.`);
    }

    // Détection de la rencontre du tour (priorité : pêche > démon ancré > feu de camp > aléatoire).
    const LAKESIDE_DEMON = "Mateus, le Corrompu";
    const isFishing =
      this.zone.isFishingTile(this.party.position) &&
      !this.defeatedDemonsThisZone.includes(LAKESIDE_DEMON);
    const special = this.zone.getSpecialEncounterAt(this.party.position);
    // Une rencontre spéciale conditionnelle (requiresQuest) n'est active que si
    // la quête correspondante est acceptée (ex. Adrammelech si la quête 2 l'est).
    const questAccepted = special?.requiresQuest
      ? this.questSystem.getQuest(special.requiresQuest)?.accepted ?? false
      : true;
    const isSpecial =
      !!special && questAccepted && !this.defeatedDemonsThisZone.includes(special.demonName);

    if (isFishing) {
      // Pêche (lac) : Mateus apparaît. (Réutilise la mécanique de démon.)
      this.activeDemonEncounter = { demonName: LAKESIDE_DEMON, position: this.party.position };
      this.activeDemon = new Demon(LAKESIDE_DEMON, "Enemy", { row: 2, col: 2 });
      logs.push(`La canne s'enfonce... Quelque chose mord : ${LAKESIDE_DEMON} !`);
    } else if (isSpecial && special) {
      // Rencontre spéciale (démon) ancrée à cette case.
      this.activeDemonEncounter = special;
      this.activeDemon = new Demon(special.demonName, "Enemy", { row: 2, col: 2 });
      logs.push(`Un démon se dresse sur votre route : ${special.demonName} !`);
    } else {
      // Feu de camp ? (repos automatique, pas de rencontre)
      const campfire = CampfireService.getNearbyCampfire(this.party, this.zone.getCampFires());
      if (campfire && !campfire.isUsed) {
        this.activeCampfire = campfire;
        logs.push("Le groupe s'arrête au feu de camp.");
        logs.push(...CampfireService.useCampfire(campfire, this.party));
      } else {
        this.activeCampfire = undefined;
        // Rencontre ? (1 roll par pas — plus de pas = plus de chances)
        let encounter: Encounter | null = null;
        for (let i = 0; i < dist; i++) {
          encounter = EncounterEngine.roll(this.zone, this.party, repousseActive, rand, this.difficulty);
          if (encounter) break;
        }
        if (encounter) {
          this.currentEncounter = encounter;
          logs.push("Une rencontre surgit !");
          logs.push(...encounter.getSummary().enemies);
        }
      }
    }

    // Fin de tour : le compteur de Repousse se décale.
    this.turnsTaken++;
    if (this.repousseTurnsLeft > 0) {
      this.repousseTurnsLeft--;
      if (this.repousseTurnsLeft === 0) logs.push("L'effet Repousse s'essouffle.");
    }

    // Complétion de zone : le groupe a atteint la sortie (endTile).
    if (this.isExplorationComplete()) {
      logs.push(...this.completeZone());
    }

    this.lastExplorationDate = new Date();
    return logs;
  }

  /**
   * Construit le combat à partir de la rencontre courante.
   *
   * À appeler après qu'une rencontre est apparue (via `takeTurn`). Les héros
   * vivants et les ennemis sont placés sur le plateau 8x8 et un
   * `BattleManager` est retourné, prêt à être piloté (IA ou joueur).
   *
   * @param rollDice tireur de dés injectable (déterminisme des tests).
   * @returns le `BattleManager` construit, ou null si aucune rencontre.
   */
  startCombat(rollDice: DiceRoller = () => Math.floor(Math.random() * 6) + 1): BattleManager | null {
    if (!this.currentEncounter) return null;
    this.activeBattle = CombatService.buildBattle(this.currentEncounter, this.party, rollDice);
    return this.activeBattle;
  }

  /**
   * Résout le combat en cours et applique les conséquences à l'exploration.
   *
   *  - Victoire : le butin (or + XP) est distribué aux survivants, la rencontre
   *    est terminée et le compteur d'ennemis vaincus est mis à jour.
   *  - Défaite / fuite : la rencontre est levée (l'escouade recule ou fuit),
   *    sans butin.
   *
   * @param statChoices fonction qui, pour chaque héros, choisit la stat à
   *   augmenter en cas de montée de niveau (défaut : force).
   * @returns le résultat du combat + le butin distribué (si victoire).
   */
  resolveCombat(
    statChoices: (char: Character) => keyof Statistics = () => "strength"
  ): { outcome: CombatOutcome; loot?: LootResult; defeat?: DefeatResolution } {
    if (!this.activeBattle) {
      throw new Error("Aucun combat actif. Appelez d'abord startCombat().");
    }

    const outcome = CombatService.runCombat(this.activeBattle);
    this.activeBattle = null;

    let loot: LootResult | undefined;
    let defeat: DefeatResolution | undefined;
    if (outcome.result === "victory") {
      loot = LootEngine.distributeLoot(outcome.survivors, outcome.defeated, statChoices, this.difficulty);
      // Quêtes : signale la victoire sur chaque ennemi vaincu (étapes `defeat`).
      for (const enemy of outcome.defeated) {
        QuestService.onDefeat(this.questSystem, enemy.name);
      }
      this.endEncounter();
    } else if (outcome.result === "defeat") {
      // Défaite : gérée selon le mode de difficulté (wipe ou game over).
      defeat = this.handleDefeat();
    } else {
      // Fuite : on lève la rencontre sans butin.
      this.currentEncounter = null;
    }

    return { outcome, loot, defeat };
  }

  /**
   * Enregistre la dernière ville visitée (cible du wipe en mode easy).
   */
  setLastHub(hubId: string): void {
    this.lastHubId = hubId;
  }

  /**
   * Gère la défaite selon le mode de difficulté.
   *
   *  - **easy** : wipe — l'équipe est soignée et renvoyée à la dernière ville
   *    visitée (position réinitialisée au point de départ de la zone).
   *  - **hard** : game over — la partie est perdue (l'effacement de la
   *    sauvegarde se fait à la couche persistance, Phase 4).
   *
   * @returns le mode de résolution appliqué.
   */
  handleDefeat(): DefeatResolution {
    this.currentEncounter = null;
    this.activeBattle = null;

    if (this.difficulty === "hard") {
      this.gameOver = true;
      return { mode: "gameOver" };
    }

    // easy : wipe → renvoi à la dernière ville visitée.
    for (const member of this.party.members) {
      member.currentHp = member.maxHp;
      member.currentMp = member.maxMp;
    }
    this.party.moveTo(this.zone.startTile);
    this.returnToHubId = this.lastHubId;
    return { mode: "wiped", hubId: this.lastHubId };
  }

  /**
   * Construit le combat contre le démon détecté par `takeTurn`.
   *
   * Le démon (créé par `takeTurn`) est placé sur le plateau 8x8 avec les héros
   * vivants. À appeler après que `takeTurn` a détecté la rencontre spéciale.
   *
   * @param rollDice tireur de dés injectable (déterminisme des tests).
   * @returns le `BattleManager` construit, ou null si aucun démon actif.
   */
  startDemonCombat(rollDice: DiceRoller = () => Math.floor(Math.random() * 6) + 1): BattleManager | null {
    if (!this.activeDemon) return null;
    const demon = this.activeDemon;

    const units: (Character | Demon)[] = [];
    const aliveHeroes = this.party.getAliveMembers();
    aliveHeroes.forEach((hero, i) => {
      hero.position = { row: 6 + Math.floor(i / 4), col: i % 4 };
      units.push(hero);
    });
    units.push(demon);

    this.activeBattle = new BattleManager(units, rollDice);
    return this.activeBattle;
  }

  /**
   * Résout le combat contre un démon et applique les conséquences.
   *
   *  - Victoire : le pacte est récupéré (si un Démoniste a un slot libre) et le
   *    démon est marqué vaincu pour la session de zone.
   *  - Défaite : gérée selon le mode de difficulté (wipe / game over).
   *
   * @returns le résultat + le pacte récupéré (si victoire et slot libre).
   */
  resolveDemonCombat(): { result: string; pacteRecupered: boolean; logs: string[] } {
    if (!this.activeBattle || !this.activeDemon) {
      throw new Error("Aucun combat de démon actif. Appelez d'abord startDemonCombat().");
    }

    const result = this.activeBattle.run();
    const logs: string[] = [];
    let pacteRecupered = false;

    if (result === "victory") {
      const demonName = this.activeDemon.name;
      this.defeatedDemonsThisZone.push(demonName);
      logs.push(`${demonName} est vaincu !`);

      // Quêtes : le démon est vaincu (étapes `defeat` — ex. quête 2 : Adrammelech).
      QuestService.onDefeat(this.questSystem, demonName);

      // Récupération du pacte : un Démoniste avec un slot libre.
      const demonist = this.party.members.find(
        (c) => c.job instanceof BlackMage && c.job.name === "Démoniste"
      ) as Character | undefined;

      if (demonist) {
        const bm = demonist.job as BlackMage;
        if (bm.canRecruit()) {
          logs.push(...bm.recruitDemon(demonName));
          pacteRecupered = true;
          // Quêtes : signale le recrutement du démon (étapes `recruit`).
          QuestService.onRecruit(this.questSystem, demonName);
        } else {
          logs.push(`Aucun pacte libre : le pacte de ${demonName} est perdu.`);
        }
      } else {
        logs.push(`Aucun Démoniste dans l'équipe : le pacte de ${demonName} est perdu.`);
      }
    } else if (result === "defeat") {
      this.handleDefeat();
    }

    this.activeBattle = null;
    this.activeDemon = null;
    this.activeDemonEncounter = null;
    return { result, pacteRecupered, logs };
  }

  /**
   * Réinitialise les démons vaincus de la zone (appelé en quittant la zone).
   * Les démons non récupérés devront être rebattus.
   */
  resetZoneDemons(): void {
    this.defeatedDemonsThisZone = [];
    this.activeDemon = null;
    this.activeDemonEncounter = null;
  }

  /**
   * Fin d’un combat : met à jour les statistiques et supprime la rencontre
   */
  endEncounter() {
    if (this.currentEncounter) {
      this.party.defeatedEnemies += this.currentEncounter.enemies.length;
      this.currentEncounter = null;
    }
    this.activeBattle = null;
  }

  /** La partie est-elle perdue (game over, mode hard) ? */
  isGameOver(): boolean {
    return this.gameOver;
  }

  canMove(): boolean {
    return this.currentEncounter === null && this.activeDemon === null;
  }

  isExplorationComplete(): boolean {
    return (
      this.zone.endTile &&
      this.party.position.row === this.zone.endTile.row &&
      this.party.position.col === this.zone.endTile.col
    );
  }

  /**
   * Marque la zone courante comme complétée et fait monter le niveau du monde.
   * Idempotent : ne monte qu'une fois par zone.
   * @returns les logs (vide si la zone était déjà complétée).
   */
  completeZone(): string[] {
    const zoneName = this.zone.parentDungeonName ?? this.zone.name;
    const leveledUp = this.party.completeZone(zoneName);
    if (leveledUp) {
      return [`Zone « ${zoneName} » complétée ! Le niveau du monde monte à ${this.party.worldLevel}.`];
    }
    return [];
  }

  /**
   * (Dé)sérialisation complète (round-trip avec `toJSON`).
   *
   * Restaure **tout** l'état : équipe (PV/MP/XP/or/job/pactes/sac), zone
   * (tuiles, impasses, cases bloquées, rencontres spéciales, tuiles de pêche),
   * système de quêtes (acceptées/terminées/étapes) et démons vaincus.
   *
   * Les états transitoires (combat en cours, démon actif, rencontre aléatoire)
   * ne sont PAS restaurés : une sauvegarde se fait entre deux actions, jamais
   * en plein combat.
   */
  static loadFromJSON(data: any): ExplorationState {
    const characters: Character[] = data.party.members.map((charData: any) =>
      CharacterFactory.fromSerialized(charData)
    );

    const party = new Party(data.party.id, characters, data.party.position);
    // Restaure l'historique de l'équipe (perdu sinon).
    for (const key of data.party.visitedTiles ?? []) party.visitedTiles.add(key);
    party.defeatedEnemies = data.party.defeatedEnemies ?? 0;
    // Restaure la progression du monde (niveau + zones complétées).
    party.worldLevel = data.party.worldLevel ?? 0;
    for (const z of data.party.completedZones ?? []) party.completedZones.add(z);
    // Restaure le sac commun de l'équipe (objets partagés).
    party.bag = (data.party.bag ?? []).map((i: any) => CharacterFactory.deserializeItem(i));

    const zone = new Zone(
      data.zone.id,
      data.zone.name,
      data.zone.biome,
      data.zone.zoneLevel,
      data.zone.spawnRates,
      data.zone.encounterRate,
      (data.zone.checkpoints ?? []).map(
        (cp: any) =>
          new Campfire(
            cp.location ?? cp.locationName,
            cp.restoredHp ?? cp.restoredHealthPercentage ?? 0.5,
            cp.restoredMp ?? cp.restoredManaPercentage ?? 0.5,
            cp.position
          )
      ),
      data.zone.seed,
      data.zone.floor ?? 0,
      data.zone.tileMap,
      data.zone.startTile,
      data.zone.endTile,
      data.zone.campfires ?? [],
      data.zone.parentDungeonName,
      data.zone.deadEnds ?? [],
      data.zone.blockedTiles ?? [],
      data.zone.specialEncounters ?? [],
      data.zone.fishingTiles ?? []
    );

    const state = new ExplorationState(party, zone);
    state.stepsTaken = data.stepsTaken ?? 0;
    state.turnsTaken = data.turnsTaken ?? 0;
    state.repousseTurnsLeft = data.repousseTurnsLeft ?? 0;
    state.difficulty = data.difficulty ?? "easy";
    state.lastHubId = data.lastHubId;
    state.gameOver = data.gameOver ?? false;
    state.returnToHubId = data.returnToHubId;
    state.savedAt = data.savedAt ? new Date(data.savedAt) : undefined;
    // Restaure la date depuis les données (et non `new Date()`) pour que le
    // round-trip soit stable (double sérialisation identique).
    state.lastExplorationDate = data.lastExplorationDate
      ? new Date(data.lastExplorationDate)
      : new Date();
    state.currentEncounter = null;
    state.defeatedDemonsThisZone = data.defeatedDemonsThisZone ?? [];

    // Restaure le système de quêtes (remplace celui créé vide par le
    // constructeur — l'appel onEnterZone du constructeur a agi sur un système
    // vide, sans effet).
    if (data.questSystem) {
      state.questSystem = QuestSystem.fromSerialized(data.questSystem);
    }

    return state;
  }

  /**
   * Sérialise l'état d'exploration complet en objet JSON (round-trip avec
   * `loadFromJSON`). C'est **cette** méthode que la persistance utilise
   * (et non `getSummary`, qui est un résumé réduit pour l'affichage).
   */
  toJSON(): any {
    return {
      party: this.party.toSerialized(),
      zone: this.zone.toSerialized(),
      questSystem: this.questSystem.toSerialized(),
      stepsTaken: this.stepsTaken,
      turnsTaken: this.turnsTaken,
      repousseTurnsLeft: this.repousseTurnsLeft,
      difficulty: this.difficulty,
      lastHubId: this.lastHubId ?? null,
      gameOver: this.gameOver,
      returnToHubId: this.returnToHubId ?? null,
      defeatedDemonsThisZone: this.defeatedDemonsThisZone,
      savedAt: this.savedAt?.toISOString() ?? null,
      lastExplorationDate: this.lastExplorationDate?.toISOString() ?? null,
    };
  }

  getSummary(): any {
    return {
      zone: {
        name: this.zone.name,
        level: this.zone.zoneLevel,
        biome: this.zone.biome,
      },
      party: {
        id: this.party.id,
        position: this.party.position,
        visitedTiles: Array.from(this.party.visitedTiles),
        members: this.party.members.map(char => ({
          id: char.id,
          name: char.name,
          hp: `${char.currentHp}/${char.maxHp}`,
          mp: `${char.currentMp}/${char.maxMp}`,
        })),
      },
      stepsTaken: this.stepsTaken,
      turnsTaken: this.turnsTaken,
      repousseTurnsLeft: this.repousseTurnsLeft,
      difficulty: this.difficulty,
      lastHubId: this.lastHubId ?? null,
      gameOver: this.gameOver,
      returnToHubId: this.returnToHubId ?? null,
      savedAt: this.savedAt?.toISOString() ?? null,
      lastExplorationDate: this.lastExplorationDate?.toISOString() ?? null,
      activeCampfire: this.activeCampfire?.getSummary() ?? null,
      currentEncounter: this.currentEncounter?.getSummary() ?? null,
    };
  }
}