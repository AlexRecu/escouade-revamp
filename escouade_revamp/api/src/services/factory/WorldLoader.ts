// src/services/world/WorldLoader.ts
import { WorldMap } from "../../classes/World/WorldMap";
import { Zone, ZoneType } from "../../classes/World/Zone";
import { Hub } from "../../classes/World/Hub";
import { ZoneFactory } from "./ZoneFactory";
import { DungeonFactory } from "./DungeonFactory";
import { Dungeon } from "../../classes/World/Dungeon";
import { STABLE_ZONE_NAMES, seededRandom, randomSeed } from "../../utils/RandomUtils";
import { Position, HubLayout } from "../../classes/Types";
import hubsData from "../../config/hubs_data.json";


const ZONE_NAMES = [
    "Forêt", "Grotte", "Tour", "Château", "Canyon", "Terre Gelée"
];
const HUB_NAMES = [
    "Auberge du matin", "Qual-Mastrech", "Qual-Chen", "Qual-Far"
];

/** Biomes des zones d'exploration (le Lac est géré séparément). */
const EXPLORATION_BIOMES: ZoneType[] = ["Forest", "Cave", "Tower", "Castle", "Canyon", "FrozenLand"];

export class WorldLoader {
    /** Récupère le layout d'une ville depuis le JSON (par nom), ou null. */
    private static getHubLayout(name: string): HubLayout | null {
        const entry = (hubsData as { hubs: { name: string }[] }).hubs.find(
            (h) => h.name === name
        );
        return (entry as unknown as HubLayout | undefined) ?? null;
    }

    /**
     * Dérive les services d'une ville de son layout : chaque bâtiment présent
     * dans le layout = service actif. Le layout est la source de vérité (ce
     * qu'on voit dans la ville = ce qu'on peut y faire).
     */
    private static servicesFromLayout(layout: HubLayout | null) {
        const services = { shop: false, inn: false, church: false, questBoard: false };
        if (layout) {
            for (const b of layout.buildings) services[b.service] = true;
        }
        return services;
    }

