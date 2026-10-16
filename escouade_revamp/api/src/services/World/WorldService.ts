import { WorldMap } from "../../classes/World/WorldMap";
import { Hub } from "../../classes/World/Hub";
import { Dungeon } from "../../classes/World/Dungeon";
import { WorldLoader } from "../factory/WorldLoader";
import { getSpawnRatesForZoneType } from "../../utils/RandomUtils";

/**
 * Service du monde (mode ville / mappemonde).
 *
 * Génère le monde **une seule fois** (singleton) pour que les routes
 * `/world` et `/hub/:id` renvoient des données cohérentes (mêmes IDs, mêmes
 * connexions). Le front consomme cette sérialisation pour afficher la
 * mappemonde et les villes.
 */
/** Descriptions des villes (générées — l'élément était absent du livret). */
const HUB_DESCRIPTIONS: Record<string, string> = {
    "Auberge du matin":
        "Le point de départ de toute aventure. Cette auberge chaleureuse, au toit de chaume et aux fenêtres dorées de lumière, accueille les escouades avant qu'elles ne s'élancent vers l'inconnu. On y trouve un marchand, une auberge, un sanctuaire et le tableau des quêtes.",
    "Qual-Mastrech":
        "Une bourgade de marchands bâtie sur une route carrossable. Qual-Mastrech est un carrefour où les caravanes s'arrêtent pour ravitailler leurs bêtes et où les rumeurs du monde se croisent. Les marchands y sont nombreux, et les prix, négociables.",
    "Qual-Chen":
        "Un village de pêcheurs accroché aux rives du lac. Qual-Chen sent le poisson fumé et le sel ; ses quais s'étirent le long de l'eau calme où, dit-on, un vieux pêcheur solitaire jette encore sa ligne. C'est un lieu paisible, à l'écart des grands chemins.",
    "Qual-Far":
        "Une cité fortifiée de pierre grise, dernière ligne de défense avant les terres sauvages. Qual-Far est un poste militaire où l'on recrute des mercenaires et où l'on poste les quêtes les plus périlleuses. Ses remparts surplombent la plaine.",
};

/** Description par défaut pour une ville inconnue. */
const HUB_DESCRIPTION_DEFAULT =
    "Une localité de passage, modeste mais accueillante, où l'escouade peut se reposer et s'équiper avant de repartir.";

export class WorldService {
    private static world: WorldMap | null = null;

    /** Génère (ou retourne) le monde. Un seul monde par processus. */
    static async getWorld(): Promise<WorldMap> {
        if (!WorldService.world) {
            WorldService.world = await WorldLoader.generate();
        }
        return WorldService.world;
    }

    /** Sérialise un hub pour le front (id, nom, services, layout, description). */
    static serializeHub(hub: Hub) {
        return {
            id: hub.id,
            name: hub.name,
            services: hub.services,
            layout: hub.layout,
            description: HUB_DESCRIPTIONS[hub.name] ?? HUB_DESCRIPTION_DEFAULT,
        };
    }

    /**
     * Sérialise un donjon pour le front (id, nom, niveau, biome, nb d'étages,
     * **monstres** rencontrables). La liste des monstres est dérivée du biome
     * (mêmes rencontres que le moteur d'exploration).
     */
    static serializeDungeon(dungeon: Dungeon) {
        const spawnRates = getSpawnRatesForZoneType(dungeon.biome);
        return {
            id: dungeon.id,
            name: dungeon.name,
            zoneLevel: dungeon.zoneLevel,
            biome: dungeon.biome,
            floors: dungeon.levels.length,
            monsters: spawnRates.map((s) => s.monsterName),
        };
    }

    /** Sérialise le monde complet (nœuds + connexions). */
    static async getWorldSummary() {
        const world = await WorldService.getWorld();
        const hubs: ReturnType<typeof WorldService.serializeHub>[] = [];
        const dungeons: ReturnType<typeof WorldService.serializeDungeon>[] = [];
        for (const node of world.nodes) {
            if (node instanceof Hub) hubs.push(WorldService.serializeHub(node));
            else if (node instanceof Dungeon) dungeons.push(WorldService.serializeDungeon(node));
        }
        // Ne garder que les connexions hub↔donjon (pas les liaisons internes
        // entre étages d'un donjon, qui ne sont pas des nœuds du monde).
        const nodeIds = new Set<string>([
            ...hubs.map((h) => h.id),
            ...dungeons.map((d) => d.id),
        ]);
        const edges: Record<string, string[]> = {};
        world.edges.forEach((targets, from) => {
            if (!nodeIds.has(from)) return;
            const filtered = targets.filter((t) => nodeIds.has(t));
            if (filtered.length > 0) edges[from] = filtered;
        });
        return { hubs, dungeons, edges };
    }

    /** Récupère un hub par son id (ou null). */
    static async getHubById(hubId: string): Promise<Hub | null> {
        const world = await WorldService.getWorld();
        const node = world.nodes.find((n) => n.id === hubId);
        return node instanceof Hub ? node : null;
    }
}
