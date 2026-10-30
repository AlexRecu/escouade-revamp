import { HubState } from "../../classes/World/HubState";
import { Hub } from "../../classes/World/Hub";
import { Dungeon } from "../../classes/World/Dungeon";
import { Party } from "../../classes/Exploration/Party";
import { QuestSystem, Quest } from "../../classes/Progression/QuestSystem";
import { Character } from "../../classes/UnitTypes/Character";
import { Item } from "../../classes/Items/Item";
import { Weapon } from "../../classes/Items/Weapon";
import { HubService } from "./HubService";
import { PartyService } from "./PartyService";
import { WorldService } from "../World/WorldService";
import { ItemFactory } from "../factory/ItemFactory";
import { BlackMage } from "../../classes/Jobs/BlackMage";
import { BlueMage } from "../../classes/Jobs/BlueMage";
import { getSpawnRatesForZoneType } from "../../utils/RandomUtils";

/**
 * Service de session en ville (mode point-and-clic temps réel).
 *
 * Gère les **sessions en mémoire** (une par joueur connecté) et expose la
 * logique métier de ville (marchand, auberge, sanctuaire, quêtes) en
 * déléguant à `HubService`. Chaque action mute l'état, le **persiste**
 * (via `PartyService`) et renvoie l'état sérialisé pour le front.
 *
 * Le front envoie les actions via Socket.IO ; ce service est le point d'entrée
 * des handlers socket (voir `socket.ts`).
 */
export class HubSessionService {
  /** Sessions en mémoire (playerId → HubState). */
  private static sessions: Map<string, HubState> = new Map();

  /**
   * Renvoie l'inventaire du marchand (consommables + armes) **filtré par
   * `zoneThreshold`** : un objet n'est en vente que si
   * `zoneThreshold <= worldLevel` (les objets trop puissants n'apparaissent
   * pas au début de l'aventure).
   *
   * @param worldLevel niveau de progression du monde (0 → 6).
   */
  /**
   * Objets de **classe** : ne sont **ni achetables ni revendables** (ils sont
   * donnés à la création du personnage). Ex. Monstronomicon (Mage bleu),
   * Pièce marquée (Voleur).
   */
  private static readonly CLASS_ITEMS = new Set(["Monstronomicon", "Pièce marquée"]);

  static shopInventory(worldLevel: number): {
    name: string;
    kind: "weapon" | "consumable";
    price: number;
    effect: string;
    subType?: string;
    mainStat?: string;
    weaponStat?: number;
    element?: string;
    status?: string | null;
  }[] {
    const out: {
      name: string;
      kind: "weapon" | "consumable";
      price: number;
      effect: string;
      subType?: string;
      mainStat?: string;
      weaponStat?: number;
      element?: string;
      status?: string | null;
    }[] = [];
    for (const data of ItemFactory.DATA) {
      if (this.CLASS_ITEMS.has(data.name)) continue; // objet de classe, pas en vente
      const threshold = data.zoneThreshold ?? 0;
      if (threshold > worldLevel) continue; // trop puissant pour le niveau actuel
      if (data.type === "Consommable") {
        out.push({
          name: data.name,
          kind: "consumable",
          price: data.purchasePrice ?? 0,
          effect: data.effect ?? "",
        });
      } else if (data.type === "Arme") {
        out.push({
          name: data.name,
          kind: "weapon",
          price: data.purchasePrice ?? 0,
          effect: data.effect ?? "",
          subType: data.subType,
          mainStat: data.mainStat,
          weaponStat: data.weaponStat,
          element: data.element,
          status: data.status ?? null,
        });
      }
    }
    return out;
  }

