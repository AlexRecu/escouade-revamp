import { Party } from "../../classes/Exploration/Party";
import { QuestSystem } from "../../classes/Progression/QuestSystem";
import { Dungeon } from "../../classes/World/Dungeon";
import { Zone, ZoneType } from "../../classes/World/Zone";
import { Campfire } from "../../classes/Progression/Campfire";
import { Position, Statistics } from "../../classes/Types";
import { WorldService } from "../World/WorldService";
import { PartyService } from "../Hub/PartyService";
import { PartyRoomService } from "../Hub/PartyRoomService";
import { ZoneFactory } from "../factory/ZoneFactory";
import { CampfireService } from "./CampfireService";
import { ChestService } from "./ChestService";
import { Chest } from "../../classes/Types";
import { EncounterEngine } from "../../classes/Exploration/EncounterEngine";
import { CombatService } from "../Battle/CombatService";
import { CombatSessionService } from "../Battle/CombatSessionService";
import { LootEngine } from "../../classes/Progression/LootEngine";
import { HubSerializer } from "../Hub/HubSerializer";
import { Weapon } from "../../classes/Items/Weapon";

/** Direction de déplacement (4 directions, pas de diagonale). */
export type Direction = "north" | "south" | "east" | "west";

/**
 * Démons de zone ancrés par biome (Phase B). Le flux live **régénère** les
 * zones à chaque entrée (nouveau seed), il n'utilise pas les zones du
 * `WorldMap` : l'ancrage est donc refait ici, à la construction de la session.
 *
 * Mapping (livret) :
 *  - Adrammelech → Forêt des soupirs (Forest) — auto-présent si la quête
 *    « kidnappeur » est acceptée.
 *  - Bélias → Tour du serment (Tower).
 *  - Hashmal → Vallée des cendres (Canyon).
 *
 * (Zeromus / porte de sang = Phase D, géré séparément.)
 */
const ZONE_DEMONS: { biome: ZoneType; demonName: string; requiresQuest?: string }[] = [
  { biome: "Forest", demonName: "Adrammelech, le Grand Courroux", requiresQuest: "quest_kidnappeur" },
  { biome: "Tower", demonName: "Bélias, le Titan" },
  { biome: "Canyon", demonName: "Hashmal, le Grand Ordonnateur" },
];

/**
 * Backend de persistance d'une session de donjon.
 *
 *  - `player` : mode solo — l'équipe est celle du joueur (`PartyService`).
 *  - `room`   : mode multi-joueurs — l'équipe est **partagée** par la partie
 *    (`PartyRoomService`) ; la session est cléée par `roomId` et commune à
 *    tous les membres de la room.
 */
export type DungeonStorage =
  | { kind: "player"; playerId: string }
  | { kind: "room"; roomId: string };

const DIRECTIONS: Record<Direction, { row: number; col: number }> = {
  north: { row: -1, col: 0 },
  south: { row: 1, col: 0 },
  east: { row: 0, col: 1 },
  west: { row: 0, col: -1 },
};

/**
 * Session d'exploration d'un donjon (mode déplacement, temps réel).
 *
 * Pont entre la session de ville (`HubSessionService`) et le moteur
 * d'exploration : le joueur entre dans un donjon depuis la mappemonde, se
 * déplace case par case sur la grille, se repose aux feux de camp, et quitte
 * le donjon (ce qui persiste l'équipe).
 *
 * **Régénération** : à chaque entrée, le donjon est régénéré avec un nouveau
 * seed (nouvelle grille) et un nombre d'étages dynamique (`2 + niveau`).
 *
 * NB : le combat n'est pas encore branché (périmètre = déplacement). Les
 * rencontres aléatoires et le butin seront ajoutés ensuite.
 */
export class ExplorationSessionService {
  /** Sessions en mémoire (playerId → session de donjon). */
  private static sessions: Map<string, DungeonSession> = new Map();

  /**
   * Entre dans un donjon en **mode solo** : charge l'équipe du joueur,
   * **régénère** le donjon (nouveau seed, nb d'étages dynamique) et démarre à
   * l'étage 1.
   *
   * @returns l'état sérialisé pour le front.
   */
  static async enterDungeon(playerId: string, dungeonId: string): Promise<any> {
    const game = await PartyService.loadGame(playerId);
    if (!game) throw new Error("Aucune partie trouvée. Rejoignez d'abord une ville.");
    // **Blocage des déplacements** : la zone doit être la position actuelle
    // (re-entrée immédiate depuis la sortie) OU adjacente à la position
    // (hub en ville, ou donjon à la sortie d'une zone). Pas de téléportation
    // d'un bout à l'autre de la carte.
    if (game.currentNodeId !== dungeonId && !(await WorldService.isAdjacent(game.currentNodeId, dungeonId))) {
      throw new Error("Cette zone n'est pas accessible depuis votre position actuelle.");
    }
    const session = await this.buildSession(game.party, game.questSystem, dungeonId);
    session.storage = { kind: "player", playerId };
    session.hubId = game.currentHubId;
    session.currentNodeId = dungeonId; // la position de l'équipe devient la zone
    this.sessions.set(playerId, session);
    // Persiste la position (nœud = la zone) pour que le cercle blanc la suive.
    await PartyService.saveGame(playerId, game.party, game.questSystem, game.currentHubId, dungeonId);
    return this.serialize(session);
  }

