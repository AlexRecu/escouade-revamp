// src/factory/JobFactory.ts
import { BlackMage } from "../../classes/Jobs/BlackMage";
import { BlueMage } from "../../classes/Jobs/BlueMage";
import { Job } from "../../classes/Jobs/Job";
import { Monk } from "../../classes/Jobs/Monk";
import { RedMage } from "../../classes/Jobs/RedMage";
import { Thief } from "../../classes/Jobs/Thief";
import { Warrior } from "../../classes/Jobs/Warrior";
import { WhiteMage } from "../../classes/Jobs/WhiteMage";

export class JobFactory {
    /**
     * Recrée un job depuis ses données sérialisées.
     *
     * `data.name` doit être le **nom de base** de la classe (ex. "Mage noir") —
     * c'est le champ `Job.baseName`, jamais muté par l'évolution. Les champs
     * optionnels restaurent l'état de progression :
     *  - `jobLevel` : niveau de la classe.
     *  - `evolvedName` : nom de l'évolution (ex. "Démoniste") → appliqué via
     *    `Job.applyEvolutionState` (sans re-jouer les bonus de stats, gérés par
     *    le personnage).
     *  - `recruitedDemons` : pactes du Démoniste (BlackMage).
     *
     * Rétro-compatible : un simple `{ name }` (ex. `HubService`) crée un job
     * neuf au niveau 1, sans évolution.
     */
    static fromSerialized(data: any): Job {
        const job = this.createJob(data.name);
        if (typeof data.jobLevel === "number") job.jobLevel = data.jobLevel;
        if (data.evolvedName) job.applyEvolutionState(data.evolvedName);
        if (job instanceof BlackMage && Array.isArray(data.recruitedDemons)) {
            job.recruitedDemons = [...data.recruitedDemons];
        }
        return job;
    }

    /**
     * Fabrique un job neuf (niveau 1, non évolué) à partir de son nom de base.
     *
     * Le matching est **insensible à la casse** : les noms réels des jobs
     * (ex. "Mage Noir") peuvent différer en casse des clés du switch
     * (ex. "Mage noir").
     */
    private static createJob(name: string): Job {
        switch (name.toLowerCase()) {
            case "mage blanc":
                return new WhiteMage();
            case "mage noir":
                return new BlackMage();
            case "mage rouge":
                return new RedMage();
            case "mage bleu":
                return new BlueMage();
            case "guerrier":
                return new Warrior();
            case "voleur":
                return new Thief();
            case "moine":
                return new Monk();
            // Ajoute les autres classes ici...
            default:
                throw new Error(`Unknown job type: ${name}`);
        }
    }
}