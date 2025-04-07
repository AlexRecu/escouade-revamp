import { Status } from "../Status";
import { Item } from "./Item";

export class Weapon extends Item {
    weaponType: string;
    mainStat: string;
    subStat: string;
    weaponStat: number;
    weaponSubStat: number;
    range: number;
    element: string;
    status?: Status | null;

    constructor(id: string, name: string, description: string, purchasePrice: number, zoneThreshold: number, weaponType: string, mainStat: string, subStat: string, weaponStat: number, weaponSubStat: number, range: number, element: string, status?: Status | null) {
        super(id, name, 'weapon', description, purchasePrice, zoneThreshold);
        this.weaponType = weaponType;
        this.mainStat = mainStat;
        this.subStat = subStat;
        this.weaponStat = weaponStat;
        this.weaponSubStat = weaponSubStat;
        this.range = range;
        this.status = status ?? null;
        this.element = element;
    }

};

export class Bow extends Weapon {
    constructor(id: string, name: string, description: string, purchasePrice: number, zoneThreshold: number, weaponStat: number, element: string, status?: Status | null) {
        super(id, name, description, purchasePrice, zoneThreshold, 'arc', 'Dexterite', '', weaponStat, 0, 3, element, status);
    }
};

export class Dagger extends Weapon {
    constructor(id: string, name: string, description: string, purchasePrice: number, zoneThreshold: number, weaponStat: number, element: string, status?: Status | null) {
        super(id, name, description, purchasePrice, zoneThreshold, 'dague', 'Dexterite', '', weaponStat, 0, 1, element, status);
    }
};

export class Hammer extends Weapon {
    constructor(id: string, name: string, description: string, purchasePrice: number, zoneThreshold: number, weaponStat: number, element: string, status?: Status | null) {
        super(id, name, description, purchasePrice, zoneThreshold, 'marteau', 'Force', '', weaponStat, 0, 1, element, status);
    }
};

export class Katana extends Weapon {
    constructor(id: string, name: string, description: string, purchasePrice: number, zoneThreshold: number, weaponStat: number, element: string, status?: Status | null) {
        super(id, name, description, purchasePrice, zoneThreshold, 'katana', 'Dexterite', '', weaponStat, 0, 1, element, status);
    }
};

export class Knuckles extends Weapon{
    constructor(id: string, name: string, description: string, purchasePrice: number, zoneThreshold: number, weaponStat: number, element: string, status?: Status | null) {
        super(id, name, description, purchasePrice, zoneThreshold, 'poing', 'Force', '', weaponStat, 0, 1, element, status);
    }
};

export class Lance extends Weapon{
    constructor(id: string, name: string, description: string, purchasePrice: number, zoneThreshold: number, weaponStat: number, weaponSubStat: number, element: string, status?: Status | null) {
        super(id, name, description, purchasePrice, zoneThreshold, 'lance', 'Force', 'Dexterite', weaponStat, weaponSubStat, 2, element, status);
    }
};

export class Mace extends Weapon{
    constructor(id: string, name: string, description: string, purchasePrice: number, zoneThreshold: number, weaponStat: number, element: string, status?: Status | null) {
        super(id, name, description, purchasePrice, zoneThreshold, 'masse', 'Force', '', weaponStat, 0, 1, element, status);
    }
};

export class Scepter extends Weapon{
    constructor(id: string, name: string, description: string, purchasePrice: number, zoneThreshold: number, weaponStat: number, element: string, status?: Status | null) {
        super(id, name, description, purchasePrice, zoneThreshold, 'sceptre', 'Dexterite', '', weaponStat, 0, 1, element, status);
    }
};

export class Sword extends Weapon{
    constructor(id: string, name: string, description: string, purchasePrice: number, zoneThreshold: number, weaponStat: number, element: string, status?: Status | null) {
        super(id, name, description, purchasePrice, zoneThreshold, 'epee', 'Force', '', weaponStat, 0, 1, element, status);
    }
};