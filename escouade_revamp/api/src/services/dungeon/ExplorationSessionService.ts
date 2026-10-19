import { Party } from "../../classes/Exploration/Party";
import { QuestSystem } from "../../classes/Progression/QuestSystem";
import { Dungeon } from "../../classes/World/Dungeon";
import { Zone } from "../../classes/World/Zone";
import { Campfire } from "../../classes/Progression/Campfire";
import { Position } from "../../classes/Types";
import { WorldService } from "../World/WorldService";
import { PartyService } from "../Hub/PartyService";
import { PartyRoomService } from "../Hub/PartyRoomService";
import { ZoneFactory } from "../factory/ZoneFactory";
import { CampfireService } from "./CampfireService";

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
type DungeonStorage =
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
    const session = await this.buildSession(game.party, game.questSystem, dungeonId);
    session.storage = { kind: "player", playerId };
    this.sessions.set(playerId, session);
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
    const session = await this.buildSession(game.party, game.questSystem, dungeonId);
    session.storage = { kind: "room", roomId };
    session.hubId = game.currentHubId;
    this.sessions.set(roomId, session);
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
    const floors = 2 + level;

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

    // Détection de feu de camp sur la case.
    const camp = zone.checkpoints.find(
      (c) => c.position?.row === to.row && c.position?.col === to.col
    );
    session.activeCampfire = camp;

    // Atteinte de la tuile d'arrivée (escalier ou porte de sortie).
    if (to.row === zone.endTile.row && to.col === zone.endTile.col) {
      const isLastFloor = session.currentFloor === session.dungeon.levels.length - 1;
      if (!isLastFloor) {
        // Escalier → étage suivant.
        session.currentFloor++;
        const nextZone = session.dungeon.levels[session.currentFloor];
        session.party.moveTo({ ...nextZone.startTile });
        session.activeCampfire = undefined;
        return {
          logs: [`Vous descendez à l'étage ${session.currentFloor + 1}.`],
          state: this.serialize(session),
        };
      }
      // Porte de sortie (dernier étage) → donjon terminé + **auto-sortie**.
      session.completed = true;
      session.party.completeZone(session.dungeon.id);
      await this.persist(session);
      this.sessions.delete(sessionKey);
      return {
        logs: ["Vous avez atteint la sortie du donjon ! Zone terminée."],
        state: this.serialize(session),
        exited: true,
      };
    }

    return { state: this.serialize(session) };
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
   * Quitte le donjon : persiste l'équipe (or, HP, zones complétées) et libère
   * la session. Le front revient à la mappemonde et resynchronise la ville.
   */
  static async exitDungeon(sessionKey: string): Promise<any> {
    const session = this.sessions.get(sessionKey);
    if (!session) return { logs: ["Vous n'êtes pas dans un donjon."] };

    // Persiste l'équipe (la position dans la zone n'a pas d'intérêt : chaque
    // entrée régénère le donjon).
    await this.persist(session);
    this.sessions.delete(sessionKey);
    return { logs: ["Vous quittez le donjon."] };
  }

  /** Renvoie l'état courant (ou null si aucune session). */
  static getState(sessionKey: string): any {
    const session = this.sessions.get(sessionKey);
    return session ? this.serialize(session) : null;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private static require(sessionKey: string): DungeonSession {
    const session = this.sessions.get(sessionKey);
    if (!session) throw new Error("Vous n'êtes pas dans un donjon. Entrez-en d'abord un.");
    return session;
  }

  /** Persiste l'équipe selon le backend (solo → PartyService, room → PartyRoomService). */
  private static async persist(session: DungeonSession): Promise<void> {
    if (session.storage.kind === "room") {
      await PartyRoomService.saveParty(session.storage.roomId, session.party, session.questSystem, session.hubId ?? "");
    } else {
      const game = await PartyService.loadGame(session.storage.playerId);
      if (game) {
        await PartyService.saveGame(session.storage.playerId, session.party, session.questSystem, game.currentHubId);
      }
    }
  }

  /** Une case est praticable si elle est dans les bornes et `true` dans la map. */
  private static isWalkable(zone: Zone, pos: Position): boolean {
    const map = zone.tileMap;
    if (!map || pos.row < 0 || pos.row >= map.length) return false;
    const row = map[pos.row];
    if (!row || pos.col < 0 || pos.col >= row.length) return false;
    return row[pos.col] === true;
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
interface DungeonSession {
  party: Party;
  questSystem: QuestSystem;
  dungeon: Dungeon;
  currentFloor: number;
  activeCampfire?: Campfire;
  completed: boolean;
  /** Backend de persistance (solo ou room). */
  storage: DungeonStorage;
  /** Hub courant (pour la persistance en mode room). */
  hubId?: string;
}