  /**
   * Rejoint (ou crée) une session en ville pour un joueur.
   *
   * Charge la partie persistée (ou en crée une neuve), récupère le hub courant
   * du monde, construit le `HubState` et le stocke en mémoire.
   *
   * @returns l'état sérialisé pour le front.
   */
  static async join(playerId: string): Promise<any> {
    // Session déjà active ? On la renvoie.
    const existing = this.sessions.get(playerId);
    if (existing) return this.serialize(existing);

    // Charge la partie (ou en crée une).
    let game = await PartyService.loadGame(playerId);
    if (!game) game = await PartyService.createGame(playerId);

    // Récupère le hub courant du monde.
    const hub = await WorldService.getHubById(game.currentHubId);
    if (!hub) throw new Error(`Hub introuvable : ${game.currentHubId}`);

    // Nœud de position : peut être un hub (en ville) OU un donjon (l'équipe
    // est à la sortie d'une zone, sur la mappemonde). On ne le ramène au hub
    // courant que si l'id est invalide (ex. id legacy, redémarrage).
    let currentNodeId = game.currentNodeId;
    const isHub = !!(await WorldService.getHubById(currentNodeId));
    const isDungeon = !!(await WorldService.getDungeonById(currentNodeId));
    if (!isHub && !isDungeon) {
      currentNodeId = game.currentHubId;
    }

    const session = new HubState(hub, game.party, game.questSystem, currentNodeId);
    this.sessions.set(playerId, session);
    return this.serialize(session);
  }

  /**
   * Achat d'un consommable (marchand).
   */
  static async buy(playerId: string, itemName: string): Promise<{ logs: string[]; state: any }> {
    const session = this.require(playerId);
    const buyer = session.party.members[0];
    const logs = HubService.buyConsumable(session, buyer, itemName);
    await this.persist(playerId, session);
    return { logs, state: this.serialize(session) };
  }

  /**
   * Revente d'un objet du sac (marchand).
   */
  static async sell(playerId: string, itemId: string): Promise<{ logs: string[]; state: any }> {
    const session = this.require(playerId);
    const seller = session.party.members[0];
    // L'objet est dans le **sac commun** (les sacs individuels sont vidés par
    // `migrateMemberBags`) : on cherche dans `party.bag`, pas dans `seller.bag`.
    const item = session.party.bag.find((i) => i.id === itemId);
    if (!item) return { logs: ["Objet introuvable dans le sac."], state: this.serialize(session) };
    const logs = HubService.sellItem(session, seller, item);
    await this.persist(playerId, session);
    return { logs, state: this.serialize(session) };
  }

  /**
   * Équipe une arme du sac en main droite ou gauche.
   *
   * L'arme doit être dans le sac du membre ET de un type que sa classe peut
   * équiper (sinon `equipRightHand`/`equipLeftHand` lèvent une erreur,
   * interceptée ici). L'arme reste dans le sac (l'équipement est une référence).
   */
  static async equip(
    playerId: string,
    memberId: string,
    itemId: string,
    hand: "right" | "left"
  ): Promise<{ logs: string[]; state: any }> {
    const session = this.require(playerId);
    const member = session.party.members.find((m) => m.id === memberId);
    if (!member) return { logs: ["Personnage introuvable."], state: this.serialize(session) };
    const item = member.bag.find((i) => i.id === itemId);
    if (!item || item.type !== "weapon") {
      return { logs: ["Cette arme n'est pas dans le sac."], state: this.serialize(session) };
    }
    // Main gauche : réservée au passif **Double Armement** (Chevalier Noir).
    // Sans ce passif, la main gauche est occupée par le bouclier (Guerrier)
    // ou reste vide — on ne peut pas y équiper une arme.
    if (hand === "left" && !this.canDualWield(member)) {
      return {
        logs: [`${member.name} ne peut pas s'équiper d'une arme en main gauche (passif Double Armement requis).`],
        state: this.serialize(session),
      };
    }
    try {
      const weapon = item as unknown as Weapon;
      if (hand === "right") member.equipRightHand(weapon);
      else member.equipLeftHand(weapon);
      const logs = [`${member.name} équipe ${item.name} en main ${hand === "right" ? "droite" : "gauche"}.`];
      await this.persist(playerId, session);
      return { logs, state: this.serialize(session) };
    } catch (err: any) {
      return { logs: [err?.message ?? "Impossible d'équiper cette arme."], state: this.serialize(session) };
    }
  }

  /** Le personnage peut-il tenir une arme en main gauche (passif Double Armement) ? */
  private static canDualWield(member: Character): boolean {
    return (member.job.specialAbility ?? "").startsWith("Double Armement");
  }