  /**
   * Entre dans un donjon en **mode multi-joueurs** : charge l'équipe **partagée**
   * de la room, régénère le donjon et démarre à l'étage 1. La session est cléée
   * par `roomId` (commune à tous les membres).
   *
   * @returns l'état sérialisé pour le front.
   */
  static async enterDungeonRoom(roomId: string, dungeonId: string): Promise<any> {
    const game = await PartyRoomService.loadParty(roomId);
    // **Blocage des déplacements** : la zone doit être la position actuelle
    // (re-entrée immédiate depuis la sortie) OU adjacente à la position
    // (hub en ville, ou donjon à la sortie d'une zone). Pas de téléportation
    // d'un bout à l'autre de la carte.
    if (game.currentNodeId !== dungeonId && !(await WorldService.isAdjacent(game.currentNodeId, dungeonId))) {
      throw new Error("Cette zone n'est pas accessible depuis votre position actuelle.");
    }
    const session = await this.buildSession(game.party, game.questSystem, dungeonId);
    session.storage = { kind: "room", roomId };
    session.hubId = game.currentHubId;
    session.currentNodeId = dungeonId; // la position de l'équipe devient la zone
    session.difficulty = game.difficulty;
    this.sessions.set(roomId, session);
    // Persiste la position (nœud = la zone) + le snapshot du donjon (seed,
    // étage, position) pour que la reconnexion restaure le donjon en cours.
    await PartyRoomService.setCurrentNodeId(roomId, dungeonId);
    await this.persistAll(session);
    return this.serialize(session);
  }

  /**
   * Construit la session de donjon (régénération de la grille) à partir d'une
   * équipe. Commun au mode solo et au mode room.
   */
  private static async buildSession(
    party: Party,
    questSystem: QuestSystem,
    dungeonId: string,
    seed?: number
  ): Promise<DungeonSession> {
    const world = await WorldService.getWorld();
    const node = world.nodes.find((n) => n.id === dungeonId);
    if (!(node instanceof Dungeon)) throw new Error(`Donjon introuvable : ${dungeonId}`);

    // Niveau effectif (scaling dynamique) — clé = dungeon.id (cohérent avec
    // le front qui stocke/détecte les zones complétées par id).
    const level = party.effectiveZoneLevel(dungeonId);
    // Le lac est une **zone unique** (pas d'étages) : on y entre, on explore,
    // on en repart par le même port. Les autres donjons ont 2 + niveau étages.
    const floors = node.biome === "Lake" ? 1 : 2 + level;

    // Régénération : un nouveau seed à chaque entrée → nouvelle grille. En mode
    // **restauration** (seed fourni), on réutilise le seed persisté pour
    // reconstruire exactement la même grille.
    const finalSeed = seed ?? Math.floor(Math.random() * 1_000_000);
    const levels: Zone[] = [];
    for (let f = 1; f <= floors; f++) {
      levels.push(
        ZoneFactory.create({
          name: `${node.name} E.${f}`,
          type: node.biome,
          zoneLevel: level,
          seed: finalSeed + f, // seed distinct par étage (grilles différentes)
          parentDungeonName: node.name,
          floor: f,
        })
      );
    }
    const dungeon = new Dungeon(node.id, node.name, level, node.biome, levels, finalSeed);

    // Ancrage des démons de zone (Phase B) : le flux live régénère les zones,
    // donc on re-cale le démon du biome sur une impasse du 1er étage.
    this.anchorZoneDemons(levels[0]);

    // Position de départ : la tuile de départ du 1er étage. En mode
    // restauration, la position vient de la party (déjà à jour en base) → on
    // ne l'écrase pas.
    if (seed === undefined) {
      const firstZone = levels[0];
      party.moveTo({ ...firstZone.startTile });
    }

    return {
      party,
      questSystem,
      dungeon,
      currentFloor: 0,
      activeCampfire: undefined,
      completed: false,
      storage: { kind: "player", playerId: "" }, // rempli par l'appelant
      woodCampfires: [],
      defeatedDemonsThisZone: [],
    };
  }

  /**
   * Ancre le **démon de zone** du biome sur le 1er étage (Phase B).
   *
   * Le flux live régénère les zones à chaque entrée (nouveau seed), il n'utilise
   * pas les zones du `WorldMap` : l'ancrage est donc refait ici. Le démon est
   * placé sur une **impasse** (cul-de-sac) de préférence, sinon sur une case
   * praticable (jamais le point de départ).
   *
   * @param zone le 1er étage du donjon (celui qui porte le démon).
   */
  private static anchorZoneDemons(zone: Zone): void {
    const spec = ZONE_DEMONS.find((d) => d.biome === zone.biome);
    if (!spec) return;

    // Position : une impasse de préférence, sinon une case praticable qui
    // n'est pas le point de départ.
    const walkable: Position[] = [];
    zone.tileMap.forEach((row, r) =>
      row.forEach((walkableTile, c) => {
        if (walkableTile) walkable.push({ row: r, col: c });
      })
    );
    const startKey = `${zone.startTile.row},${zone.startTile.col}`;
    const deadEnd = zone.deadEnds.find((p) => `${p.row},${p.col}` !== startKey);
    const position =
      deadEnd ??
      walkable.find((p) => `${p.row},${p.col}` !== startKey);
    if (!position) return;

    zone.specialEncounters.push({
      demonName: spec.demonName,
      position,
      deadEnd: !!deadEnd,
      requiresQuest: spec.requiresQuest,
    });
  }

