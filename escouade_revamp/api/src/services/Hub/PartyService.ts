import { PlayerGameModel } from "../../models/playerGame.model";
import { Party } from "../../classes/Exploration/Party";
import { Character } from "../../classes/UnitTypes/Character";
import { QuestSystem, createDefaultQuests } from "../../classes/Progression/QuestSystem";
import { CharacterFactory } from "../factory/CharacterFactory";
import { JobFactory } from "../factory/JobFactory";
import { IdGenerator } from "../../utils/IdGeneratorUtils";
import { WorldService } from "../World/WorldService";
import { Hub } from "../../classes/World/Hub";

/**
 * Service de partie (mode ville) : crée, charge et sauvegarde l'état de jeu
 * **indépendant de la zone** (équipe + quêtes + ville courante).
 *
 * C'est le socle du mode ville temps réel : le front charge la partie à la
 * connexion, les actions de ville (marchand, auberge, quêtes…) mutent l'état
 * en mémoire, et chaque action est persistée ici.
 *
 * Le modèle est **injectable** (`PartyService.model`) pour mocker la base en
 * test (pas de MongoDB requis).
 */
export class PartyService {
  /** Modèle injectable (défaut `PlayerGameModel`) — à mocker en test. */
  static model: typeof PlayerGameModel = PlayerGameModel;

  /**
   * Crée une partie neuve pour un joueur : une équipe de départ (3 héros) +
   * les quêtes du livret + la ville de départ (Auberge du matin).
   *
   * @returns la partie créée (party + questSystem + currentHubId).
   */
  static async createGame(playerId: string): Promise<{
    party: Party;
    questSystem: QuestSystem;
    currentHubId: string;
  }> {
    // Équipe de départ : un Guerrier, un Mage Blanc, un Voleur.
    const members: Character[] = [
      this.makeHero("Guerrier"),
      this.makeHero("Mage blanc"),
      this.makeHero("Voleur"),
    ];
    const party = new Party(IdGenerator.generate("Party"), members, { row: 7, col: 7 });
    // Pot commun d'or de départ : **or de classe** (Guerrier 100, Mage blanc 10,
    // Voleur 50 — porté par chaque `Character` via le constructeur) **+ 100 or
    // par membre** (bonus de départ). Ex. équipe de 3 → 160 + 300 = 460 or.
    party.gold = 100 * members.length;
    party.consolidateGold(); // totalise l'or de classe des membres dans le pot

    // Quêtes du livret (état initial : aucune acceptée).
    const questSystem = new QuestSystem();
    for (const q of createDefaultQuests("fr")) questSystem.addQuest(q);

    // Ville de départ : la racine du monde (Auberge du matin).
    const world = await WorldService.getWorld();
    const root = world.nodes.find(
      (n) => n instanceof Hub && n.name === "Auberge du matin"
    );
    const currentHubId = root?.id ?? "Hub_Auberge du matin";

    await this.model.findOneAndUpdate(
      { player: playerId },
      {
        $set: {
          party: party.toSerialized(),
          questSystem: questSystem.toSerialized(),
          currentHubId,
          savedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    return { party, questSystem, currentHubId };
  }

  /**
   * Charge la partie d'un joueur.
   * @returns la partie rechargée, ou null si aucune.
   */
  static async loadGame(playerId: string): Promise<{
    party: Party;
    questSystem: QuestSystem;
    currentHubId: string;
  } | null> {
    const doc = await this.model.findOne({ player: playerId });
    if (!doc) return null;
    return this.deserialize(doc.party, doc.questSystem, doc.currentHubId);
  }

  /**
   * Sauvegarde l'état de partie (upsert : 1 partie active par joueur).
   */
  static async saveGame(
    playerId: string,
    party: Party,
    questSystem: QuestSystem,
    currentHubId: string
  ): Promise<void> {
    await this.model.findOneAndUpdate(
      { player: playerId },
      {
        $set: {
          party: party.toSerialized(),
          questSystem: questSystem.toSerialized(),
          currentHubId,
          savedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );
  }

  /**
   * Crée un héros de départ (job niveau 1). L'or de classe (défini par le job,
   * ex. Guerrier 100, Voleur 50, Mage blanc 10) est porté par le personnage et
   * sera transféré au pot commun par `consolidateGold()` dans `createGame`.
   */
  private static makeHero(jobName: string): Character {
    const job = JobFactory.fromSerialized({ name: jobName });
    const hero = new Character(
      IdGenerator.generate("Char"),
      jobName,
      "Hero",
      { row: 7, col: 7 },
      job,
      null,
      null
    );
    hero.gold = job.gold; // or de classe
    return hero;
  }

  /**
   * (Dé)sérialise une partie depuis les données stockées.
   */
  private static deserialize(partyData: any, questData: any, currentHubId: string) {
    const members: Character[] = (partyData.members ?? []).map((m: any) =>
      CharacterFactory.fromSerialized(m)
    );
    const party = new Party(partyData.id, members, partyData.position ?? { row: 7, col: 7 });
    for (const key of partyData.visitedTiles ?? []) party.visitedTiles.add(key);
    party.defeatedEnemies = partyData.defeatedEnemies ?? 0;
    party.worldLevel = partyData.worldLevel ?? 0;
    for (const z of partyData.completedZones ?? []) party.completedZones.add(z);
    // Bestiaire : restaure les monstres déjà rencontrés (persisté).
    for (const m of partyData.seenMonsters ?? []) party.seenMonsters.add(m);
    // Pot commun d'or : restaure la valeur stockée, puis migre l'or par membre
    // (les parties antérieures stockaient l'or sur chaque `Character`).
    party.gold = partyData.gold ?? 0;
    party.consolidateGold();

    const questSystem = QuestSystem.fromSerialized(questData, "fr");
    return { party, questSystem, currentHubId };
  }
}
