import { IdGenerator } from "../../utils/IdGeneratorUtils";
import { Status } from "../Status";
import { Item } from "./Item";

export class Tools extends Item {
    element: string;
    target: 'ally' | 'self' | 'enemy';
    power: number | null;
    status: Status | null = null;

    constructor(id: string, name: string, effect: string, element: string, target: 'ally' | 'self' | 'enemy', power: number | null, status: Status) {
        super(id, name, "consumable", effect, 0, 0);
        this.element = element;
        this.target = target;
        this.power = power;
        this.status = status;
    }

    static craft(toolName: "Doton" | "Katon" | "Raiton" | "Hyuton" | "Futon" | "Bunshin" | "Shuriken Fuma"): Tools {
        const toolData = {
            "Doton": { description: "Dégâts de Terre préparés dans un parchemin", element: "Terre", target: "enemy", power: 25, status: null },
            "Katon": { description: "Dégâts de Feu préparés dans un parchemin", element: "Feu", target: "enemy", power: 25, status: null },
            "Raiton": { description: "Dégâts de Foudre préparés dans un parchemin", element: "Foudre", target: "enemy", power: 25, status: null },
            "Hyuton": { description: "Dégâts de Glace préparés dans un parchemin", element: "Glace", target: "enemy", power: 25, status: null },
            "Futon": { description: "Dégâts de Vent préparés dans un parchemin", element: "Vent", target: "enemy", power: 25, status: null },
            "Bunshin": { description: "Invoque un clone depuis un parchemin qui peut encaisser une attaque à votre place", element: "", target: "self", power: null, status: { name: "Bunshin", statusType: "boon", nbTurnEffect: null, description: "Une image rémanente que l'ennemi attaque à votre place" } }, //TODO : Status "Bunshin" à implémenter
            "Shuriken Fuma": { description: "Invoque un shuriken géant qui s\’envole pour frapper l\’ennemi éloigné et tout sur son passage (3 cases)", element: "", target: "enemy", power: 30, status: null },
        };
    
        if (!(toolName in toolData)) {
            throw new Error(`Tools.craft : Tool '${toolName}' is unknown`);
        }
    
        const { description, element, target, power, status } = toolData[toolName];
        return new Tools("Tools_" + toolName + "_" + IdGenerator.generateId(), toolName, description, element, target as "enemy" | "ally" | "self", power, status as Status);
    }
}


