import type { Pellet, Virus, VirusProjectile, OtherPlayer, OtherPlayerSplit, OtherPlayerEjected, SplitBlob, Ejected } from '../types';

interface GameConfig {
    worldSize: number;
    gridSize: number;
    pelletCount: number;
    pelletRadius: number;
    virusCount: number;
    virusMass: number;
    virusColor: string;
    virusSpikeCount: number;
    virusExplodeThreshold: number;
    virusExplodeSpeed: number;
    virusFeedMass: number;
    virusFeedsToSplit: number;
    virusProjectileSpeed: number;
    virusProjectileRange: number;
    ejectThreshold: number;
    ejectLoss: number;
    ejectMassGain: number;
    ejectRange: number;
    ejectSpeed: number;
    splitThreshold: number;
    splitSpeed: number;
    splitFlightDuration: number;
    mergeSpeed: number;
    startMass: number;
    decayRate: number;
}

interface ServerPellet {
    id: number;
    x: number;
    y: number;
    mass: number;
    color: string;
}

interface ServerVirus {
    id: number;
    x: number;
    y: number;
    mass: number;
    feedCount: number;
    lastFeedAngle?: number;
}

interface ServerVirusProjectile {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    travelled: number;
    mass: number;
}

export class WebSocketService {
    private ws: WebSocket | null = null;
    private reconnectInterval: number | null = null;
    private lastUpdateTime: number = 0;
    private updateInterval: number = 50; // Send updates every 50ms
    
    // Callbacks
    private onConfigReceived: ((config: GameConfig) => void) | null = null;
    private onPlayerIdReceived: ((playerId: string) => void) | null = null;
    private onPelletsReceived: ((pellets: Pellet[]) => void) | null = null;
    private onVirusesReceived: ((viruses: Virus[]) => void) | null = null;
    private onVirusProjectilesReceived: ((projectiles: VirusProjectile[]) => void) | null = null;
    private onPelletUpdate: ((consumed: number, spawned: ServerPellet) => void) | null = null;
    private onVirusUpdate: ((consumed: number, spawned: ServerVirus) => void) | null = null;
    private onVirusFeed: ((virusId: number, newMass: number, projectileSpawned?: ServerVirusProjectile) => void) | null = null;
    private onProjectileUpdates: ((updates: any[]) => void) | null = null;
    private onOtherPlayersReceived: ((players: OtherPlayer[]) => void) | null = null;
    private onPlayerJoined: ((player: OtherPlayer) => void) | null = null;
    private onPlayerLeft: ((playerId: string) => void) | null = null;
    private onPlayerUpdate: ((playerId: string, x: number, y: number, mass: number, radius: number, color?: string) => void) | null = null;
    private onOtherPlayerSplitsReceived: ((splits: OtherPlayerSplit[]) => void) | null = null;
    private onOtherPlayerEjectedReceived: ((ejected: OtherPlayerEjected[]) => void) | null = null;
    private onPlayerConsumed: ((targetId: string, targetType: 'player' | 'split', consumerId?: string, newMass?: number, gainedMass?: number, consumingEntityType?: string, consumingEntityId?: string) => void) | null = null;
    private onOtherEjectedConsumed: ((ejectedId: number, consumerId?: string, newMass?: number, gainedMass?: number, consumingEntityType?: string, consumingEntityId?: string, originalOwnerId?: string) => void) | null = null;

    constructor(
        private url: string = 'ws://localhost:8000/ws'
    ) {}