  /**
   * Déplace l'équipe d'une case dans la direction donnée.
   *
   * Valide que la case cible est adjacente et praticable. Gère la détection
   * de feu de camp et la progression d'étage (atteinte de la tuile de sortie).
   *
   * @param sessionKey clé de la session (`playerId` en solo, `roomId` en room).
   * @returns l'état sérialisé (ou une erreur si le déplacement est invalide).
   */
  static async move(sessionKey: string, direction: Direction): Promise<any> {
    const session = this.require(sessionKey);
    if (session.completed) {
      return { logs: ["Le donjon est terminé."], state: this.serialize(session), exited: true };
    }

    const zone = session.dungeon.levels[session.currentFloor];
    const delta = DIRECTIONS[direction];
    if (!delta) throw new Error(`Direction invalide : ${direction}`);

    const from = session.party.position;
    const to: Position = { row: from.row + delta.row, col: from.col + delta.col };

    // Validation : dans les bornes + tuile praticable.
    if (!this.isWalkable(zone, to)) {
      return { logs: ["Vous ne pouvez pas vous déplacer dans cette direction."], state: this.serialize(session) };
    }

    session.party.moveTo(to);
    // Persiste l'équipe + le snapshot (position, tuiles visitées) pour que
    // la reconnexion restaure la même position dans le donjon.
    await this.persistAll(session);

    // **Rencontre spéciale (démon de zone)** : priorité sur la rencontre
    // aléatoire. Si l'équipe marche sur la case d'un démon ancré (impasse),
    // le combat se déclenche. Un démon conditionnel (`requiresQuest`) n'est
    // actif que si la quête correspondante est acceptée (ex. Adrammelech si la
    // quête « kidnappeur » l'est). Un démon déjà vaincu dans la session ne se
    // re-détecte plus (le défi est optionnel).
    const special = zone.getSpecialEncounterAt(to);
    if (special && !session.defeatedDemonsThisZone.includes(special.demonName)) {
      const questAccepted = special.requiresQuest
        ? session.questSystem.getQuest(special.requiresQuest)?.accepted ?? false
        : true;
      if (questAccepted) {
        const combatState = CombatSessionService.startDemonCombat(sessionKey, session, special.demonName);
        return {
          logs: [`Un démon se dresse sur votre route : ${special.demonName} !`],
          state: this.serialize(session),
          combat: combatState,
        };
      }
    }

    // **Rencontre aléatoire** : à chaque pas, le moteur de rencontre décide si
    // un combat se déclenche (formule du livret : aléatoire < P, P par biome).
    // Si rencontre → on démarre un **combat interactif** (le front bascule sur
    // la vue de combat et pilote le tour par tour).
    const encounter = EncounterEngine.roll(zone, session.party);
    if (encounter) {
      const combatState = CombatSessionService.startCombat(sessionKey, session, encounter);
      return { logs: ["⚔️ Rencontre !"], state: this.serialize(session), combat: combatState };
    }

    // Événements de la case (feu de camp, coffre, escalier, porte de sortie).
    return this.resolveTileEvents(session, to, sessionKey);
  }

  /**
   * Résout les **événements de la case** courante : feu de camp, coffre,
   * escalier (étage suivant) ou porte de sortie (fin du donjon).
   *
   * Appelé après **chaque déplacement** ET **après un combat** : si un combat
   * s'est déclenché en marchant sur un coffre / un feu / une échelle / une
   * porte, la détection est re-faite à la fin du combat pour que l'événement
   * soit disponible sans avoir à se déplacer d'une case et revenir.
   *
   * @returns l'objet à retourner au front (état courant, transition d'étage,
   *          ou sortie du donjon avec `exited: true`).
   */
  static async resolveTileEvents(
    session: DungeonSession,
    to: Position,
    sessionKey: string
  ): Promise<any> {
    const zone = session.dungeon.levels[session.currentFloor];

    // Détection de feu de camp sur la case.
    const camp = zone.checkpoints.find(
      (c) => c.position?.row === to.row && c.position?.col === to.col
    );
    session.activeCampfire = camp;

    // Détection de coffre sur la case (bouton d'ouverture).
    const chest = zone.chests.find(
      (c) => c.position.row === to.row && c.position.col === to.col
    );
    session.activeChest = chest;

    // Atteinte de la tuile d'arrivée (escalier ou porte de sortie).
    if (to.row === zone.endTile.row && to.col === zone.endTile.col) {
      const isLastFloor = session.currentFloor === session.dungeon.levels.length - 1;
      if (!isLastFloor) {
        // Escalier → étage suivant.
        session.currentFloor++;
        const nextZone = session.dungeon.levels[session.currentFloor];
        session.party.moveTo({ ...nextZone.startTile });
        session.activeCampfire = undefined;
        session.activeChest = undefined;
        await this.persistAll(session);
        return {
          logs: [`Vous descendez à l'étage ${session.currentFloor + 1}.`],
          state: this.serialize(session),
        };
      }
      // Porte de sortie (dernier étage) → donjon terminé + **auto-sortie**.
      session.completed = true;
      // Le Lac de Qual-Chen n'a pas de montée de niveau prévue (sinon le
      // worldLevel dépasserait 6) : on marque la zone complétée sans incrémenter.
      const isLake = session.dungeon.biome === "Lake";
      session.party.completeZone(session.dungeon.id, !isLake);
      // **Position** : une zone de transition mène au hub au-delà ; une impasse
      // ramène l'équipe au hub de départ.
      const exit = await this.resolveExitPosition(session);
      await this.persist(session, exit.nodeId);
      await this.clearSnapshot(session);
      this.sessions.delete(sessionKey);
      const logs = ["Vous avez atteint la sortie du donjon ! Zone terminée."];
      if (exit.log) logs.push(exit.log);
      return { logs, state: this.serialize(session), exited: true };
    }

    return { state: this.serialize(session) };
  }