    /**
     * Génère le monde sous forme de **graphe rogue-like** (2026-10-15, v2).
     *
     * Règles :
     *  - **Chaque zone n'apparaît qu'une fois** (6 biomes + lac, pas de doublons).
     *  - Racine = **Auberge du matin**, max **3 connexions**.
     *  - **Forêt des soupirs, Vallée des cendres, Terres Gelées** = transitions
     *    obligatoires (relient 2 villes).
     *  - **Château Déchu, Tour du serment** = impasses obligatoires (1 ville → zone,
     *    pas de sortie).
     *  - **Grotte de l'Écho** = impasse OU transition (aléatoire 50/50).
     *  - Les villes peuvent être reliées entre elles (cycles possibles si la
     *    Grotte est une transition).
     *  - **Niveau** d'une zone = nombre de zones traversées depuis la racine
     *    (BFS : les villes ne comptent pas, les zones oui).
     *
     * Garanties (contraintes des tests) :
     *  - Les 4 hubs sont présents (par nom) et connectés.
     *  - Les 6 biomes d'exploration sont tous présents (ancrage des démons).
     *  - Le Lac de Qual-Chen est relié à Qual-Chen (5 tuiles de pêche).
     *  - Déterministe par seed.
     */
    static async generate(seed?: number): Promise<WorldMap> {
        const worldMap = new WorldMap();
        const rand = seededRandom(seed ?? randomSeed());

        // 1. Créer les 4 hubs. IDs déterministes (basés sur le nom).
        const hubs: Hub[] = HUB_NAMES.map((name) => {
            const layout = WorldLoader.getHubLayout(name);
            return new Hub(
                `Hub_${name}`,
                name,
                WorldLoader.servicesFromLayout(layout),
                layout
            );
        });
        hubs.forEach((hub) => worldMap.nodes.push(hub));

        const root = hubs[0]; // Auberge du matin
        const dungeons: Dungeon[] = [];

        /** Crée une zone d'exploration (donjon) unique pour un biome. */
        const createZone = (biome: ZoneType): Dungeon => {
            const dungeon = DungeonFactory.create({
                name: STABLE_ZONE_NAMES[biome],
                level: 1, // sera mis à jour après le BFS
                type: biome,
                floors: 4, // sera mis à jour après le BFS
                seed: seed,
            });
            dungeons.push(dungeon);
            worldMap.nodes.push(dungeon);
            // Chaîner les étages du donjon.
            dungeon.levels.forEach((lvl, j) => {
                if (j < dungeon.levels.length - 1) {
                    worldMap.addConnection(lvl.id, dungeon.levels[j + 1].id);
                }
            });
            return dungeon;
        };

        // 2. Créer les 6 zones (une par biome, chacune exactement une fois).
        const forestZone = createZone("Forest");
        const caveZone = createZone("Cave");
        const towerZone = createZone("Tower");
        const castleZone = createZone("Castle");
        const canyonZone = createZone("Canyon");
        const frozenZone = createZone("FrozenLand");

        // 3. Rôle de la Grotte de l'Écho : impasse ou transition (50/50).
        const caveIsTransition = rand() < 0.5;

        // 4. Construire l'arbre couvrant des 4 villes avec les 3 transitions
        //    obligatoires (Forêt, Vallée, Terres Gelées).
        //    Algorithme : partir de la racine, ajouter les 3 autres villes
        //    une par une, chacune reliée à une ville déjà placée.
        const treeEdges: [Hub, Hub][] = [];
        const placed: Hub[] = [root];
        const toPlace = [...hubs.slice(1)];
        while (toPlace.length > 0) {
            const idx = Math.floor(rand() * toPlace.length);
            const newHub = toPlace.splice(idx, 1)[0];
            const parent = placed[Math.floor(rand() * placed.length)];
            treeEdges.push([parent, newHub]);
            placed.push(newHub);
        }

        // Assigner les 3 transitions obligatoires aux 3 arêtes de l'arbre.
        const mandatoryTransitions = [forestZone, canyonZone, frozenZone];
        const shuffledTransitions = [...mandatoryTransitions].sort(() => rand() - 0.5);
        treeEdges.forEach(([from, to], i) => {
            worldMap.addConnection(from.id, shuffledTransitions[i].id);
            worldMap.addConnection(shuffledTransitions[i].id, to.id);
        });

        // 5. Si la Grotte est une transition : relier 2 villes aléatoires
        //    (crée un cycle — les villes peuvent être reliées entre elles).
        if (caveIsTransition) {
            const a = hubs[Math.floor(rand() * hubs.length)];
            let b = hubs[Math.floor(rand() * hubs.length)];
            while (b.id === a.id) b = hubs[Math.floor(rand() * hubs.length)];
            worldMap.addConnection(a.id, caveZone.id);
            worldMap.addConnection(caveZone.id, b.id);
        }

        // 6. Assigner les impasses (Château, Tour, + Grotte si impasse)
        //    à des villes aléatoires. Contrainte : racine ≤ 3 connexions.
        const deadEnds: Dungeon[] = [castleZone, towerZone];
        if (!caveIsTransition) deadEnds.push(caveZone);

        /** Nombre de connexions (arêtes incidentes) d'un hub. */
        const hubDegree = (hub: Hub): number => {
            let count = 0;
            worldMap.edges.forEach((targets, from) => {
                if (from === hub.id) count += targets.length;
                if (targets.includes(hub.id)) count += 1;
            });
            return count;
        };

        for (const deadEnd of deadEnds) {
            // Choisir une ville aléatoire qui peut accepter une impasse.
            const candidates = hubs.filter((h) => hubDegree(h) < 3);
            const target = candidates.length > 0
                ? candidates[Math.floor(rand() * candidates.length)]
                : hubs[Math.floor(rand() * hubs.length)]; // fallback (ne devrait pas arriver)
            worldMap.addConnection(target.id, deadEnd.id);
            // Impasse : pas de sortie (pas de deadEnd → ville).
        }

        // 7. Lac de Qual-Chen : zone dédiée, toujours reliée à Qual-Chen.
        const lakeZone = ZoneFactory.create({
            name: STABLE_ZONE_NAMES.Lake,
            type: "Lake",
            zoneLevel: 1,
            seed: seed,
        });
        const lakeDungeon = new Dungeon(
            "Dungeon_Lake", // id déterministe (stable entre générations)
            STABLE_ZONE_NAMES.Lake,
            1,
            "Lake",
            [lakeZone]
        );
        worldMap.nodes.push(lakeDungeon);
        const qualChen = hubs.find((h) => h.name === "Qual-Chen")!;
        worldMap.addConnection(qualChen.id, lakeDungeon.id);
        worldMap.addConnection(lakeDungeon.id, qualChen.id);

        // 8. Calculer les niveaux (BFS depuis la racine).
        //    Le niveau d'une zone = nombre de zones traversées depuis la racine.
        //    Les villes ne comptent pas (elles sont des "nœuds de passage").
        const levelOf = new Map<string, number>([[root.id, 0]]);
        const visited = new Set<string>([root.id]);
        let frontier = [root.id];
        while (frontier.length > 0) {
            const next: string[] = [];
            for (const id of frontier) {
                const currentLevel = levelOf.get(id)!;
                const node = worldMap.nodes.find((n) => n.id === id);
                const isZone = node instanceof Dungeon;
                for (const target of (worldMap.edges.get(id) ?? [])) {
                    if (visited.has(target)) continue;
                    visited.add(target);
                    // Une zone ajoute 1 au niveau, une ville non.
                    const targetNode = worldMap.nodes.find((n) => n.id === target);
                    const targetIsZone = targetNode instanceof Dungeon;
                    levelOf.set(target, currentLevel + (targetIsZone ? 1 : 0));
                    next.push(target);
                }
            }
            frontier = next;
        }

        // Mettre à jour les niveaux des donjons.
        for (const dungeon of dungeons) {
            const level = levelOf.get(dungeon.id) ?? 1;
            dungeon.zoneLevel = level;
            dungeon.levels.forEach((lvl) => { lvl.zoneLevel = level; });
        }

        // 9. Démons ancrés en rencontres spéciales (Phase C2b).
        WorldLoader.anchorDemon(dungeons, "Forest", "Adrammelech, le Grand Courroux", "quest_kidnappeur");
        WorldLoader.anchorDemon(dungeons, "Cave", "Bélias, le Titan");
        WorldLoader.anchorDemon(dungeons, "Tower", "Hashmal, le Grand Ordonnateur");

        // 10. Porte de sang (Phase D) : case bloquante dans la caverne + Zeromus.
        WorldLoader.anchorBloodDoor(dungeons, "Cave");

        return worldMap;
    }