    connect(
        onConfig: (config: GameConfig) => void,
        onPlayerId: (playerId: string) => void,
        onPellets: (pellets: Pellet[]) => void,
        onViruses: (viruses: Virus[]) => void,
        onVirusProjectiles: (projectiles: VirusProjectile[]) => void,
        onPelletUpdate: (consumed: number, spawned: ServerPellet) => void,
        onVirusUpdate: (consumed: number, spawned: ServerVirus) => void,
        onVirusFeed: (virusId: number, newMass: number, projectileSpawned?: ServerVirusProjectile) => void,
        onProjectileUpdates: (updates: any[]) => void,
        onOtherPlayers: (players: OtherPlayer[]) => void,
        onPlayerJoined: (player: OtherPlayer) => void,
        onPlayerLeft: (playerId: string) => void,
        onPlayerUpdate: (playerId: string, x: number, y: number, mass: number, radius: number, color?: string) => void,
        onOtherPlayerSplits: (splits: OtherPlayerSplit[]) => void,
        onOtherPlayerEjected: (ejected: OtherPlayerEjected[]) => void,
        onPlayerConsumed: (targetId: string, targetType: 'player' | 'split', consumerId?: string, newMass?: number, gainedMass?: number, consumingEntityType?: string, consumingEntityId?: string) => void,
        onOtherEjectedConsumed: (ejectedId: number, consumerId?: string, newMass?: number, gainedMass?: number, consumingEntityType?: string, consumingEntityId?: string, originalOwnerId?: string) => void
    ) {
        this.onConfigReceived = onConfig;
        this.onPlayerIdReceived = onPlayerId;
        this.onPelletsReceived = onPellets;
        this.onVirusesReceived = onViruses;
        this.onVirusProjectilesReceived = onVirusProjectiles;
        this.onPelletUpdate = onPelletUpdate;
        this.onVirusUpdate = onVirusUpdate;
        this.onVirusFeed = onVirusFeed;
        this.onProjectileUpdates = onProjectileUpdates;
        this.onOtherPlayersReceived = onOtherPlayers;
        this.onPlayerJoined = onPlayerJoined;
        this.onPlayerLeft = onPlayerLeft;
        this.onPlayerUpdate = onPlayerUpdate;
        this.onOtherPlayerSplitsReceived = onOtherPlayerSplits;
        this.onOtherPlayerEjectedReceived = onOtherPlayerEjected;
        this.onPlayerConsumed = onPlayerConsumed;
        this.onOtherEjectedConsumed = onOtherEjectedConsumed;

        console.log('Attempting to connect to:', this.url);
        
        try {
            this.ws = new WebSocket(this.url);

            this.ws.onopen = () => {
                console.log('Connected to server');
                if (this.reconnectInterval) {
                    clearInterval(this.reconnectInterval);
                    this.reconnectInterval = null;
                }
            };

            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            };

            this.ws.onclose = (event) => {
                console.log('Disconnected from server', event.code, event.reason);
                this.attemptReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        } catch (error) {
            console.error('Failed to create WebSocket:', error);
            this.attemptReconnect();
        }
    }

    // NEW: Reconnect method for fresh start after death
    reconnect() {
        console.log('Reconnecting to server for fresh start...');
        
        // Disconnect current connection
        this.disconnect();
        
        // Clear state
        this.resetState();
        
        // Reconnect after short delay
        setTimeout(() => {
            this.connect(
                this.onConfigReceived!,
                this.onPlayerIdReceived!,
                this.onPelletsReceived!,
                this.onVirusesReceived!,
                this.onVirusProjectilesReceived!,
                this.onPelletUpdate!,
                this.onVirusUpdate!,
                this.onVirusFeed!,
                this.onProjectileUpdates!,
                this.onOtherPlayersReceived!,
                this.onPlayerJoined!,
                this.onPlayerLeft!,
                this.onPlayerUpdate!,
                this.onOtherPlayerSplitsReceived!,
                this.onOtherPlayerEjectedReceived!,
                this.onPlayerConsumed!,
                this.onOtherEjectedConsumed!
            );
        }, 500);
    }

    private resetState() {
        // Reset timing
        this.lastUpdateTime = 0;
        
        // Clear any existing reconnect attempts
        if (this.reconnectInterval) {
            clearInterval(this.reconnectInterval);
            this.reconnectInterval = null;
        }
    }

    private handleMessage(data: any) {
        switch (data.type) {
            case 'init':
                if (this.onPlayerIdReceived) {
                    this.onPlayerIdReceived(data.playerId);
                }
                if (this.onConfigReceived) {
                    this.onConfigReceived(data.config);
                }
                if (this.onPelletsReceived) {
                    const pellets = data.pellets.map((p: ServerPellet) => ({
                        id: p.id,
                        x: p.x,
                        y: p.y,
                        mass: p.mass,
                        color: p.color
                    }));
                    this.onPelletsReceived(pellets);
                }
                if (this.onVirusesReceived && data.viruses) {
                    const viruses = data.viruses.map((v: ServerVirus) => ({
                        id: v.id,
                        x: v.x,
                        y: v.y,
                        mass: v.mass,
                        feedCount: v.feedCount,
                        lastFeedAngle: v.lastFeedAngle
                    }));
                    this.onVirusesReceived(viruses);
                }
                if (this.onVirusProjectilesReceived && data.virusProjectiles) {
                    const projectiles = data.virusProjectiles.map((p: ServerVirusProjectile) => ({
                        id: p.id,
                        x: p.x,
                        y: p.y,
                        vx: p.vx,
                        vy: p.vy,
                        travelled: p.travelled,
                        mass: p.mass
                    }));
                    this.onVirusProjectilesReceived(projectiles);
                }
                if (this.onOtherPlayersReceived && data.players) {
                    this.onOtherPlayersReceived(data.players);
                }
                if (this.onOtherPlayerSplitsReceived && data.playerSplits) {
                    this.onOtherPlayerSplitsReceived(data.playerSplits);
                }
                if (this.onOtherPlayerEjectedReceived && data.playerEjected) {
                    this.onOtherPlayerEjectedReceived(data.playerEjected);
                }
                break;
            
            case 'player_joined':
                if (this.onPlayerJoined) {
                    this.onPlayerJoined(data.player);
                }
                break;
            
            case 'player_left':
                if (this.onPlayerLeft) {
                    this.onPlayerLeft(data.playerId);
                }
                break;
            
            case 'player_update':
                if (this.onPlayerUpdate) {
                    this.onPlayerUpdate(data.playerId, data.x, data.y, data.mass, data.radius, data.color);
                }
                if (this.onOtherPlayerSplitsReceived && data.splits) {
                    this.onOtherPlayerSplitsReceived(data.splits);
                }
                if (this.onOtherPlayerEjectedReceived && data.ejected) {
                    this.onOtherPlayerEjectedReceived(data.ejected);
                }
                break;
            
            case 'pellet_update':
                if (this.onPelletUpdate) {
                    this.onPelletUpdate(data.consumed, data.spawned);
                }
                break;
            
            case 'virus_update':
                if (this.onVirusUpdate) {
                    this.onVirusUpdate(data.consumed, data.spawned);
                }
                break;
            
            case 'virus_feed':
                if (this.onVirusFeed) {
                    this.onVirusFeed(data.virusId, data.newMass, data.projectileSpawned);
                }
                break;
            
            case 'projectile_updates':
                if (this.onProjectileUpdates) {
                    this.onProjectileUpdates(data.updates);
                }
                break;
            
            case 'player_consumed':
                if (this.onPlayerConsumed) {
                    this.onPlayerConsumed(data.targetId, data.targetType, data.consumerId, data.newMass, data.gainedMass, data.consumingEntityType, data.consumingEntityId);
                }
                break;
            
            case 'other_ejected_consumed':
                if (this.onOtherEjectedConsumed) {
                    this.onOtherEjectedConsumed(data.ejectedId, data.consumerId, data.newMass, data.gainedMass, data.consumingEntityType, data.consumingEntityId, data.originalOwnerId);
                }
                break;
        }
    }