  /**
   * Détermine le **nœud de position** après la sortie d'une zone.
   *
   * L'équipe reste **sur le nœud du donjon** (pas téléportée dans une ville) :
   * elle se retrouve sur la mappemonde, positionnée sur la zone qu'elle vient
   * de terminer, et choisit alors sa destination parmi les villes adjacentes.
   *  - **transition** (le donjon relie 2 hubs) → les 2 villes sont adjacentes ;
   *    la ville au-delà est marquée comme découverte (brouillard de guerre).
   *  - **impasse** (le donjon n'a qu'un seul hub) → seule la ville de départ
   *    est adjacente.
   *
   * `session.hubId` (le hub de base, services de ville) reste le hub de
   * départ : il ne sera mis à jour que quand l'équipe entrera réellement dans
   * une ville (`changeHub`).
   */
  private static async resolveExitPosition(
    session: DungeonSession
  ): Promise<{ nodeId: string; log: string | null }> {
    const fromHubId = session.hubId ?? "";
    const beyond = await WorldService.getHubBeyondDungeon(session.dungeon.id, fromHubId);
    // L'équipe reste sur le donjon (le cercle blanc de la mappemonde la suit).
    session.currentNodeId = session.dungeon.id;
    if (beyond) {
      // Transition : la ville au-delà est découverte (visible sur la carte).
      session.party.markHubVisited(beyond.id);
      return {
        nodeId: session.dungeon.id,
        log: `Vous êtes à la sortie de la zone. Vous pouvez rejoindre ${beyond.name} ou revenir en arrière.`,
      };
    }
    // Impasse : seule la ville de départ est adjacente.
    return {
      nodeId: session.dungeon.id,
      log: "Vous êtes à la sortie de la zone.",
    };
  }

  /**
   * Se repose au feu de camp courant (si l'équipe est dessus et qu'il est
   * encore utilisable).
   */
  static async restAtCampfire(sessionKey: string): Promise<any> {
    const session = this.require(sessionKey);
    if (!session.activeCampfire) {
      return { logs: ["Il n'y a pas de feu de camp ici."], state: this.serialize(session) };
    }
    const logs = CampfireService.restAtCampfire(session.party, session.activeCampfire);
    await this.persistAll(session);
    return { logs, state: this.serialize(session) };
  }

  /**
   * Utilise l'objet **« Bois »** : crée un feu de camp sur la **case courante**
   * (qui doit être **vide** : pas de feu, pas de coffre, pas de sortie/escalier)
   * et s'y repose immédiatement (50% PV max, 50% PM max, comme un feu de camp
   * normal). Le feu est consommé (il laisse une **bûche**, `isUsed = true`).
   *
   * Le bois est consommé depuis le **sac commun** de l'équipe. Le feu créé est
   * persisté dans le snapshot (`woodCampfires`) pour survivre à la reconnexion.
   */
  static async useWood(sessionKey: string): Promise<any> {
    const session = this.require(sessionKey);
    const zone = session.dungeon.levels[session.currentFloor];
    const pos = session.party.position;

    // La case doit être **vide** : pas de feu de camp, pas de coffre, pas de
    // sortie/escalier.
    if (zone.checkpoints.some((c) => c.position?.row === pos.row && c.position?.col === pos.col)) {
      return { logs: ["Il y a déjà un feu de camp sur cette case."], state: this.serialize(session) };
    }
    if (zone.chests.some((c) => c.position.row === pos.row && c.position.col === pos.col)) {
      return { logs: ["Il y a un coffre sur cette case."], state: this.serialize(session) };
    }
    if (pos.row === zone.endTile.row && pos.col === zone.endTile.col) {
      return { logs: ["On ne peut pas allumer un feu sur la sortie."], state: this.serialize(session) };
    }

    // Consomme un « Bois » du sac commun.
    const woodIdx = session.party.bag.findIndex((i) => i.name === "Bois");
    if (woodIdx === -1) {
      return { logs: ["Vous n'avez pas de bois dans le sac commun."], state: this.serialize(session) };
    }
    session.party.bag.splice(woodIdx, 1);

    // Crée le feu de camp sur la case courante et s'y repose (50% PV/MP max,
    // saute les morts). `rest()` marque le feu comme consommé (bûche).
    const camp = new Campfire("Feu de bois", 0.5, 0.5, { row: pos.row, col: pos.col });
    camp.createdByWood = true;
    camp.rest(session.party.members);
    zone.checkpoints.push(camp);
    session.woodCampfires.push({ row: pos.row, col: pos.col, floor: session.currentFloor });
    session.activeCampfire = camp;

    const logs = ["🪵 Vous allumez un feu de bois et vous reposez (+50% PV/MP)."];
    await this.persistAll(session);
    return { logs, state: this.serialize(session) };
  }

