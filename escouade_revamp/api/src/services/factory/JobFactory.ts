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
    static fromSerialized(data: any): Job {
        switch (data.name) {
            case "Mage blanc":
                return new WhiteMage();
            case "Mage noir":
                return new BlackMage();
            case "Mage rouge":
                return new RedMage();
            case "Mage bleu":
                return new BlueMage();
            case "Guerrier":
                return new Warrior();
            case "Voleur":
                return new Thief();
            case "Moine":
                return new Monk();
            // Ajoute les autres classes ici...
            default:
                throw new Error(`Unknown job type: ${data.name}`);
        }
    }
}