    sendPlayerUpdate(x: number, y: number, mass: number, radius: number, color: string, splits: SplitBlob[], ejected: Ejected[]) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const now = Date.now();
            if (now - this.lastUpdateTime >= this.updateInterval) {
                this.lastUpdateTime = now;
                
                // Convert splits and ejected to simple objects
                const splitsData = splits.map(s => ({
                    id: s.id,
                    x: s.x,
                    y: s.y,
                    vx: s.vx,
                    vy: s.vy,
                    mass: s.mass,
                    born: s.born,
                    mergeDelay: s.mergeDelay
                }));
                
                const ejectedData = ejected.map(e => ({
                    x: e.x,
                    y: e.y,
                    vx: e.vx,
                    vy: e.vy,
                    travelled: e.travelled,
                    mass: e.mass
                }));
                
                this.ws.send(JSON.stringify({
                    type: 'player_update',
                    x: x,
                    y: y,
                    mass: mass,
                    radius: radius,
                    color: color,
                    splits: splitsData,
                    ejected: ejectedData
                }));
            }
        }
    }

    consumePellet(pelletId: number) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'consume_pellet',
                pelletId: pelletId
            }));
        }
    }

    feedVirus(virusId: number, angle: number) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'feed_virus',
                virusId: virusId,
                angle: angle
            }));
        }
    }

    consumeVirus(virusId: number) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'consume_virus',
                virusId: virusId
            }));
        }
    }

    consumePlayer(targetId: string, targetType: 'player' | 'split', consumingEntityType?: 'player' | 'split', consumingEntityId?: string, consumingEntity?: {x: number, y: number, mass: number}) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'consume_player',
                targetId: targetId,
                targetType: targetType,
                consumingEntityType: consumingEntityType || 'player',
                consumingEntityId: consumingEntityId || 'main',
                consumingEntity: consumingEntity
            }));
        }
    }

    consumeOtherEjected(ejectedId: number, consumingEntityType?: 'player' | 'split', consumingEntityId?: string, consumingEntity?: {x: number, y: number, mass: number}) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'consume_other_ejected',
                ejectedId: ejectedId,
                consumingEntityType: consumingEntityType || 'player',
                consumingEntityId: consumingEntityId || 'main',
                consumingEntity: consumingEntity
            }));
        }
    }

    private attemptReconnect() {
        if (!this.reconnectInterval) {
            this.reconnectInterval = window.setInterval(() => {
                console.log('Attempting to reconnect...');
                this.connect(
                    this.onConfigReceived!,
                    this.onPlayerIdReceived!,
                    this.onPelletsReceived!,
                    this.onVirusesReceived!,
                    this.onVirusProjectilesReceived!,
                    this.onPelletUpdate!,
                    this.onVirusUpdate!,
                    this.onVirusFeed!,
                    this.onProjectileUpdates!,
                    this.onOtherPlayersReceived!,
                    this.onPlayerJoined!,
                    this.onPlayerLeft!,
                    this.onPlayerUpdate!,
                    this.onOtherPlayerSplitsReceived!,
                    this.onOtherPlayerEjectedReceived!,
                    this.onPlayerConsumed!,
                    this.onOtherEjectedConsumed!
                );
            }, 3000);
        }
    }

    disconnect() {
        if (this.reconnectInterval) {
            clearInterval(this.reconnectInterval);
            this.reconnectInterval = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}