export interface Pellet {
    id: number; // Added id field for server tracking
    x: number;
    y: number;
    mass: number;
    color: string;
}

export interface Ejected {
    x: number;
    y: number;
    vx: number;
    vy: number;
    travelled: number;
    mass: number;
}

export interface SplitBlob {
    id: string; // Added unique ID for split blob
    x: number;
    y: number;
    vx: number;
    vy: number;
    mass: number;
    born: number;
    mergeDelay: number;
}

export interface Virus {
    id: number; // Added id field for server tracking
    x: number;
    y: number;
    mass: number;
    feedCount: number;
    lastFeedAngle?: number;
}

export interface VirusProjectile {
    id: number; // Added id field for server tracking
    x: number;
    y: number;
    vx: number;
    vy: number;
    travelled: number;
    mass: number;
}

export interface Player {
    x: number;
    y: number;
    mass: number;
    radius: number;
    color: string;
}

export interface OtherPlayer {
    id: string;
    x: number;
    y: number;
    mass: number;
    radius: number;
    color: string;
}

export interface OtherPlayerSplit {
    id: number;
    playerId: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    mass: number;
    born: number;
    mergeDelay: number;
}

export interface OtherPlayerEjected {
    id: number;
    playerId: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    travelled: number;
    mass: number;
}

export interface GameState {
    player: Player;
    pellets: Pellet[];
    ejected: Ejected[];
    splits: SplitBlob[];
    viruses: Virus[];
    virusProjectiles: VirusProjectile[];
    currentZoom: number;
    otherPlayers: OtherPlayer[];
    otherPlayerSplits: OtherPlayerSplit[];
    otherPlayerEjected: OtherPlayerEjected[];
}

export interface Entity {
    type: string;
    x: number;
    y: number;
    radius: number;
    mass: number;
    data?: any;
}