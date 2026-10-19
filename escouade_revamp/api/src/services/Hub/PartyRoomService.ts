import { PartyRoomModel, PartyRoomDocument, RoomMember } from "../../models/partyRoom.model";
import { PlayerModel } from "../../models/player.model";
import { HubState } from "../../classes/World/HubState";
import { Party } from "../../classes/Exploration/Party";
import { QuestSystem } from "../../classes/Progression/QuestSystem";
import { Character } from "../../classes/UnitTypes/Character";
import { Item } from "../../classes/Items/Item";
import { Weapon } from "../../classes/Items/Weapon";
import { Dungeon } from "../../classes/World/Dungeon";
import { HubService } from "./HubService";
import { PartyService } from "./PartyService";
import { HubSerializer } from "./HubSerializer";
import { WorldService } from "../World/WorldService";
import { IdGenerator } from "../../utils/IdGeneratorUtils";
import { getSpawnRatesForZoneType } from "../../utils/RandomUtils";

/**
 * Service de **partie partagée** (mode multi-joueurs temps réel).
 *
 * Une `PartyRoom` est une partie commune que plusieurs joueurs rejoignent :
 * ils partagent la même équipe, le même système de quêtes et la même ville
 * courante. Quand un membre agit, l'état est persisté ici et **diffusé** à
 * tous les membres connectés (le broadcast est fait dans `socket.ts` via
 * `io.to(roomId)`).
 *
 * Ce service est le point d'entrée des handlers socket `party:*` (voir
 * `socket.ts`). Il réutilise la logique métier de ville (`HubService`) et la
 * sérialisation partagée (`HubSerializer`) — le format renvoyé au front est
 * identique au mode solo, auquel on ajoute un bloc `room` (nom, hôte, membres).
 *
 * Le modèle est **injectable** (`PartyRoomService.model`) pour mocker la base
 * en test (pas de MongoDB requis).
 */
/** Résumé d'une room pour le lobby (sans l'état de jeu complet). */
export type RoomSummary = {
  roomId: string;
  name: string;
  hostName: string;
  isPublic: boolean;
  maxPlayers: number;
  playerCount: number;
  memberCount: number;
  members: { username: string; isSpectator: boolean }[];
};

export class PartyRoomService {
  /** Modèle injectable (défaut `PartyRoomModel`) — à mocker en test. */
  static model: typeof PartyRoomModel = PartyRoomModel;

  /**
   * Crée une nouvelle partie (l'appelant en devient l'hôte).
   *
   * @param hostId   id du joueur hôte.
   * @param hostName pseudo de l'hôte.
   * @param name     nom de la partie.
   * @param isPublic visible dans le lobby (rejoignable).
   * @param maxPlayers nombre max de joueurs (hors spectateurs).
   */
  static async create(
    hostId: string,
    hostName: string,
    name: string,
    isPublic = true,
    maxPlayers = 4
  ): Promise<PartyRoomDocument> {
    const game = await PartyService.createStarterGame();
    const roomId = IdGenerator.generate("Room");
    const members: RoomMember[] = [
      { playerId: hostId as any, username: hostName, isSpectator: false },
    ];
    const doc = await this.model.create({
      roomId,
      name: name || `${hostName}'s party`,
      hostId,
      hostName,
      members,
      party: game.party.toSerialized(),
      questSystem: game.questSystem.toSerialized(),
      currentHubId: game.currentHubId,
      isPublic,
      maxPlayers,
      savedAt: new Date(),
    });
    await this.setPlayerRoom(hostId, roomId);
    return doc;
  }

  /**
   * Liste les parties **publiques** (pour le lobby). Renvoie des résumés
   * légers (pas l'état de jeu complet).
   */
  static async list(): Promise<RoomSummary[]> {
    const rooms = await this.model.find({ isPublic: true }).sort({ createdAt: -1 });
    return rooms.map((r) => this.summarize(r));
  }

  /**
   * Rejoint une partie existante.
   *
   * @param isSpectator si true, le joueur rejoint en **mode spectateur**
   *   (consultation uniquement, ne compte pas dans `maxPlayers`).
   */
  static async join(
    playerId: string,
    username: string,
    roomId: string,
    isSpectator = false
  ): Promise<PartyRoomDocument> {
    const room = await this.model.findOne({ roomId });
    if (!room) throw new Error("Partie introuvable.");

    // Déjà dans cette room ? On met à jour le mode (spectateur ↔ joueur).
    const existing = room.members.find((m) => m.playerId.toString() === playerId);
    if (existing) {
      existing.isSpectator = isSpectator;
    } else {
      // Limite de joueurs (hors spectateurs).
      const playerCount = room.members.filter((m) => !m.isSpectator).length;
      if (!isSpectator && playerCount >= room.maxPlayers) {
        throw new Error("Cette partie est pleine.");
      }
      room.members.push({ playerId: playerId as any, username, isSpectator });
    }
    room.savedAt = new Date();
    await room.save();
    await this.setPlayerRoom(playerId, roomId);
    return room;
  }