  /**
   * Utilise un consommable du sac sur le membre (soin, réanimation, statut).
   *
   * L'objet doit être dans le sac du membre et de type `consumable`. L'effet
   * est appliqué via `Character.useItem` (soins PV/MP, réanimation, purge de
   * statut) ; l'objet est retiré du sac s'il a été effectivement consommé.
   */
  static async useItem(
    playerId: string,
    memberId: string,
    itemId: string
  ): Promise<{ logs: string[]; state: any }> {
    const session = this.require(playerId);
    const member = session.party.members.find((m) => m.id === memberId);
    if (!member) return { logs: ["Personnage introuvable."], state: this.serialize(session) };
    const item = member.bag.find((i) => i.id === itemId);
    if (!item || item.type !== "consumable") {
      return { logs: ["Cet objet n'est pas utilisable."], state: this.serialize(session) };
    }
    const logs = member.useItem(item, member);
    await this.persist(playerId, session);
    return { logs, state: this.serialize(session) };
  }

  /**
   * Nuit à l'auberge : soigne tout le monde (PV/MP) contre or.
   */
  static async rest(playerId: string): Promise<{ logs: string[]; state: any }> {
    const session = this.require(playerId);
    const logs: string[] = [];
    for (const member of session.party.members) {
      if (!member.isDead()) logs.push(...HubService.restAtInn(session, member));
    }
    await this.persist(playerId, session);
    return { logs, state: this.serialize(session) };
  }

  /**
   * Sanctuaire : ranime un allié mort contre or.
   */
  static async sanctuary(playerId: string, targetId: string): Promise<{ logs: string[]; state: any }> {
    const session = this.require(playerId);
    const payer = session.party.members[0];
    const target = session.party.members.find((m) => m.id === targetId);
    if (!target) return { logs: ["Allié introuvable."], state: this.serialize(session) };
    const logs = HubService.useSanctuary(session, payer, target);
    await this.persist(playerId, session);
    return { logs, state: this.serialize(session) };
  }

  /**
   * Lance un **sort de soin** (cible alliée) **hors combat** en mode solo.
   */
  static async castSpell(playerId: string, casterId: string, targetId: string, spellName: string): Promise<{ logs: string[]; state: any }> {
    const session = this.require(playerId);
    const caster = session.party.members.find((m) => m.id === casterId);
    const target = session.party.members.find((m) => m.id === targetId);
    if (!caster || !target) return { logs: ["Personnage introuvable."], state: this.serialize(session) };
    // Un personnage KO (0 PV) ne peut plus lancer de sort.
    if (caster.isDead()) return { logs: [`${caster.name} est KO et ne peut pas lancer de sort.`], state: this.serialize(session) };
    const logs = caster.castHealSpell(spellName, target);
    await this.persist(playerId, session);
    return { logs, state: this.serialize(session) };
  }

  /**
   * Oublie une compétence/sort **appris** par un Mage bleu (mode solo).
   */
  static async forgetAbility(playerId: string, memberId: string, abilityName: string): Promise<{ logs: string[]; state: any }> {
    const session = this.require(playerId);
    const member = session.party.members.find((m) => m.id === memberId);
    if (!member) return { logs: ["Personnage introuvable."], state: this.serialize(session) };
    if (!(member.job instanceof BlueMage)) {
      return { logs: ["Seul un Mage bleu peut oublier une capacité apprise."], state: this.serialize(session) };
    }
    const logs = [member.job.forget(abilityName)];
    await this.persist(playerId, session);
    return { logs, state: this.serialize(session) };
  }

  /**
   * Tableau des quêtes : liste les quêtes disponibles.
   */
  static async questBoard(playerId: string): Promise<{ quests: any[] }> {
    const session = this.require(playerId);
    const recruited = this.recruitedDemons(session.party);
    const quests = HubService.questBoard(session, recruited);
    return { quests: quests.map((q) => this.serializeQuest(q)) };
  }

  /**
   * Accepte une quête depuis le tableau.
   */
  static async acceptQuest(playerId: string, questId: string): Promise<{ logs: string[]; state: any }> {
    const session = this.require(playerId);
    const recruited = this.recruitedDemons(session.party);
    const quest = HubService.acceptQuest(session, questId, recruited);
    const logs = quest
      ? [`Quête acceptée : ${quest.name}.`]
      : ["Cette quête n'est pas disponible."];
    await this.persist(playerId, session);
    return { logs, state: this.serialize(session) };
  }