  /**
   * Ouvre le coffre sur la case courante (si l'équipe est dessus et qu'il est
   * encore fermé). Le contenu (1 à 3 objets) est tiré selon le type de coffre
   * et le niveau de la zone, puis ajouté au sac du premier membre (pot commun
   * de l'équipe, comme les achats du marchand).
   */
  static async openChest(sessionKey: string): Promise<any> {
    const session = this.require(sessionKey);
    const chest = session.activeChest;
    if (!chest) {
      return { logs: ["Il n'y a pas de coffre ici."], state: this.serialize(session) };
    }
    if (chest.opened) {
      return { logs: ["Ce coffre est déjà vide."], state: this.serialize(session) };
    }

    const zone = session.dungeon.levels[session.currentFloor];
    const items = ChestService.rollChestContents(chest.type, zone.zoneLevel);

    // Les objets rejoignent le **sac commun** de l'équipe (partagé par tous).
    for (const item of items) session.party.bag.push(item);

    // Marque le coffre comme ouvert (session courante).
    chest.opened = true;
    session.activeChest = chest;
    await this.persistAll(session);

    const label = chest.type === "rare" ? "rare" : "commun";
    const logs: string[] = [`Vous ouvrez un coffre ${label}.`];
    if (items.length === 0) {
      logs.push("Il est vide...");
    } else {
      logs.push(`L'équipe récupère : ${items.map((i) => i.name).join(", ")}.`);
    }
    return { logs, state: this.serialize(session) };
  }

  /**
   * Équipe une arme du sac en main droite/gauche **pendant** le donjon.
   *
   * Opère directement sur `session.party` (l'équipe en mémoire du donjon) —
   * et non via `PartyRoomService.equip` qui rechargerait la partie depuis la
   * DB (état **stale** pendant le donjon, risque d'écraser la progression).
   * Persiste ensuite pour conserver l'équipement.
   */
  static async equip(sessionKey: string, memberId: string, itemId: string, hand: "right" | "left"): Promise<any> {
    const session = this.require(sessionKey);
    const member = session.party.members.find((m) => m.id === memberId);
    if (!member) return { logs: ["Personnage introuvable."], state: this.serialize(session) };
    const item = session.party.bag.find((i) => i.id === itemId);
    if (!item || item.type !== "weapon") {
      return { logs: ["Cette arme n'est pas dans le sac commun."], state: this.serialize(session) };
    }
    session.party.bag.splice(session.party.bag.indexOf(item), 1);
    if (hand === "left" && !HubSerializer.canDualWield(member)) {
      return {
        logs: [`${member.name} ne peut pas s'équiper d'une arme en main gauche (passif Double Armement requis).`],
        state: this.serialize(session),
      };
    }
    try {
      const weapon = item as unknown as Weapon;
      if (hand === "right") member.equipRightHand(weapon);
      else member.equipLeftHand(weapon);
      session.party.migrateMemberBags();
      const logs = [`${member.name} équipe ${item.name} en main ${hand === "right" ? "droite" : "gauche"}.`];
      await this.persist(session);
      return { logs, state: this.serialize(session) };
    } catch (err: any) {
      return { logs: [err?.message ?? "Impossible d'équiper cette arme."], state: this.serialize(session) };
    }
  }

  /**
   * Utilise un consommable du sac sur un membre **pendant** le donjon (soin,
   * réanimation, statut). Opère sur `session.party` puis persiste.
   */
  static async useItem(sessionKey: string, memberId: string, itemId: string): Promise<any> {
    const session = this.require(sessionKey);
    const member = session.party.members.find((m) => m.id === memberId);
    if (!member) return { logs: ["Personnage introuvable."], state: this.serialize(session) };
    // Un personnage KO (0 PV) ne peut plus utiliser d'objet.
    if (member.isDead()) return { logs: [`${member.name} est KO et ne peut pas utiliser d'objet.`], state: this.serialize(session) };
    const item = session.party.bag.find((i) => i.id === itemId);
    if (!item || item.type !== "consumable") {
      return { logs: ["Cet objet n'est pas utilisable."], state: this.serialize(session) };
    }
    session.party.bag.splice(session.party.bag.indexOf(item), 1);
    const logs = member.useItem(item, member);
    await this.persist(session);
    return { logs, state: this.serialize(session) };
  }

  /**
   * Lance un **sort de soin** (cible alliée) **hors combat** pendant le donjon :
   * le lanceur (`casterId`) soigne/ranime un allié (`targetId`). Opère sur
   * l'équipe en mémoire de la session (pas sur la partie DB, stale ici).
   */
  static async castSpell(sessionKey: string, casterId: string, targetId: string, spellName: string): Promise<any> {
    const session = this.require(sessionKey);
    const caster = session.party.members.find((m) => m.id === casterId);
    const target = session.party.members.find((m) => m.id === targetId);
    if (!caster || !target) return { logs: ["Personnage introuvable."], state: this.serialize(session) };
    // Un personnage KO (0 PV) ne peut plus lancer de sort.
    if (caster.isDead()) return { logs: [`${caster.name} est KO et ne peut pas lancer de sort.`], state: this.serialize(session) };
    const logs = caster.castHealSpell(spellName, target);
    await this.persist(session);
    return { logs, state: this.serialize(session) };
  }

  /**
   * Quitte le donjon : persiste l'équipe (or, HP, zones complétées) et libère
   * la session. Le front revient à la mappemonde et resynchronise la ville.
   */
  static async exitDungeon(sessionKey: string): Promise<any> {
    const session = this.sessions.get(sessionKey);
    if (!session) return { logs: ["Vous n'êtes pas dans un donjon."] };

    // Sortie volontaire : l'équipe revient au hub de départ (la position dans
    // la zone n'a pas d'intérêt : chaque entrée régénère le donjon).
    session.currentNodeId = session.hubId ?? "";
    await this.persist(session, session.currentNodeId);
    await this.clearSnapshot(session);
    this.sessions.delete(sessionKey);
    return { logs: ["Vous quittez le donjon."] };
  }