  /**
   * Quitte une partie. Si l'hôte quitte : l'hôtiat est transféré au premier
   * membre restant, ou la room est supprimée si elle devient vide.
   */
  static async leave(playerId: string, roomId: string): Promise<void> {
    const room = await this.model.findOne({ roomId });
    if (!room) return;

    room.members = room.members.filter((m) => m.playerId.toString() !== playerId);

    if (room.members.length === 0) {
      await this.model.deleteOne({ roomId });
    } else if (room.hostId.toString() === playerId) {
      // Transfert d'hôtiat au premier membre restant.
      const newHost = room.members[0];
      room.hostId = newHost.playerId;
      room.hostName = newHost.username;
    }
    room.savedAt = new Date();
    if (room.members.length > 0) await room.save();
    await this.setPlayerRoom(playerId, null);
  }

  /**
   * Renvoie la room courante d'un joueur (ou null).
   */
  static async roomForPlayer(playerId: string): Promise<PartyRoomDocument | null> {
    return this.model.findOne({ "members.playerId": playerId });
  }

  /**
   * Construit le `HubState` (état de ville) d'une room depuis son état persisté.
   */
  static async getHubState(roomId: string): Promise<{ room: PartyRoomDocument; session: HubState }> {
    const room = await this.model.findOne({ roomId });
    if (!room) throw new Error("Partie introuvable.");
    const { party, questSystem } = PartyService.deserialize(room.party, room.questSystem, room.currentHubId);
    const hub = await WorldService.getHubById(room.currentHubId);
    if (!hub) throw new Error(`Hub introuvable : ${room.currentHubId}`);
    return { room, session: new HubState(hub, party, questSystem) };
  }

  /** Persiste l'état de jeu d'une room (party + quêtes + hub courant). */
  private static async persistRoom(roomId: string, session: HubState): Promise<void> {
    await this.saveParty(roomId, session.party, session.questSystem, session.hub.id);
  }

  /**
   * Charge l'état de jeu d'une room (party + quêtes + hub courant).
   * Public : réutilisé par `ExplorationSessionService` (donjon partagé).
   */
  static async loadParty(roomId: string): Promise<{
    party: Party;
    questSystem: QuestSystem;
    currentHubId: string;
  }> {
    const room = await this.model.findOne({ roomId });
    if (!room) throw new Error("Partie introuvable.");
    return PartyService.deserialize(room.party, room.questSystem, room.currentHubId);
  }

  /**
   * Sauvegarde l'état de jeu d'une room (party + quêtes + hub courant).
   * Public : réutilisé par `ExplorationSessionService` (donjon partagé).
   */
  static async saveParty(
    roomId: string,
    party: Party,
    questSystem: QuestSystem,
    currentHubId: string
  ): Promise<void> {
    await this.model.findOneAndUpdate(
      { roomId },
      {
        $set: {
          party: party.toSerialized(),
          questSystem: questSystem.toSerialized(),
          currentHubId,
          savedAt: new Date(),
        },
      }
    );
  }

  // ── Actions de ville (délégation à HubService) ───────────────────────────
  // Toutes indexées par `roomId` : l'équipe est **partagée**, donc une action
  // de n'importe quel membre mute l'état commun (diffusé à tous par le socket).

  static async buy(roomId: string, itemName: string): Promise<{ logs: string[]; state: any }> {
    const { room, session } = await this.getHubState(roomId);
    const buyer = session.party.members[0];
    const logs = HubService.buyConsumable(session, buyer, itemName);
    await this.persistRoom(roomId, session);
    return { logs, state: this.serializeRoom(room, session) };
  }

  static async sell(roomId: string, itemId: string): Promise<{ logs: string[]; state: any }> {
    const { room, session } = await this.getHubState(roomId);
    const seller = session.party.members[0];
    const item = seller.bag.find((i) => i.id === itemId);
    if (!item) return { logs: ["Objet introuvable dans le sac."], state: this.serializeRoom(room, session) };
    const logs = HubService.sellItem(session, seller, item);
    await this.persistRoom(roomId, session);
    return { logs, state: this.serializeRoom(room, session) };
  }

  static async equip(
    roomId: string,
    memberId: string,
    itemId: string,
    hand: "right" | "left"
  ): Promise<{ logs: string[]; state: any }> {
    const { room, session } = await this.getHubState(roomId);
    const member = session.party.members.find((m) => m.id === memberId);
    if (!member) return { logs: ["Personnage introuvable."], state: this.serializeRoom(room, session) };
    const item = member.bag.find((i) => i.id === itemId);
    if (!item || item.type !== "weapon") {
      return { logs: ["Cette arme n'est pas dans le sac."], state: this.serializeRoom(room, session) };
    }
    if (hand === "left" && !HubSerializer.canDualWield(member)) {
      return {
        logs: [`${member.name} ne peut pas s'équiper d'une arme en main gauche (passif Double Armement requis).`],
        state: this.serializeRoom(room, session),
      };
    }
    try {
      const weapon = item as unknown as Weapon;
      if (hand === "right") member.equipRightHand(weapon);
      else member.equipLeftHand(weapon);
      const logs = [`${member.name} équipe ${item.name} en main ${hand === "right" ? "droite" : "gauche"}.`];
      await this.persistRoom(roomId, session);
      return { logs, state: this.serializeRoom(room, session) };
    } catch (err: any) {
      return { logs: [err?.message ?? "Impossible d'équiper cette arme."], state: this.serializeRoom(room, session) };
    }
  }