  /**
   * Quitte la ville (libère la session en mémoire). L'état est déjà persisté.
   */
  static leave(playerId: string): void {
    this.sessions.delete(playerId);
  }

  /**
   * Change de ville (appelé quand l'équipe quitte la ville pour la mappemonde,
   * puis entre dans une autre). Persiste le nouveau hub courant.
   */
  static async changeHub(playerId: string, hubId: string): Promise<any> {
    const session = this.sessions.get(playerId);
    if (!session) throw new Error("Aucune session active.");
    const hub = await WorldService.getHubById(hubId);
    if (!hub) throw new Error(`Hub introuvable : ${hubId}`);
    // **Blocage des déplacements** : on ne peut « entrer » que dans une ville
    // où l'équipe peut légitimement se trouver : la ville où elle est déjà,
    // OU une ville adjacente au donjon sur lequel elle se trouve (sortie d'une
    // zone de transition : l'équipe choisit l'une des 2 villes).
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
    await this.persist(playerId, session);
    return this.serialize(session);
  }

  /**
   * **Caravane** (solo) : voyage vers une ville au-delà d'une zone de
   * transition (sans l'explorer). Coût 20 or + risque.
   */
  static async takeCaravan(playerId: string, destHubId: string): Promise<{ logs: string[]; state: any }> {
    const session = this.require(playerId);
    // La destination doit être une ville existante, différente du hub courant.
    // (Le brouillard de guerre est géré par le front.)
    const dest = await WorldService.getHubById(destHubId);
    if (!dest || dest.id === session.hub.id) {
      throw new Error("Cette ville n'est pas accessible en caravane depuis ici.");
    }
    const payer = session.party.members[0];
    if (!payer) throw new Error("Aucun personnage pour payer la caravane.");
    const roll = Math.floor(Math.random() * 6) + 1;
    const result = HubService.takeCaravan(session, payer, destHubId, roll);
    if (!result.success) {
      return { logs: result.logs, state: this.serialize(session) };
    }
    session.hub = dest;
    session.currentNodeId = dest.id;
    session.party.markHubVisited(dest.id);
    await this.persist(playerId, session);
    return { logs: result.logs, state: this.serialize(session) };
  }

  /**
   * Termine une zone d'exploration (démo) : marque la zone comme complétée et
   * fait monter le niveau du monde (idempotent). C'est la source de vérité du
   * `worldLevel` / `completedZones` — le front doit s'y fier (pas d'état local).
   *
   * @returns l'état sérialisé (le front met à jour `worldLevel`, `completedZones`
   *          et l'inventaire du marchand, qui est filtré par `worldLevel`).
   */
  static async completeZone(playerId: string, zoneId: string): Promise<any> {
    const session = this.require(playerId);
    session.party.completeZone(zoneId);
    // Démo : terminer une zone = on y a combattu → ses monstres rejoignent le
    // bestiaire (persisté). Sera remplacé par les rencontres réelles.
    const world = await WorldService.getWorld();
    const dungeon = world.nodes.find((n) => n.id === zoneId);
    if (dungeon instanceof Dungeon) {
      for (const s of getSpawnRatesForZoneType(dungeon.biome)) {
        session.party.markMonsterSeen(s.monsterName);
      }
    }
    await this.persist(playerId, session);
    return this.serialize(session);
  }

