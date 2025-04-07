import { IdGenerator } from "../../utils/IdGeneratorUtils";
import { Item } from "./Item";

export class Consumable extends Item {
    hp: number = 0;
    mp: number = 0;
    revive: boolean = false;
    healingStatus: string[] = [];

    constructor(id_: string, name_: string, effect_: string, purchasePrice_: number, zoneThreshold_: number, hp_: number, mp_: number, revive_: boolean, healingStatus_: string[]) {
        super(id_, name_, "consumable", effect_, purchasePrice_, zoneThreshold_)
        this.hp = hp_;
        this.mp = mp_;
        this.revive = revive_;
        this.healingStatus = healingStatus_;
    }
}

export class Potion extends Consumable {
    constructor(){
        super("Potion_"+IdGenerator.generate(), "Potion", "Restitue 5 points de vie.", 60, 1, 5, 0, false, []);
    }
}

export class PotionPlus extends Consumable {
    constructor(){
        super("Potion+_"+IdGenerator.generate(), "Potion+", "Restitue 10 points de vie.", 100, 1, 10, 0, false, []);
    }
}

export class PotionX extends Consumable {
    constructor(){
        super("PotionX_"+IdGenerator.generate(), "PotionX", "Restitue 20 points de vie.", 120, 1, 20, 0, false, []);
    }
}

export class Ether extends Consumable {
    constructor(){
        super("Ether_"+IdGenerator.generate(), "Ether", "Restitue 3 points de magie.", 80, 1, 0, 3, false, []);
    }
}

export class EtherPlus extends Consumable {
    constructor(){
        super("Ether+_"+IdGenerator.generate(), "Ether+", "Restitue 6 points de magie.", 120, 1, 0, 6, false, []);
    }
}

export class EtherX extends Consumable {
    constructor(){
        super("EtherX_"+IdGenerator.generate(), "EtherX", "Restitue 10 points de magie.", 160, 1, 0, 10, false, []);
    }
}

export class Elixir extends Consumable {
    constructor(){
        super("Elixir_"+IdGenerator.generate(), "Elixir", "Restitue tous les points de vie et de magie.", 1000, 1, 20, 20, false, []);
    }
}

export class PhoenixDown extends Consumable {
    constructor(){
        super("QueueDePhenix_"+IdGenerator.generate(), "Queue de phénix", "Ranime un allié avec 10 points de vie.", 500, 1, 10, 0, true, []);
    }
}

export class Antidote extends Consumable {
    constructor(){
        super("Antidote_"+IdGenerator.generate(), "Antidote universel", "Guérit les empoisonnements.", 30, 1, 0, 0, false, ["Poison"]);
    }
}

export class Bocca extends Consumable {
    constructor(){
        super("Bocca_"+IdGenerator.generate(), "Bocca", "Guérit du Mutisme.", 30, 1, 0, 0, false, ["Mutisme"]);
    }
}

export class Defigeur extends Consumable {
    constructor(){
        super("Defigeur_"+IdGenerator.generate(), "Défigeur", "Guérit du statut Fossile.", 30, 1, 0, 0, false, ["Fossile"]);
    }
}

export class Collyre extends Consumable {
    constructor(){
        super("Collyre_"+IdGenerator.generate(), "Collyre", "Guérit de l'Aveuglement.", 30, 1, 0, 0, false, ["Aveuglement"]);
    }
}

export class Cream extends Consumable {
    constructor(){
        super("Creme_"+IdGenerator.generate(), "Crême chauffante", "Soigne la Paralysie.", 30, 1, 0, 0, false, ["Paralysie"]);
    }
}

export class Serum extends Consumable {
    constructor(){
        super("Serum_"+IdGenerator.generate(), "Sérum", "Soigne de toutes les altérations d'état.", 100, 1, 0, 0, false, ["Poison","Paralysie","Confusion","Sommeil","Fossile","Mutisme","Aveuglement"]);
    }
}