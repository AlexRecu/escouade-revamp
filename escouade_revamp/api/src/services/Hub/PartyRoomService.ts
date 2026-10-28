import { PartyRoomModel, PartyRoomDocument, RoomMember } from "../../models/partyRoom.model";
import { PlayerModel } from "../../models/player.model";
import { HubState } from "../../classes/World/HubState";
import { Party } from "../../classes/Exploration/Party";
import { QuestSystem } from "../../classes/Progression/QuestSystem";
import { Character } from "../../classes/UnitTypes/Character";
import { Item } from "../../classes/Items/Item";
import { Weapon } from "../../classes/Items/Weapon";
import { Dungeon } from "../../classes/World/Dungeon";
import { Hub } from "../../classes/World/Hub";
import { HubService } from "./HubService";
import { PartyService } from "./PartyService";
import { HubSerializer } from "./HubSerializer";
import { WorldService } from "../World/WorldService";
import { JobFactory } from "../factory/JobFactory";
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
  hostId: string;
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
    maxPlayers = 4,
    difficulty: "easy" | "hard" = "easy"
  ): Promise<PartyRoomDocument> {
    // Équipe **vide** : chaque joueur crée son propre personnage (voir
    // `createCharacter`). L'équipe se constitue au fil des créations.
    const game = await PartyService.createEmptyGame();
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
      currentNodeId: game.currentNodeId,
      difficulty,
      isPublic,
      maxPlayers,
      savedAt: new Date(),
    });
    await this.setPlayerRoom(hostId, roomId);
    return doc;
  }

  /**
   * Crée le **personnage** d'un joueur dans une partie.
   *
   * Règles (confirmées) : le joueur choisit son **job**, répartit **20 points**
   * de stats (chaque stat entre 0 et 12, **en plus** des stats de base du job)
   * et choisit un **avatar** (token) parmi ceux de sa classe. Le personnage est
   * ajouté à l'équipe partagée de la room, avec `ownerId` = le joueur (pour que
   * le front identifie « son » perso) et `avatar` = le token choisi.
   *
   * Un joueur ne peut avoir **qu'un seul** personnage par room (sinon erreur).
   *
   * @returns l'état sérialisé de la room (diffusé à tous par le socket).
   */
  static async createCharacter(
    roomId: string,
    playerId: string,
    data: { name: string; job: string; stats: Record<string, number>; avatar?: string | null }
  ): Promise<{ logs: string[]; state: any }> {
    const room = await this.model.findOne({ roomId });
    if (!room) throw new Error("Partie introuvable.");

    // Le joueur doit être membre de la room (et non spectateur).
    const member = room.members.find((m) => m.playerId.toString() === playerId);
    if (!member) throw new Error("Vous n'êtes pas dans cette partie.");
    if (member.isSpectator) throw new Error("Un spectateur ne peut pas créer de personnage.");

    const { party, questSystem } = PartyService.deserialize(room.party, room.questSystem, room.currentHubId);

    // Un seul personnage par joueur.
    if (party.members.some((m) => m.ownerId === playerId)) {
      throw new Error("Vous avez déjà un personnage dans cette partie.");
    }

    // Fabrique le job + applique les stats de base + les points du joueur.
    // Règle du livret : **1 point à répartir par niveau**. Au niveau 1, le
    // joueur dispose donc de 1 point à placer dans la stat de son choix.
    const job = JobFactory.fromSerialized({ name: data.job });
    const budget = job.jobLevel; // 1 au niveau 1
    const stats = { ...job.defaultStats };
    let allocated = 0;
    for (const key of Object.keys(stats) as (keyof typeof stats)[]) {
      const bonus = Math.max(0, Math.floor(Number(data.stats?.[key]) || 0));
      stats[key] = Math.max(0, Math.min(12, stats[key] + bonus));
      allocated += bonus;
    }
    if (allocated !== budget) {
      throw new Error(`Vous devez répartir exactement ${budget} point (actuellement ${allocated}).`);
    }

    // Crée le perso avec le job (armes de départ + bouclier Guerrier gérés par
    // le constructeur), puis applique les **stats custom** (base + bonus) et
    // recalcule HP/MP — même approche que `CharacterFactory.fromSerialized`.
    const char = new Character(
      IdGenerator.generate("Char"),
      data.name || member.username,
      "Hero",
      { row: 7, col: 7 },
      job,
      null,
      null
    );
    char.stats = stats;
    char.maxHp = stats.endurance * 2 + 10;
    char.currentHp = char.maxHp;
    char.maxMp = stats.mana + 10;
    char.currentMp = char.maxMp;
    char.ownerId = playerId;
    char.avatar = data.avatar || null;
    char.gold = job.gold; // or de classe

    party.members.push(char);
    // Bonus de départ : 100 or par personnage (cohérent avec le mode solo,
    // où `party.gold = 100 × nb de membres`). S'ajoute à l'or de classe.
    party.gold += 100;
    party.consolidateGold(); // migre l'or de classe dans le pot commun

    room.party = party.toSerialized();
    room.questSystem = questSystem.toSerialized();
    room.savedAt = new Date();
    await room.save();

    const session = new HubState(
      (await WorldService.getHubById(room.currentHubId))!,
      party,
      questSystem
    );
    return {
      logs: [`${char.name} (${job.name}) rejoint la partie.`],
      state: this.serializeRoom(room, session),
    };
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
      // Room vide (reprise d'une partie abandonnée) : le premier à rejoindre
      // (hors spectateur) redevient l'hôte.
      if (room.members.length === 1 && !isSpectator) {
        room.hostId = playerId as any;
        room.hostName = username;
      }
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

    if (room.members.length > 0 && room.hostId.toString() === playerId) {
      // Transfert d'hôtiat au premier membre restant.
      const newHost = room.members[0];
      room.hostId = newHost.playerId;
      room.hostName = newHost.username;
    }
    // La room est **conservée** même quand elle devient vide : l'état de jeu
    // (personnages, or, progression) est ainsi préservé et le joueur peut
    // reprendre sa partie depuis le lobby. Les rooms vides trop anciennes sont
    // nettoyées périodiquement (voir `cleanupEmptyRooms`).
    room.savedAt = new Date();
    await room.save();
    await this.setPlayerRoom(playerId, null);
  }

  /**
   * Sauvegarde explicite de la partie (bouton disquette). L'état est déjà
   * persisté à chaque action ; cette méthode force une ré-persistance (met à
   * jour `savedAt`) et renvoie une confirmation au joueur.
   */
  static async save(roomId: string): Promise<{ logs: string[] }> {
    const room = await this.model.findOne({ roomId });
    if (!room) throw new Error("Partie introuvable.");
    room.savedAt = new Date();
    await room.save();
    return { logs: ["💾 Partie sauvegardée."] };
  }

  /**
   * Supprime définitivement la partie (bouton poubelle). **Seul l'hôte** peut
   * la supprimer. La room est retirée de la base et le `currentRoomId` de tous
   * ses membres est effacé (sinon ils seraient ré-attachés à une room
   * inexistante à la reconnexion).
   */
  static async deleteRoom(playerId: string, roomId: string): Promise<void> {
    const room = await this.model.findOne({ roomId });
    if (!room) return;
    if (room.hostId.toString() !== playerId) {
      throw new Error("Seul l'hôte de la partie peut la supprimer.");
    }
    const memberIds = room.members.map((m) => m.playerId);
    await this.model.deleteOne({ roomId });
    if (memberIds.length > 0) {
      await PlayerModel.updateMany(
        { _id: { $in: memberIds }, currentRoomId: roomId },
        { $set: { currentRoomId: null } }
      );
    }
  }

  /**
   * Supprime une room **sans vérifier l'hôte** (game over en mode difficile :
   * l'équipe est anéantie, la partie est terminée et supprimée de la
   * persistance). Vide aussi le `currentRoomId` des membres.
   */
  static async deleteRoomById(roomId: string): Promise<void> {
    const room = await this.model.findOne({ roomId });
    if (!room) return;
    const memberIds = room.members.map((m) => m.playerId);
    await this.model.deleteOne({ roomId });
    if (memberIds.length > 0) {
      await PlayerModel.updateMany(
        { _id: { $in: memberIds }, currentRoomId: roomId },
        { $set: { currentRoomId: null } }
      );
    }
  }

  /**
   * Nettoie les rooms **vides** trop anciennes (supprime les parties
   * abandonnées). Appelé périodiquement au démarrage du serveur.
   *
   * @param maxAgeMs âge maximal (ms) d'une room vide avant suppression.
   */
  static async cleanupEmptyRooms(maxAgeMs = 60 * 60 * 1000): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeMs);
    const res = await this.model.deleteMany({
      "members.0": { $exists: false },
      savedAt: { $lt: cutoff },
    });
    return res.deletedCount;
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
    // La position (`currentNodeId`) peut être un **hub** (en ville) OU un
    // **donjon** (l'équipe est à la sortie d'une zone, sur la mappemonde). On
    // ne la ramène au hub courant que si l'id est invalide (ex. id legacy
    // d'un ancien monde, redémarrage).
    let currentNodeId = room.currentNodeId || room.currentHubId;
    const isHub = !!(await WorldService.getHubById(currentNodeId));
    const isDungeon = !!(await WorldService.getDungeonById(currentNodeId));
    if (!isHub && !isDungeon) {
      currentNodeId = room.currentHubId;
      room.currentNodeId = currentNodeId;
      await room.save();
    }
    const { party, questSystem } = PartyService.deserialize(room.party, room.questSystem, room.currentHubId, currentNodeId);
    // Migration legacy : les sauvegardes antérieures au champ `visitedHubs`
    // n'ont pas de liste de villes visitées. On considère que toutes les villes
    // sont connues (la partie a été jouée sous l'ancien code).
    if (room.party?.visitedHubs === undefined) {
      const world = await WorldService.getWorld();
      for (const n of world.nodes) if (n instanceof Hub) party.markHubVisited(n.id);
    }
    const hub = await WorldService.getHubById(room.currentHubId);
    if (!hub) throw new Error(`Hub introuvable : ${room.currentHubId}`);
    return { room, session: new HubState(hub, party, questSystem, currentNodeId) };
  }

  /**
   * Met à jour **uniquement** le nœud de position d'une room (sans toucher à
   * l'équipe). Utilisé quand l'équipe entre dans une zone (position = la zone)
   * ou la quitte (position = un hub).
   */
  static async setCurrentNodeId(roomId: string, currentNodeId: string): Promise<void> {
    await this.model.findOneAndUpdate(
      { roomId },
      { $set: { currentNodeId, savedAt: new Date() } }
    );
  }

  /** Récupère le snapshot d'exploration persisté (null si hors donjon). */
  static async getExploration(roomId: string): Promise<any | null> {
    const room = await this.model.findOne({ roomId });
    return room?.exploration ?? null;
  }

  /** Persiste le snapshot d'exploration (donjon en cours). */
  static async saveExploration(roomId: string, snapshot: any): Promise<void> {
    await this.model.findOneAndUpdate(
      { roomId },
      { $set: { exploration: snapshot, savedAt: new Date() } }
    );
  }

  /** Efface le snapshot d'exploration (sortie de donjon). */
  static async clearExploration(roomId: string): Promise<void> {
    await this.model.findOneAndUpdate(
      { roomId },
      { $set: { exploration: null, savedAt: new Date() } }
    );
  }

  /** Persiste l'état de jeu d'une room (party + quêtes + hub + nœud de position). */
  private static async persistRoom(roomId: string, session: HubState): Promise<void> {
    await this.saveParty(roomId, session.party, session.questSystem, session.hub.id, session.currentNodeId);
  }

  /**
   * Charge l'état de jeu d'une room (party + quêtes + hub courant + nœud de
   * position). Public : réutilisé par `ExplorationSessionService` (donjon
   * partagé).
   */
  static async loadParty(roomId: string): Promise<{
    party: Party;
    questSystem: QuestSystem;
    currentHubId: string;
    currentNodeId: string;
    difficulty: "easy" | "hard";
  }> {
    const room = await this.model.findOne({ roomId });
    if (!room) throw new Error("Partie introuvable.");
    const { party, questSystem, currentHubId, currentNodeId } = PartyService.deserialize(
      room.party,
      room.questSystem,
      room.currentHubId,
      room.currentNodeId
    );
    // Migration legacy : les sauvegardes antérieures au champ `visitedHubs`
    // n'ont pas de liste de villes visitées. On considère que toutes les villes
    // sont connues (la partie a été jouée sous l'ancien code).
    if (room.party?.visitedHubs === undefined) {
      const world = await WorldService.getWorld();
      for (const n of world.nodes) if (n instanceof Hub) party.markHubVisited(n.id);
    }
    return { party, questSystem, currentHubId, currentNodeId, difficulty: (room.difficulty ?? "easy") as "easy" | "hard" };
  }

  /**
   * Sauvegarde l'état de jeu d'une room (party + quêtes + hub courant + nœud
   * de position). Public : réutilisé par `ExplorationSessionService` (donjon
   * partagé).
   */
  static async saveParty(
    roomId: string,
    party: Party,
    questSystem: QuestSystem,
    currentHubId: string,
    currentNodeId?: string
  ): Promise<void> {
    await this.model.findOneAndUpdate(
      { roomId },
      {
        $set: {
          party: party.toSerialized(),
          questSystem: questSystem.toSerialized(),
          currentHubId,
          // Nœud de position (défaut : le hub courant si non précisé).
          currentNodeId: currentNodeId ?? currentHubId,
          savedAt: new Date(),
        },
      }
    );
  }

  // ── Actions de ville (délégation à HubService) ───────────────────────────
  // Toutes indexées par `roomId` : l'équipe est **partagée**, donc une action
  // de n'importe quel membre mute l'état commun (diffusé à tous par le socket).

  static async buy(roomId: string, itemName: string, playerId: string): Promise<{ logs: string[]; state: any }> {
    const { room, session } = await this.getHubState(roomId);
    // L'objet acheté atterrit dans le sac du **personnage du joueur qui achète**
    // (ownerId = playerId), pas dans celui du 1er membre de l'équipe.
    const buyer = session.party.members.find((m) => m.ownerId === playerId) ?? session.party.members[0];
    const logs = HubService.buyConsumable(session, buyer, itemName);
    await this.persistRoom(roomId, session);
    return { logs, state: this.serializeRoom(room, session) };
  }

  static async sell(roomId: string, itemId: string, playerId: string): Promise<{ logs: string[]; state: any }> {
    const { room, session } = await this.getHubState(roomId);
    const seller = session.party.members.find((m) => m.ownerId === playerId) ?? session.party.members[0];
    // L'objet est dans le **sac commun** (les sacs individuels sont vidés par
    // `migrateMemberBags`) : on cherche dans `party.bag`, pas dans `seller.bag`.
    const item = session.party.bag.find((i) => i.id === itemId);
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
    const item = session.party.bag.find((i) => i.id === itemId);
    if (!item || item.type !== "weapon") {
      return { logs: ["Cette arme n'est pas dans le sac commun."], state: this.serializeRoom(room, session) };
    }
    // Retire l'arme du sac commun avant de l'équiper.
    session.party.bag.splice(session.party.bag.indexOf(item), 1);
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
      // Les armes déséquipées (remises dans le sac individuel par syncBagWithHands)
      // migrent vers le sac commun.
      session.party.migrateMemberBags();
      const logs = [`${member.name} équipe ${item.name} en main ${hand === "right" ? "droite" : "gauche"}.`];
      await this.persistRoom(roomId, session);
      return { logs, state: this.serializeRoom(room, session) };
    } catch (err: any) {
      return { logs: [err?.message ?? "Impossible d'équiper cette arme."], state: this.serializeRoom(room, session) };
    }
  }

  /** Utilise un consommable du sac sur le membre (soin, réanimation, statut). */
  static async useItem(
    roomId: string,
    memberId: string,
    itemId: string
  ): Promise<{ logs: string[]; state: any }> {
    const { room, session } = await this.getHubState(roomId);
    const member = session.party.members.find((m) => m.id === memberId);
    if (!member) return { logs: ["Personnage introuvable."], state: this.serializeRoom(room, session) };
    // Un personnage KO (0 PV) ne peut plus utiliser d'objet.
    if (member.isDead()) return { logs: [`${member.name} est KO et ne peut pas utiliser d'objet.`], state: this.serializeRoom(room, session) };
    const item = session.party.bag.find((i) => i.id === itemId);
    if (!item || item.type !== "consumable") {
      return { logs: ["Cet objet n'est pas utilisable."], state: this.serializeRoom(room, session) };
    }
    // Retire l'objet du sac commun (useItem ne le retire pas du sac individuel
    // car il n'y est pas — consumeItem est un no-op si l'objet n'est pas dans bag).
    session.party.bag.splice(session.party.bag.indexOf(item), 1);
    const logs = member.useItem(item, member);
    await this.persistRoom(roomId, session);
    return { logs, state: this.serializeRoom(room, session) };
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

  /**
   * Lance un **sort de soin** (cible alliée) **hors combat** en ville : le
   * lanceur (`casterId`) soigne/ranime un allié (`targetId`). Le soin est
   * garanti (pas de roll) — voir `Character.castHealSpell`.
   */
  static async castSpell(roomId: string, casterId: string, targetId: string, spellName: string): Promise<{ logs: string[]; state: any }> {
    const { room, session } = await this.getHubState(roomId);
    const caster = session.party.members.find((m) => m.id === casterId);
    const target = session.party.members.find((m) => m.id === targetId);
    if (!caster || !target) return { logs: ["Personnage introuvable."], state: this.serializeRoom(room, session) };
    // Un personnage KO (0 PV) ne peut plus lancer de sort.
    if (caster.isDead()) return { logs: [`${caster.name} est KO et ne peut pas lancer de sort.`], state: this.serializeRoom(room, session) };
    const logs = caster.castHealSpell(spellName, target);
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
    // **Blocage des déplacements** : on ne peut « entrer » que dans une ville
    // où l'équipe peut légitimement se trouver :
    //  - la ville où elle est déjà (hub de base), OU
    //  - une ville **adjacente** au donjon sur lequel elle se trouve (sortie
    //    d'une zone de transition : l'équipe choisit l'une des 2 villes).
    const onDungeon = session.currentNodeId !== session.hub.id;
    const adjacentToPosition = onDungeon
      ? await WorldService.isAdjacent(session.currentNodeId, hub.id)
      : false;
    if (hub.id !== session.hub.id && !adjacentToPosition) {
      throw new Error("Vous ne pouvez pas vous téléporter : traversez une zone ou voyagez en caravane.");
    }
    session.hub = hub;
    session.currentNodeId = hub.id;
    session.party.markHubVisited(hub.id);
    await this.persistRoom(roomId, session);
    return this.serializeRoom(room, session);
  }

  /**
   * **Caravane** : voyage vers une ville au-delà d'une zone de transition
   * (sans l'explorer). Coût 20 or + risque (gobelins / brûleur). L'équipe
   * arrive à destination (le combat de caravane sera implémenté plus tard).
   *
   * @param destHubId la ville de destination (doit être une destination de
   *   caravane valide depuis le hub courant).
   */
  static async takeCaravan(roomId: string, destHubId: string): Promise<{ logs: string[]; state: any }> {
    const { room, session } = await this.getHubState(roomId);
    // La destination doit être une ville existante, différente du hub courant.
    // (Le brouillard de guerre — ne voyager que vers des villes révélées — est
    // géré par le front, qui n'affiche que les destinations connues.)
    const dest = await WorldService.getHubById(destHubId);
    if (!dest || dest.id === session.hub.id) {
      throw new Error("Cette ville n'est pas accessible en caravane depuis ici.");
    }
    const payer = session.party.members[0];
    if (!payer) throw new Error("Aucun personnage pour payer la caravane.");
    // Roll du voyage (1-6) : 1 = brûleur, 2-3 = gobelins, 4-6 = tranquille.
    const roll = Math.floor(Math.random() * 6) + 1;
    const result = HubService.takeCaravan(session, payer, destHubId, roll);
    if (!result.success) {
      return { logs: result.logs, state: this.serializeRoom(room, session) };
    }
    // Voyage réussi : l'équipe arrive à destination.
    session.hub = dest;
    session.currentNodeId = dest.id;
    session.party.markHubVisited(dest.id);
    await this.persistRoom(roomId, session);
    return { logs: result.logs, state: this.serializeRoom(room, session) };
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
      hostId: room.hostId.toString(),
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
      hostId: room.hostId.toString(),
      hostName: room.hostName,
      isPublic: room.isPublic,
      maxPlayers: room.maxPlayers,
      difficulty: room.difficulty ?? "easy",
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
