import { Zone } from "../../classes/World/Zone";
import { Unit } from "../../classes/UnitTypes/Unit";
import { Monster } from "../../classes/UnitTypes/Monster";
import { Position } from "../../classes/Types";
import { isOccupied } from "../../utils/PositionUtils";

const GRID_SIZE = 8;

/**
 * Service de génération de vagues de monstres pour une zone.
 *
 * S'appuie sur la `Zone` qui connaît déjà :
 *  - ses taux de spawn (`spawnRates`) et la pondération (`rollForEncounter`)
 *  - son niveau (`level`) pour le scaling des monstres
 *
 * NB : la décision du *nombre* d'ennemis d'une rencontre (formule du livret
 * basée sur Charisme/Dextérité + Repousse) relève de l'`EncounterEngine`
 * (Phase 2). Ce service se contente de matérialiser une vague de monstres
 * sur des cases libres du plateau.
 */
export class SpawnService {
    /**
     * Génère une vague de monstres pour une zone.
     * - Choisit chaque monstre selon les taux de spawn de la zone (pondération).
     * - Place chaque monstre sur une case libre du plateau (8x8).
     * @param zone La zone d'exploration.
     * @param allUnits Toutes les unités déjà présentes (pour éviter les collisions).
     * @param waveSize Nombre de monstres à générer (défaut : 1 + niveau de zone / 2).
     * @returns La vague de monstres générés.
     */
    spawnWave(zone: Zone, allUnits: Unit[], waveSize?: number): Monster[] {
        const size = waveSize ?? Math.max(1, Math.ceil(zone.zoneLevel / 2));
        const wave: Monster[] = [];

        for (let i = 0; i < size; i++) {
            const monsterName = zone.rollForEncounter()[0];
            const position = this.findFreePosition(allUnits);
            if (!position) break; // Plus aucune case libre sur le plateau.

            const monster = new Monster(monsterName, position, "Enemy", zone.zoneLevel);
            wave.push(monster);
            allUnits.push(monster); // On occupe la case pour les monstres suivants.
        }

        return wave;
    }

    /**
     * Trouve une case libre aléatoire sur le plateau (8x8).
     * @param units Les unités déjà présentes.
     * @returns Une position libre, ou null si le plateau est saturé.
     */
    private findFreePosition(units: Unit[]): Position | null {
        const free: Position[] = [];
        for (let row = 0; row < GRID_SIZE; row++) {
            for (let col = 0; col < GRID_SIZE; col++) {
                const pos = { row, col };
                if (!isOccupied(pos, units)) free.push(pos);
            }
        }
        if (free.length === 0) return null;
        return free[Math.floor(Math.random() * free.length)];
    }
}
  