  /**
   * Resynchronise la session de ville avec la partie persistée.
   *
   * Utilisé après une exploration de donjon : l'équipe a été mutée et
   * persistée par `ExplorationSessionService` (zones complétées, worldLevel,
   * or, PV…). Cette méthode recharge la party depuis la base dans la session
   * en mémoire, pour que le front (qui dérive `completedZones`/`worldLevel`
   * de `state.party`) voie les changements → le brouillard de guerre se
   * dissipe et la boutique se met à jour.
   *
   * @returns l'état sérialisé (ou null si aucune session active).
   */
  static async refresh(playerId: string): Promise<any> {
    const session = this.sessions.get(playerId);
    if (!session) return null;
    const game = await PartyService.loadGame(playerId);
    if (game) {
      session.party = game.party;
      session.questSystem = game.questSystem;
      // Après une exploration, le hub courant a pu changer (transition) → on
      // recharge le hub + le nœud de position depuis la base.
      const hub = await WorldService.getHubById(game.currentHubId);
      if (hub) session.hub = hub;
      session.currentNodeId = game.currentNodeId;
    }
    return this.serialize(session);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private static require(playerId: string): HubState {
    const session = this.sessions.get(playerId);
    if (!session) throw new Error("Aucune session active. Appelez d'abord join().");
    return session;
  }

  private static async persist(playerId: string, session: HubState): Promise<void> {
    await PartyService.saveGame(playerId, session.party, session.questSystem, session.hub.id, session.currentNodeId);
  }

  /** Noms des démons déjà recrutés (pactes du Démoniste). */
  private static recruitedDemons(party: Party): string[] {
    const demons: string[] = [];
    for (const m of party.members) {
      if (m.job instanceof BlackMage) {
        demons.push(...(m.job.recruitedDemons ?? []));
      }
    }
    return demons;
  }

  /** Sérialise une quête pour le front. */
  private static serializeQuest(q: Quest): any {
    return {
      id: q.id,
      name: q.name,
      giver: q.giver,
      steps: q.steps.map((s) => ({ id: s.id, description: s.description, type: s.type, target: s.target, done: s.done })),
      reward: q.reward,
      accepted: q.accepted,
      completed: q.completed,
    };
  }

  /** Sérialise une arme (équipée ou dans le sac) pour le front. */
  private static serializeWeapon(w: any): any {
    return {
      id: w.id,
      name: w.name,
      weaponType: w.weaponType,
      subType: w.weaponType,
      mainStat: w.mainStat,
      weaponStat: w.weaponStat,
      element: w.element,
      status: w.status ? w.status.name : null,
    };
  }

  /** Sérialise l'état de session complet pour le front. */
  private static serialize(session: HubState): any {
    const recruited = this.recruitedDemons(session.party);
    const available = session.questSystem.availableQuests(session.party.members, recruited);
    const accepted = session.questSystem.allQuests().filter((q) => q.accepted && !q.completed);
    return {
      hub: {
        id: session.hub.id,
        name: session.hub.name,
        services: session.hub.services,
        layout: session.hub.layout,
      },
      party: {
        id: session.party.id,
        worldLevel: session.party.worldLevel,
        completedZones: Array.from(session.party.completedZones),
        visitedHubs: Array.from(session.party.visitedHubs),
        gold: session.party.gold,
        seenMonsters: Array.from(session.party.seenMonsters),
        members: session.party.members.map((m) => ({
          id: m.id,
          name: m.name,
          job: m.job.name,
          jobLevel: m.job.jobLevel,
          hp: m.currentHp,
          maxHp: m.maxHp,
          mp: m.currentMp,
          maxMp: m.maxMp,
          gold: m.gold,
          level: m.characterLevel,
          isDead: m.isDead(),
          // Types d'armes que ce personnage peut équiper (selon sa classe).
          equippableWeapons: m.job.weapons,
          // Peut-il tenir une arme en main gauche (passif Double Armement) ?
          canDualWield: this.canDualWield(m),
          rightHand: m.rightHandWeapon ? this.serializeWeapon(m.rightHandWeapon) : null,
          leftHand: m.leftHandWeapon ? this.serializeWeapon(m.leftHandWeapon) : null,
          bag: m.bag.map((i: Item) => ({
            id: i.id,
            name: i.name,
            type: i.type,
            description: i.description,
            purchasePrice: i.purchasePrice,
            // Détails d'arme (si l'objet est une arme) pour l'équipement.
            weaponType: (i as any).weaponType,
            mainStat: (i as any).mainStat,
            weaponStat: (i as any).weaponStat,
            element: (i as any).element,
          })),
        })),
      },
      quests: {
        available: available.map((q) => this.serializeQuest(q)),
        accepted: accepted.map((q) => this.serializeQuest(q)),
      },
      shop: this.shopInventory(session.party.worldLevel),
    };
  }
}
