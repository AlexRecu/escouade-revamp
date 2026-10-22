import { Party } from "../../classes/Exploration/Party";
import { QuestSystem } from "../../classes/Progression/QuestSystem";
import { Dungeon } from "../../classes/World/Dungeon";
import { Zone } from "../../classes/World/Zone";
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

/** Direction de déplacement (4 directions, pas de diagonale). */
export type Direction = "north" | "south" | "east" | "west";

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
    this.sessions.set(roomId, session);
    // Persiste la position (nœud = la zone) pour que le cercle blanc la suive.
    await PartyRoomService.setCurrentNodeId(roomId, dungeonId);
    return this.serialize(session);
  }

  /**
   * Construit la session de donjon (régénération de la grille) à partir d'une
   * équipe. Commun au mode solo et au mode room.
   */
  private static async buildSession(
    party: Party,
    questSystem: QuestSystem,
    dungeonId: string
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

    // Régénération : un nouveau seed à chaque entrée → nouvelle grille.
    const seed = Math.floor(Math.random() * 1_000_000);
    const levels: Zone[] = [];
    for (let f = 1; f <= floors; f++) {
      levels.push(
        ZoneFactory.create({
          name: `${node.name} E.${f}`,
          type: node.biome,
          zoneLevel: level,
          seed: seed + f, // seed distinct par étage (grilles différentes)
          parentDungeonName: node.name,
          floor: f,
        })
      );
    }
    const dungeon = new Dungeon(node.id, node.name, level, node.biome, levels, seed);

    // Position de départ : la tuile de départ du 1er étage.
    const firstZone = levels[0];
    party.moveTo({ ...firstZone.startTile });

    return {
      party,
      questSystem,
      dungeon,
      currentFloor: 0,
      activeCampfire: undefined,
      completed: false,
      storage: { kind: "player", playerId: "" }, // rempli par l'appelant
    };
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

    // **Rencontre aléatoire** : à chaque pas, le moteur de rencontre décide si
    // un combat se déclenche (formule du livret : aléatoire < P, P par biome).
    // Si rencontre → on démarre un **combat interactif** (le front bascule sur
    // la vue de combat et pilote le tour par tour).
    const encounter = EncounterEngine.roll(zone, session.party);
    if (encounter) {
      const combatState = CombatSessionService.startCombat(sessionKey, session, encounter);
      return { logs: ["⚔️ Rencontre !"], state: this.serialize(session), combat: combatState };
    }

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
        return {
          logs: [`Vous descendez à l'étage ${session.currentFloor + 1}.`],
          state: this.serialize(session),
        };
      }
      // Porte de sortie (dernier étage) → donjon terminé + **auto-sortie**.
      session.completed = true;
      session.party.completeZone(session.dungeon.id);
      // **Position** : une zone de transition mène au hub au-delà ; une impasse
      // ramène l'équipe au hub de départ.
      const exit = await this.resolveExitPosition(session);
      await this.persist(session, exit.nodeId);
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

    // Les objets rejoignent le sac du premier membre (pot commun de l'équipe).
    const holder = session.party.members[0];
    if (holder) {
      for (const item of items) holder.bag.push(item);
    }

    // Marque le coffre comme ouvert (session courante).
    chest.opened = true;
    session.activeChest = chest;

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
    this.sessions.delete(sessionKey);
    return { logs: ["Vous quittez le donjon."] };
  }

  /** Renvoie l'état courant (ou null si aucune session). */
  static getState(sessionKey: string): any {
    const session = this.sessions.get(sessionKey);
    return session ? this.serialize(session) : null;
  }

  /** Supprime la session d'exploration (ex. défaite → retour au hub). */
  static deleteSession(sessionKey: string): void {
    this.sessions.delete(sessionKey);
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
      party: {
        gold: session.party.gold,
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
}
