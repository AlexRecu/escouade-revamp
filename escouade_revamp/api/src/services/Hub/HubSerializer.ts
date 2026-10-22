import { HubState } from "../../classes/World/HubState";
import { Party } from "../../classes/Exploration/Party";
import { Character } from "../../classes/UnitTypes/Character";
import { Item } from "../../classes/Items/Item";
import { Quest } from "../../classes/Progression/QuestSystem";
import { BlackMage } from "../../classes/Jobs/BlackMage";
import { ItemFactory } from "../factory/ItemFactory";
import { LootEngine } from "../../classes/Progression/LootEngine";

/**
 * Sérialisation partagée de l'état de ville (`HubState`) pour le front.
 *
 * Utilisée à la fois par `HubSessionService` (partie solo, 1 joueur) et par
 * `PartyRoomService` (partie partagée multi-joueurs) : le format renvoyé au
 * front est **identique** dans les deux cas, ce qui permet au front de ne pas
 * distinguer solo / multi (il reçoit toujours le même `GameState`).
 */
export class HubSerializer {
  /**
   * Objets de **classe** : ne sont **ni achetables ni revendables** (donnés à
   * la création du personnage).
   */
  private static readonly CLASS_ITEMS = new Set(["Monstronomicon", "Pièce marquée"]);

  /**
   * Inventaire du marchand (consommables + armes) **filtré par `zoneThreshold`**
   * : un objet n'est en vente que si `zoneThreshold <= worldLevel`.
   */
  static shopInventory(worldLevel: number): {
    name: string;
    kind: "weapon" | "consumable";
    price: number;
    effect: string;
    subType?: string;
    /** Clé normalisée du type d'arme (ex. "epee") — pour le grisé côté front. */
    weaponType?: string;
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
      weaponType?: string;
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
          weaponType: ItemFactory.weaponTypeOf(data.subType),
          mainStat: data.mainStat,
          weaponStat: data.weaponStat,
          element: data.element,
          status: data.status ?? null,
        });
      }
    }
    return out;
  }

  /** Noms des démons déjà recrutés (pactes du Démoniste). */
  static recruitedDemons(party: Party): string[] {
    const demons: string[] = [];
    for (const m of party.members) {
      if (m.job instanceof BlackMage) {
        demons.push(...(m.job.recruitedDemons ?? []));
      }
    }
    return demons;
  }

  /** Le personnage peut-il tenir une arme en main gauche (passif Double Armement) ? */
  static canDualWield(member: Character): boolean {
    return (member.job.specialAbility ?? "").startsWith("Double Armement");
  }

  /** Sérialise une quête pour le front. */
  static serializeQuest(q: Quest): any {
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
  static serializeWeapon(w: any): any {
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
  static serializeHubState(session: HubState): any {
    const recruited = this.recruitedDemons(session.party);
    const available = session.questSystem.availableQuests(session.party.members, recruited);
    const accepted = session.questSystem.allQuests().filter((q) => q.accepted && !q.completed);
    return {
      // Nœud de position de l'équipe (id d'un hub OU d'un donjon) — c'est ce
      // que suit le cercle blanc de la mappemonde. Quand l'équipe est en ville,
      // c'est l'id du hub ; dans une zone d'exploration, l'id du donjon.
      currentNodeId: session.currentNodeId,
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
          // XP cumulée + XP restante avant le prochain niveau (fiche perso).
          ...LootEngine.xpInfo(m),
          isDead: m.isDead(),
          // Joueur qui contrôle ce perso + avatar (multi-joueurs).
          ownerId: m.ownerId ?? null,
          avatar: m.avatar ?? null,
          // Types d'armes que ce personnage peut équiper (selon sa classe).
          equippableWeapons: m.job.weapons,
          // Peut-il tenir une arme en main gauche (passif Double Armement) ?
          canDualWield: this.canDualWield(m),
          // Statistiques détaillées (pour le panneau de détail du personnage).
          stats: m.stats,
          // Compétences de classe débloquées (selon le niveau de classe).
          skills: m.getAvailableAbilities().map((s) => ({
            name: s.name,
            apCost: s.apCost,
            mpCost: s.mpCost,
            target: s.target,
            type: s.type,
            range: s.range,
            description: s.description,
          })),
          // Sorts débloqués (selon le niveau de classe).
          spells: m.getAvailableSpells().map((s) => ({
            name: s.name,
            mpCost: s.mpCost,
            hpCost: s.hpCost,
            target: s.target,
            element: s.element,
            description: s.description,
          })),
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
            // Statut d'arme (ex. "Saignée") — affiché dans le sac / l'équipement.
            status: (i as any).status ? (i as any).status.name : null,
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
