import { Item } from "./Items/Item";


export class Status {
    name: string = "";
    description?: string;
    statusType?: 'boon' | 'curse';
    counterItem?: Item[];
    nbTurnEffect: number | null = null;
    aoe?: boolean;
    chance?: number;
};
