export class  Item {
    id: string;
    name: string;
    type: 'weapon' | 'consumable' | 'quest' | 'special';
    description: string;
    purchasePrice: number;
    resaleBase: number;
    zoneThreshold: number;

    constructor(id: string, name: string, type: 'weapon' | 'consumable' | 'quest' | 'special', effect: string, purchasePrice: number, zoneThreshold: number){
        this.id=id;
        this.name=name;
        this.type=type;
        this.description=effect;
        this.purchasePrice=purchasePrice;
        // L'or est toujours un nombre entier : on arrondit le prix de revente
        // à l'entier inférieur (sinon un prix impair donne une fraction).
        this.resaleBase=Math.floor(purchasePrice/2);
        this.zoneThreshold=zoneThreshold;
    }
}  