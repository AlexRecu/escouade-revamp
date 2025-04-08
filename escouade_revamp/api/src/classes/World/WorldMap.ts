// src/classes/World/WorldMap.ts

import { Zone } from "./Zone";
import { Hub } from "./Hub";
import { Dungeon } from "./Dungeon";

export class WorldMap {
    nodes: (Dungeon | Hub)[];
    edges: Map<string, string[]>; // nodeId -> list of connected nodeIds

    constructor(nodes: (Dungeon | Hub)[] = [], edges: Map<string, string[]> = new Map()) {
        this.nodes = nodes;
        this.edges = edges;
    }

    addConnection(from: string, to: string) {
        if (!this.edges.has(from)) this.edges.set(from, []);
        this.edges.get(from)!.push(to);
    }

    //   zones: Map<string, Zone>;
    //   hubs: Map<string, Hub>;
    //   connections: Map<string, string[]>; // Nom → destinations accessibles

    //   constructor() {
    //     this.zones = new Map();
    //     this.hubs = new Map();
    //     this.connections = new Map();
    //   }

    //   addZone(zone: Zone): void {
    //     this.zones.set(zone.name, zone);
    //   }

    //   addHub(hub: Hub): void {
    //     this.hubs.set(hub.name, hub);
    //   }

    //   connectPlaces(placeA: string, placeB: string): void {
    //     if (!this.connections.has(placeA)) this.connections.set(placeA, []);
    //     if (!this.connections.has(placeB)) this.connections.set(placeB, []);
    //     this.connections.get(placeA)!.push(placeB);
    //     this.connections.get(placeB)!.push(placeA);
    //   }

    //   getAccessiblePlaces(from: string): string[] {
    //     return this.connections.get(from) ?? [];
    //   }

    //   getZone(name: string): Zone | undefined {
    //     return this.zones.get(name);
    //   }

    //   getHub(name: string): Hub | undefined {
    //     return this.hubs.get(name);
    //   }
}