  static async rest(roomId: string): Promise<{ logs: string[]; state: any }> {
    const { room, session } = await this.getHubState(roomId);
    const logs: string[] = [];
    for (const member of session.party.members) {
      if (!member.isDead()) logs.push(...HubService.restAtInn(session, member));
    }
    await this.persistRoom(roomId, session);
    return { logs, state: this.serializeRoom(room, session) };
  }

  static async sanctuary(roomId: string, targetId: string): Promise<{ logs: string[]; state: any }> {
    const { room, session } = await this.getHubState(roomId);
    const payer = session.party.members[0];
    const target = session.party.members.find((m) => m.id === targetId);
    if (!target) return { logs: ["Allié introuvable."], state: this.serializeRoom(room, session) };
    const logs = HubService.useSanctuary(session, payer, target);
    await this.persistRoom(roomId, session);
    return { logs, state: this.serializeRoom(room, session) };
  }

  static async questBoard(roomId: string): Promise<{ quests: any[] }> {
    const { session } = await this.getHubState(roomId);
    const recruited = HubSerializer.recruitedDemons(session.party);
    const quests = HubService.questBoard(session, recruited);
    return { quests: quests.map((q) => HubSerializer.serializeQuest(q)) };
  }

  static async acceptQuest(roomId: string, questId: string): Promise<{ logs: string[]; state: any }> {
    const { room, session } = await this.getHubState(roomId);
    const recruited = HubSerializer.recruitedDemons(session.party);
    const quest = HubService.acceptQuest(session, questId, recruited);
    const logs = quest ? [`Quête acceptée : ${quest.name}.`] : ["Cette quête n'est pas disponible."];
    await this.persistRoom(roomId, session);
    return { logs, state: this.serializeRoom(room, session) };
  }

  static async changeHub(roomId: string, hubId: string): Promise<any> {
    const { room, session } = await this.getHubState(roomId);
    const hub = await WorldService.getHubById(hubId);
    if (!hub) throw new Error(`Hub introuvable : ${hubId}`);
    session.hub = hub;
    await this.persistRoom(roomId, session);
    return this.serializeRoom(room, session);
  }

  static async completeZone(roomId: string, zoneId: string): Promise<any> {
    const { room, session } = await this.getHubState(roomId);
    session.party.completeZone(zoneId);
    const world = await WorldService.getWorld();
    const dungeon = world.nodes.find((n) => n.id === zoneId);
    if (dungeon instanceof Dungeon) {
      for (const s of getSpawnRatesForZoneType(dungeon.biome)) {
        session.party.markMonsterSeen(s.monsterName);
      }
    }
    await this.persistRoom(roomId, session);
    return this.serializeRoom(room, session);
  }

  // ── Sérialisation ────────────────────────────────────────────────────────

  /** Résumé léger d'une room (pour le lobby). */
  private static summarize(room: PartyRoomDocument): RoomSummary {
    return {
      roomId: room.roomId,
      name: room.name,
      hostName: room.hostName,
      isPublic: room.isPublic,
      maxPlayers: room.maxPlayers,
      playerCount: room.members.filter((m) => !m.isSpectator).length,
      memberCount: room.members.length,
      members: room.members.map((m) => ({ username: m.username, isSpectator: m.isSpectator })),
    };
  }

  /**
   * Sérialise l'état complet d'une room pour le front : l'état de ville
   * (identique au mode solo) + un bloc `room` (nom, hôte, membres, public).
   */
  static serializeRoom(room: PartyRoomDocument, session: HubState): any {
    const base = HubSerializer.serializeHubState(session);
    base.room = {
      roomId: room.roomId,
      name: room.name,
      hostName: room.hostName,
      isPublic: room.isPublic,
      maxPlayers: room.maxPlayers,
      members: room.members.map((m) => ({
        playerId: m.playerId.toString(),
        username: m.username,
        isSpectator: m.isSpectator,
      })),
    };
    return base;
  }

  /** Met à jour le `currentRoomId` du joueur (null = hors partie). */
  private static async setPlayerRoom(playerId: string, roomId: string | null): Promise<void> {
    try {
      await PlayerModel.findByIdAndUpdate(playerId, { $set: { currentRoomId: roomId } });
    } catch {
      // Non bloquant : le champ est optionnel.
    }
  }
}