  /** Renvoie l'état courant (ou null si aucune session). */
  static getState(sessionKey: string): any {
    const session = this.sessions.get(sessionKey);
    return session ? this.serialize(session) : null;
  }

  /** Renvoie la session d'exploration brute (non sérialisée), ou null.
   *  Utilisé par `CombatSessionService` pour restaurer un combat en cours
   *  (il a besoin du `zoneLevel` des monstres, pas de l'état sérialisé). */
  static getSession(sessionKey: string): DungeonSession | null {
    return this.sessions.get(sessionKey) ?? null;
  }

  /** Supprime la session d'exploration (ex. défaite → retour au hub). */
  static deleteSession(sessionKey: string): void {
    this.sessions.delete(sessionKey);
  }

  // ── Persistance de la session (reconnexion / redémarrage backend) ────────
  // Le donjon est régénéré depuis un **seed** : il suffit de persister le seed
  // + l'étage + l'état des coffres/feux de camp pour reconstruire exactement
  // la même grille à la reconnexion. La position et les tuiles visitées sont
  // déjà dans `party` (persistée séparément via `persist`).

  /** Snapshot sérialisable de la session d'exploration. */
  static serializeSnapshot(session: DungeonSession): any {
    const openedChests: { row: number; col: number; floor: number }[] = [];
    const usedCampfires: { row: number; col: number; floor: number }[] = [];
    session.dungeon.levels.forEach((zone, floor) => {
      for (const c of zone.chests) {
        if (c.opened) openedChests.push({ row: c.position.row, col: c.position.col, floor });
      }
      for (const c of zone.checkpoints) {
        if (c.isUsed && c.position) usedCampfires.push({ row: c.position.row, col: c.position.col, floor });
      }
    });
    return {
      dungeonId: session.dungeon.id,
      seed: session.dungeon.seed,
      currentFloor: session.currentFloor,
      completed: session.completed,
      openedChests,
      usedCampfires,
      // Feux de camp créés par l'objet « Bois » (hors grille régénérée).
      woodCampfires: session.woodCampfires ?? [],
      // Démons de zone vaincus (Phase B) — pour ne pas re-détecter un défi
      // déjà relevé après une reconnexion.
      defeatedDemonsThisZone: session.defeatedDemonsThisZone ?? [],
    };
  }

  /**
   * Restaure une session d'exploration depuis un snapshot persisté.
   * Reconstruit le donjon (même seed → même grille), réapplique l'étage,
   * l'état des coffres/feux de camp, et re-dérive le coffre/feu actif depuis
   * la position courante (déjà à jour dans `party`).
   */
  private static async restoreFromSnapshot(roomId: string, snapshot: any): Promise<DungeonSession | null> {
    try {
      const game = await PartyRoomService.loadParty(roomId);
      const session = await this.buildSession(game.party, game.questSystem, snapshot.dungeonId, snapshot.seed);
      session.storage = { kind: "room", roomId };
      session.hubId = game.currentHubId;
      session.currentNodeId = snapshot.dungeonId;
      session.difficulty = game.difficulty;
      session.currentFloor = snapshot.currentFloor ?? 0;
      session.completed = snapshot.completed ?? false;
      // Démons de zone vaincus (Phase B) — restaurés pour ne pas re-détecter
      // un défi déjà relevé.
      session.defeatedDemonsThisZone = snapshot.defeatedDemonsThisZone ?? [];
      // Réapplique l'état des coffres ouverts et feux de camp utilisés.
      for (const oc of snapshot.openedChests ?? []) {
        const zone = session.dungeon.levels[oc.floor];
        if (!zone) continue;
        const chest = zone.chests.find((c) => c.position.row === oc.row && c.position.col === oc.col);
        if (chest) chest.opened = true;
      }
      for (const uc of snapshot.usedCampfires ?? []) {
        const zone = session.dungeon.levels[uc.floor];
        if (!zone) continue;
        const camp = zone.checkpoints.find((c) => c.position?.row === uc.row && c.position?.col === uc.col);
        if (camp) camp.isUsed = true;
      }
      // Restaure les feux de camp créés par l'objet « Bois » (hors grille).
      session.woodCampfires = (snapshot.woodCampfires ?? []).map((w: any) => ({ ...w }));
      for (const w of session.woodCampfires) {
        const zone = session.dungeon.levels[w.floor];
        if (!zone) continue;
        // Ne recrée pas un feu déjà présent (idempotent).
        if (!zone.checkpoints.some((c) => c.position?.row === w.row && c.position?.col === w.col)) {
          zone.checkpoints.push(new Campfire("Feu de bois", 0.5, 0.5, { row: w.row, col: w.col }));
          const created = zone.checkpoints[zone.checkpoints.length - 1];
          created.isUsed = true;
          created.createdByWood = true;
        }
      }
      // Re-dérive le coffre/feu de camp actif depuis la position courante.
      const pos = session.party.position;
      const zone = session.dungeon.levels[session.currentFloor];
      if (zone) {
        session.activeChest = zone.chests.find((c) => c.position.row === pos.row && c.position.col === pos.col);
        session.activeCampfire = zone.checkpoints.find((c) => c.position?.row === pos.row && c.position?.col === pos.col);
      }
      return session;
    } catch {
      return null;
    }
  }

