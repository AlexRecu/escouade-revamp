import { Hub } from "./Hub";
import { Dungeon } from "./Dungeon";

export class WorldMap {
    nodes: (Dungeon | Hub)[];
    edges: Map<string, string[]>;

    constructor(nodes: (Dungeon | Hub)[] = [], edges: Map<string, string[]> = new Map()) {
        this.nodes = nodes;
        this.edges = edges;
    }

    addConnection(from: string, to: string) {
        if (!this.edges.has(from)) this.edges.set(from, []);
        this.edges.get(from)!.push(to);
    }

}
