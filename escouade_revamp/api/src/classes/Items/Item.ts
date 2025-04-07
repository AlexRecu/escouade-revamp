export class  Item {
    id: string;
    name: string;
    type: 'weapon' | 'consumable';
    description: string;
    purchasePrice: number;
    resaleBase: number;
    zoneThreshold: number;

    constructor(id: string, name: string, type: 'weapon' | 'consumable', effect: string, purchasePrice: number, zoneThreshold: number){
        this.id=id;
        this.name=name;
        this.type=type;
        this.description=effect;
        this.purchasePrice=purchasePrice;
        this.resaleBase=purchasePrice/2;
        this.zoneThreshold=zoneThreshold;
    }
}  