  /**
   * Garantit qu'une session d'exploration existe en mémoire pour la room.
   * Si elle est déjà en mémoire, la renvoie. Sinon, tente de la restaurer
   * depuis le snapshot persisté (reconnexion / redémarrage backend).
   * @returns l'état sérialisé, ou null si aucune session à restaurer.
   */
  static async ensureSession(roomId: string): Promise<any | null> {
    const existing = this.sessions.get(roomId);
    if (existing) return this.serialize(existing);
    const snapshot = await PartyRoomService.getExploration(roomId);
    if (!snapshot) return null;
    const session = await this.restoreFromSnapshot(roomId, snapshot);
    if (!session) return null;
    this.sessions.set(roomId, session);
    return this.serialize(session);
  }

  /** Persiste le snapshot de la session en base (mode room uniquement). */
  private static async persistSnapshot(session: DungeonSession): Promise<void> {
    if (session.storage.kind !== "room") return;
    await PartyRoomService.saveExploration(session.storage.roomId, this.serializeSnapshot(session));
  }

  /** Efface le snapshot persisté (sortie de donjon). */
  private static async clearSnapshot(session: DungeonSession): Promise<void> {
    if (session.storage.kind !== "room") return;
    await PartyRoomService.clearExploration(session.storage.roomId);
  }

