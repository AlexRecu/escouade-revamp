import { Character } from "../UnitTypes/Character";
import { Monster } from "../UnitTypes/Monster";
import { Unit } from "../UnitTypes/Unit";
import { Item } from "./Item";

export class  Monstronomicon extends Item {
    units: Unit[];
    level: number;

    constructor(id: string) {
        super(
            id,
            "Monstronomicon",
            "consumable",
            "Une encyclopédie compilant l'ensemble des créatures du royaume, on y trouve leur forces et faiblesses seuls les plus grands Sages bleus peuvent l'utiliser pleinement.",
            0,
            0
        );
        this.units = [];
        this.level = 2;
    }

    addUnit(unit: Unit): void {
        this.units.push(unit);
    }

    removeUnit(unit: Unit): void {
        this.units = this.units.filter(u => u !== unit);
    }

    isRegistered(target: Unit): boolean {
        return this.units.some(unit => unit.name === target.name);
    }

    isScannable(target: Unit): boolean {
        return (target instanceof Monster && this.level >= target.rank) || target instanceof Character;
    }

    setLevel(newLevel: number): void {
        if (newLevel > 0) {
            this.level = newLevel;
        }
    }

}