    /**
     * Ancre la **porte de sang** dans le **premier niveau** du donjon du biome
     * donné : une case **bloquante** sur laquelle est ancré Zeromus.
     *
     * Tant que la case est bloquée, on ne peut pas y marcher. Le rituel
     * (`ExplorationState.performBloodRitual`, objet "Cœur de sang") la débloque
     * et révèle Zeromus — un défi **optionnel** (le joueur choisit d'y marcher).
     *
     * @param dungeonList les donjons générés.
     * @param biome le biome du donjon cible (ex. "Cave").
     */
    private static anchorBloodDoor(dungeonList: Dungeon[], biome: ZoneType): void {
        const dungeon = dungeonList.find((d) => d.biome === biome);
        if (!dungeon || dungeon.levels.length === 0) return;
        const zone = dungeon.levels[0];

        // Position : une case praticable qui n'est ni le point de départ, ni déjà
        // occupée par une rencontre spéciale (ex. Bélias dans la caverne).
        const walkable: Position[] = [];
        zone.tileMap.forEach((row, r) =>
            row.forEach((walkableTile, c) => {
                if (walkableTile) walkable.push({ row: r, col: c });
            })
        );
        const used = new Set(zone.specialEncounters.map((se) => `${se.position.row},${se.position.col}`));
        const startKey = `${zone.startTile.row},${zone.startTile.col}`;
        const position = walkable.find(
            (p) => `${p.row},${p.col}` !== startKey && !used.has(`${p.row},${p.col}`)
        );
        if (!position) return;

        // La porte est une case bloquante ; Zeromus est ancré dessus.
        zone.blockedTiles.push(position);
        zone.specialEncounters.push({
            demonName: "Zeromus, le Condamnateur",
            position
        });
    }

    /**
     * Ancre un démon en rencontre spéciale dans le **premier niveau** du donjon
     * du biome donné. La case est une impasse si la zone en a une, sinon une
     * case praticable (jamais le point de départ).
     *
     * @param dungeonList les donjons générés.
     * @param biome le biome du donjon cible (ex. "Forest").
     * @param demonName le nom exact du démon.
     * @param requiresQuest id de la quête qui doit être acceptée (optionnel).
     */
    private static anchorDemon(
        dungeonList: Dungeon[],
        biome: ZoneType,
        demonName: string,
        requiresQuest?: string
    ): void {
        const dungeon = dungeonList.find((d) => d.biome === biome);
        if (!dungeon || dungeon.levels.length === 0) return;
        const zone = dungeon.levels[0];

        // Position : une impasse (cul-de-sac) de préférence, sinon une case
        // praticable qui n'est pas le point de départ.
        const deadEnd = zone.deadEnds[0];
        const walkable: Position[] = [];
        zone.tileMap.forEach((row, r) =>
            row.forEach((walkableTile, c) => {
                if (walkableTile) walkable.push({ row: r, col: c });
            })
        );
        const fallback = walkable.find(
            (p) => !(p.row === zone.startTile.row && p.col === zone.startTile.col)
        );
        const position = deadEnd ?? fallback;
        if (!position) return;

        zone.specialEncounters.push({
            demonName,
            position,
            deadEnd: !!deadEnd,
            requiresQuest
        });
    }
}