  /** Persiste l'équipe + le snapshot (mode room). */
  private static async persistAll(session: DungeonSession): Promise<void> {
    await this.persist(session);
    await this.persistSnapshot(session);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private static require(sessionKey: string): DungeonSession {
    const session = this.sessions.get(sessionKey);
    if (!session) throw new Error("Vous n'êtes pas dans un donjon. Entrez-en d'abord un.");
    return session;
  }

  /**
   * Persiste l'équipe selon le backend (solo → PartyService, room →
   * PartyRoomService). `currentNodeId` = le nœud de position (défaut : le hub
   * de la session).
   */
  private static async persist(session: DungeonSession, currentNodeId?: string): Promise<void> {
    const nodeId = currentNodeId ?? session.currentNodeId ?? session.hubId ?? "";
    if (session.storage.kind === "room") {
      await PartyRoomService.saveParty(session.storage.roomId, session.party, session.questSystem, session.hubId ?? "", nodeId);
    } else {
      const game = await PartyService.loadGame(session.storage.playerId);
      if (game) {
        await PartyService.saveGame(session.storage.playerId, session.party, session.questSystem, session.hubId ?? game.currentHubId, nodeId);
      }
    }
  }

  /**
   * Persiste l'équipe après un combat (appelé par `CombatSessionService`).
   * Public car le service de combat a besoin de sauvegarder l'état de l'équipe
   * (PV, or, XP) une fois le combat terminé.
   */
  static async persistForCombat(session: DungeonSession): Promise<void> {
    await this.persist(session);
  }

  /**
   * Sérialise l'état d'exploration après un combat (appelé par
   * `CombatSessionService`) pour que le front reprenne le déplacement.
   */
  static serializeForCombat(session: DungeonSession): any {
    return this.serialize(session);
  }

  /** Une case est praticable si elle est dans les bornes et `true` dans la map. */
  private static isWalkable(zone: Zone, pos: Position): boolean {
    const map = zone.tileMap;
    if (!map || pos.row < 0 || pos.row >= map.length) return false;
    const row = map[pos.row];
    if (!row || pos.col < 0 || pos.col >= row.length) return false;
    return row[pos.col] === true;
  }

  /**
   * Résout un combat de rencontre (mode automatique).
   *
   * - **Victoire** : distribue le butin (gold + XP) aux survivants, log.
   * - **Défaite (easy)** : l'équipe est ramenée au début du donjon (étage 1,
   *   tuile de départ), les morts sont ressuscités à 1 PV.
   *
   * @returns l'objet à retourner au front (logs + état).
   */
  private static resolveCombat(
    session: DungeonSession,
    encounter: import("../../classes/Exploration/Encounter").Encounter
  ): { logs: string[]; state: any } {
    const battle = CombatService.buildBattle(encounter, session.party);
    const outcome = CombatService.runCombat(battle);

    const logs: string[] = [`⚔️ Rencontre : ${encounter.enemies.map((e) => e.name).join(", ")} !`];

    if (outcome.result === "victory") {
      const loot = LootEngine.distributeLoot(
        outcome.survivors,
        outcome.defeated,
        () => "strength"
      );
      logs.push(...loot.logs);
      logs.push("Victoire !");
      return { logs, state: this.serialize(session) };
    }

    // Défaite (ou draw) : retour au début du donjon, morts ressuscités à 1 PV.
    const firstZone = session.dungeon.levels[0];
    session.currentFloor = 0;
    session.party.moveTo({ ...firstZone.startTile });
    session.party.members.forEach((m) => {
      if (m.isDead()) m.currentHp = 1;
    });
    session.activeCampfire = undefined;
    session.activeChest = undefined;
    logs.push("Défaite… L'équipe est ramenée à l'entrée du donjon.");
    return { logs, state: this.serialize(session) };
  }

  /** Sérialise la session pour le front (grille + position + résumé équipe). */
  private static serialize(session: DungeonSession): any {
    const zone = session.dungeon.levels[session.currentFloor];
    const isLastFloor = session.currentFloor === session.dungeon.levels.length - 1;
    return {
      dungeonId: session.dungeon.id,
      dungeonName: session.dungeon.name,
      biome: session.dungeon.biome,
      zoneLevel: session.dungeon.zoneLevel,
      floor: session.currentFloor + 1,
      totalFloors: session.dungeon.levels.length,
      completed: session.completed,
      // Grille : true = praticable, false = mur.
      tileMap: zone.tileMap,
      position: session.party.position,
      startTile: zone.startTile,
      endTile: zone.endTile,
      // Type de la tuile d'arrivée : "door" (porte de sortie) ou "stairs"
      // (escalier vers l'étage suivant). Le front affiche 🚪 ou 🪜.
      exitType: isLastFloor ? "door" : "stairs",
      campfires: zone.checkpoints.map((c) => ({
        row: c.position?.row,
        col: c.position?.col,
        used: c.isUsed,
      })),
      // Coffres de l'étage (position + type + état d'ouverture).
      chests: zone.chests.map((c) => ({
        row: c.position.row,
        col: c.position.col,
        type: c.type,
        opened: c.opened,
      })),
      // Coffre sur la case courante (pour le bouton d'ouverture).
      activeChest: session.activeChest
        ? {
            row: session.activeChest.position.row,
            col: session.activeChest.position.col,
            type: session.activeChest.type,
            opened: session.activeChest.opened,
          }
        : null,
      visited: Array.from(session.party.visitedTiles).map((key) => {
        const [row, col] = key.split(",").map(Number);
        return { row, col };
      }),
      activeCampfire: session.activeCampfire
        ? {
            location: session.activeCampfire.locationName,
            used: session.activeCampfire.isUsed,
            restoredHp: session.activeCampfire.restoredHealthPercentage,
            restoredMp: session.activeCampfire.restoredManaPercentage,
          }
        : null,
      // Résumé de l'équipe (pour l'affichage dans la vue donjon).
      // Inclut le sac + l'équipement + les détails de fiche pour que la fiche
      // perso reste à jour **pendant** le donjon (coffres, équipement, soins).
      party: {
        gold: session.party.gold,
        // Sac commun de l'équipe (objets partagés, accessibles par tous).
        bag: session.party.bag.map((i: any) => ({
          id: i.id,
          name: i.name,
          type: i.type,
          description: i.description,
          purchasePrice: i.purchasePrice,
          weaponType: i.weaponType,
          mainStat: i.mainStat,
          subStat: i.subStat ?? null,
          weaponStat: i.weaponStat,
          weaponSubStat: i.weaponSubStat ?? 0,
          range: i.range ?? 1,
          element: i.element,
          status: i.status ? i.status.name : null,
        })),
        members: session.party.members.map((m) => ({
          id: m.id,
          name: m.name,
          job: m.job.name,
          level: m.characterLevel,
          ...LootEngine.xpInfo(m),
          hp: m.currentHp,
          maxHp: m.maxHp,
          mp: m.currentMp,
          maxMp: m.maxMp,
          isDead: m.isDead(),
          // Fiche perso (détails) — mêmes champs que la sérialisation de ville.
          ownerId: m.ownerId ?? null,
          avatar: m.avatar ?? null,
          equippableWeapons: m.job.weapons,
          canDualWield: HubSerializer.canDualWield(m),
          stats: m.stats,
          skills: m.getAvailableAbilities().map((s) => ({
            name: s.name,
            apCost: s.apCost,
            mpCost: s.mpCost,
            target: s.target,
            type: s.type,
            range: s.range,
            description: s.description,
          })),
          spells: m.getAvailableSpells().map((s) => ({
            name: s.name,
            mpCost: s.mpCost,
            hpCost: s.hpCost,
            target: s.target,
            element: s.element,
            description: s.description,
          })),
          rightHand: m.rightHandWeapon ? HubSerializer.serializeWeapon(m.rightHandWeapon) : null,
          leftHand: m.leftHandWeapon ? HubSerializer.serializeWeapon(m.leftHandWeapon) : null,
          bag: m.bag.map((i: any) => ({
            id: i.id,
            name: i.name,
            type: i.type,
            description: i.description,
            purchasePrice: i.purchasePrice,
            weaponType: i.weaponType,
            mainStat: i.mainStat,
            subStat: i.subStat ?? null,
            weaponStat: i.weaponStat,
            weaponSubStat: i.weaponSubStat ?? 0,
            range: i.range ?? 1,
            element: i.element,
            status: i.status ? i.status.name : null,
          })),
        })),
      },
    };
  }
}

/** État interne d'une session de donjon. */
export interface DungeonSession {
  party: Party;
  questSystem: QuestSystem;
  dungeon: Dungeon;
  currentFloor: number;
  activeCampfire?: Campfire;
  /** Coffre sur la case courante (pour le bouton d'ouverture). */
  activeChest?: Chest;
  completed: boolean;
  /** Backend de persistance (solo ou room). */
  storage: DungeonStorage;
  /** Hub d'origine (celui d'où l'on est entré dans la zone). */
  hubId?: string;
  /** Nœud de position courant (l'id de la zone explorée). */
  currentNodeId?: string;
  /** Difficulté de la partie (easy/hard) — pour la gestion de la défaite. */
  difficulty?: "easy" | "hard";
  /**
   * Feux de camp **créés par l'objet « Bois »** (position + étage). Ils ne
   * font pas partie de la grille régénérée (seed) → persistés séparément dans
   * le snapshot pour survivre à la reconnexion.
   */
  woodCampfires: { row: number; col: number; floor: number }[];
  /**
   * Démons de zone **déjà vaincus** dans cette session (Phase B). Un démon
   * vaincu ne se re-détecte plus sur sa case (le défi est optionnel : on peut
   * le rebattre en quittant et re-entrant dans la zone). Persisté dans le
   * snapshot pour survivre à la reconnexion.
   */
  defeatedDemonsThisZone: string[];
}
