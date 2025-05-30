import { useRef, useCallback, useEffect } from 'react';
import type { GameState, Entity, Pellet, Virus, VirusProjectile, OtherPlayer, OtherPlayerSplit, OtherPlayerEjected } from '../types';
import { MIN_ZOOM, SMOOTH_FACTOR } from '../constants';
import { radiusFromMass, setPelletRadius } from '../utils';
import { WebSocketService } from '../services/websocketService';
import { VirusRenderer } from '../rendering/VirusRenderer';
import { GameRenderer } from '../rendering/GameRenderer';

// These will be updated from server
let WORLD_SIZE = 11000;
let GRID_SIZE = 50;
let PELLET_RADIUS = 5;
let VIRUS_MASS = 100;
let VIRUS_COLOR = "#00ff00";
let VIRUS_SPIKE_COUNT = 24;
let VIRUS_EXPLODE_THRESHOLD = 133;
let VIRUS_EXPLODE_SPEED = 250;
let VIRUS_FEED_MASS = 15;
let VIRUS_FEEDS_TO_SPLIT = 7;
let VIRUS_PROJECTILE_SPEED = 350;
let VIRUS_PROJECTILE_RANGE = 350;
let EJECT_THRESHOLD = 35;
let EJECT_LOSS = 18;
let EJECT_MASS_GAIN = 13;
let EJECT_RANGE = 320;
let EJECT_SPEED = 350;
let SPLIT_THRESHOLD = 32;
let SPLIT_SPEED = 400;
let SPLIT_FLIGHT_DURATION = 1000;
let MERGE_SPEED = 100;
let START_MASS = 25;
let DECAY_RATE = 0.002;

export const useGameState = (onPlayerDeath?: () => void) => {
    const gameState = useRef<GameState>({
        player: {
            x: WORLD_SIZE / 2,
            y: WORLD_SIZE / 2,
            mass: START_MASS,
            visualMass: START_MASS, // NEW: Initialize visual mass
            radius: radiusFromMass(START_MASS),
            color: "#66ccff",
        },
        pellets: [],
        ejected: [],
        splits: [],
        viruses: [],
        virusProjectiles: [],
        currentZoom: 1,
        otherPlayers: [],
        otherPlayerSplits: [],
        otherPlayerEjected: [],
    });

    const prevPos = useRef({ x: gameState.current.player.x, y: gameState.current.player.y });
    const wsService = useRef<WebSocketService | null>(null);
    const pelletsMap = useRef<Map<number, Pellet>>(new Map());
    const virusesMap = useRef<Map<number, Virus>>(new Map());
    const virusProjectilesMap = useRef<Map<number, VirusProjectile>>(new Map());
    const otherPlayersMap = useRef<Map<string, OtherPlayer>>(new Map());
    const playerIdRef = useRef<string | null>(null);
    const consumedEjectedIds = useRef<Set<number>>(new Set());
    const consumedSplitsRef = useRef<Set<string>>(new Set());

    const resetGameState = useCallback(() => {
        // Reset player to initial state
        gameState.current.player = {
            x: WORLD_SIZE / 2 + (Math.random() - 0.5) * 1000,
            y: WORLD_SIZE / 2 + (Math.random() - 0.5) * 1000,
            mass: START_MASS,
            visualMass: START_MASS, // NEW: Initialize visual mass
            radius: radiusFromMass(START_MASS),
            color: `hsl(${Math.random() * 360},70%,60%)`,
        };

        // Clear all player-specific entities
        gameState.current.ejected = [];
        gameState.current.splits = [];
        gameState.current.currentZoom = 1;

        // Reset position tracking
        prevPos.current = { 
            x: gameState.current.player.x, 
            y: gameState.current.player.y 
        };

        // Clear consumed ejected tracking
        consumedEjectedIds.current.clear();
    }, []);

    const initializeGame = useCallback(() => {
        // Initialize WebSocket connection
        if (!wsService.current) {
            wsService.current = new WebSocketService();
            
            // Small delay to ensure component is mounted
            setTimeout(() => {
                wsService.current!.connect(
                    // On config received
                    (config) => {
                        WORLD_SIZE = config.worldSize;
                        GRID_SIZE = config.gridSize;
                        PELLET_RADIUS = config.pelletRadius;
                        setPelletRadius(config.pelletRadius);
                        
                        // Update virus constants
                        VIRUS_MASS = config.virusMass;
                        VIRUS_COLOR = config.virusColor;
                        VIRUS_SPIKE_COUNT = config.virusSpikeCount;
                        VIRUS_EXPLODE_THRESHOLD = config.virusExplodeThreshold;
                        VIRUS_EXPLODE_SPEED = config.virusExplodeSpeed;
                        VIRUS_FEED_MASS = config.virusFeedMass;
                        VIRUS_FEEDS_TO_SPLIT = config.virusFeedsToSplit;
                        VIRUS_PROJECTILE_SPEED = config.virusProjectileSpeed;
                        VIRUS_PROJECTILE_RANGE = config.virusProjectileRange;
                        
                        // Update ejection constants
                        EJECT_THRESHOLD = config.ejectThreshold;
                        EJECT_LOSS = config.ejectLoss;
                        EJECT_MASS_GAIN = config.ejectMassGain;
                        EJECT_RANGE = config.ejectRange;
                        EJECT_SPEED = config.ejectSpeed;
                        
                        // Update split constants
                        SPLIT_THRESHOLD = config.splitThreshold;
                        SPLIT_SPEED = config.splitSpeed;
                        SPLIT_FLIGHT_DURATION = config.splitFlightDuration;
                        MERGE_SPEED = config.mergeSpeed;
                        
                        // Update player constants
                        START_MASS = config.startMass;
                        DECAY_RATE = config.decayRate;
                        
                        // Update renderers with virus config
                        VirusRenderer.setConfig(config.virusColor, config.virusSpikeCount);
                        GameRenderer.setVirusMass(config.virusMass);
                        
                        // Always reset game state when receiving config (fresh start)
                        resetGameState();
                    },
                    // On player ID received
                    (playerId) => {
                        playerIdRef.current = playerId;
                        console.log('My player ID:', playerId);
                    },
                    // On pellets received
                    (pellets) => {
                        pelletsMap.current.clear();
                        pellets.forEach(p => pelletsMap.current.set(p.id, p));
                        gameState.current.pellets = Array.from(pelletsMap.current.values());
                    },
                    // On viruses received
                    (viruses) => {
                        virusesMap.current.clear();
                        viruses.forEach(v => virusesMap.current.set(v.id, v));
                        gameState.current.viruses = Array.from(virusesMap.current.values());
                    },
                    // On virus projectiles received
                    (projectiles) => {
                        virusProjectilesMap.current.clear();
                        projectiles.forEach(p => virusProjectilesMap.current.set(p.id, p));
                        gameState.current.virusProjectiles = Array.from(virusProjectilesMap.current.values());
                    },
                    // On pellet update
                    (consumedId, spawned) => {
                        pelletsMap.current.delete(consumedId);
                        pelletsMap.current.set(spawned.id, spawned);
                        gameState.current.pellets = Array.from(pelletsMap.current.values());
                    },
                    // On virus update
                    (consumedId, spawned) => {
                        virusesMap.current.delete(consumedId);
                        virusesMap.current.set(spawned.id, spawned);
                        gameState.current.viruses = Array.from(virusesMap.current.values());
                    },
                    // On virus feed
                    (virusId, newMass, projectileSpawned) => {
                        const virus = virusesMap.current.get(virusId);
                        if (virus) {
                            virus.mass = newMass;
                            if (newMass === VIRUS_MASS) {
                                virus.feedCount = 0;
                                virus.lastFeedAngle = undefined;
                            }
                        }
                        
                        if (projectileSpawned) {
                            virusProjectilesMap.current.set(projectileSpawned.id, projectileSpawned);
                            gameState.current.virusProjectiles = Array.from(virusProjectilesMap.current.values());
                        }
                    },
                    // On projectile updates
                    (updates) => {
                        updates.forEach(update => {
                            if (update.type === 'projectile_update') {
                                const proj = update.projectile;
                                virusProjectilesMap.current.set(proj.id, proj);
                            } else if (update.type === 'projectile_to_virus') {
                                virusProjectilesMap.current.delete(update.projectileId);
                                const virus = update.virus;
                                virusesMap.current.set(virus.id, virus);
                            }
                        });
                        gameState.current.virusProjectiles = Array.from(virusProjectilesMap.current.values());
                        gameState.current.viruses = Array.from(virusesMap.current.values());
                    },
                    // On other players received
                    (players) => {
                        otherPlayersMap.current.clear();
                        players.forEach(p => {
                            const newPlayer = {
                                ...p,
                                targetX: p.x,
                                targetY: p.y,
                                lastUpdateTime: Date.now(),
                                updateInterval: 50
                            };
                            otherPlayersMap.current.set(p.id, newPlayer);
                        });
                        gameState.current.otherPlayers = Array.from(otherPlayersMap.current.values());
                    },
                    // On player joined
                    (player) => {
                        // Initialize with interpolation fields
                        const newPlayer = {
                            ...player,
                            targetX: player.x,
                            targetY: player.y,
                            lastUpdateTime: Date.now(),
                            updateInterval: 50
                        };
                        otherPlayersMap.current.set(player.id, newPlayer);
                        gameState.current.otherPlayers = Array.from(otherPlayersMap.current.values());
                    },
                    // On player left
                    (playerId) => {
                        otherPlayersMap.current.delete(playerId);
                        gameState.current.otherPlayers = Array.from(otherPlayersMap.current.values());
                        gameState.current.otherPlayerSplits = gameState.current.otherPlayerSplits.filter(s => s.playerId !== playerId);
                        gameState.current.otherPlayerEjected = gameState.current.otherPlayerEjected.filter(e => e.playerId !== playerId);
                    },
                    // On player update
                    (playerId, x, y, mass, radius, color) => {
                        const player = otherPlayersMap.current.get(playerId);
                        const now = Date.now();
                        
                        if (player) {
                            // Store current position before updating
                            const prevX = player.x;
                            const prevY = player.y;
                            
                            // Update interpolation data
                            player.targetX = x;
                            player.targetY = y;
                            player.lastUpdateTime = now;
                            player.updateInterval = now - (player.lastUpdateTime || now);
                            
                            // If this is the first update, set position immediately
                            if (player.updateInterval === 0 || player.updateInterval > 1000) {
                                player.x = x;
                                player.y = y;
                            }
                            
                            player.mass = mass;
                            player.radius = radius;
                            if (color) {
                                player.color = color;
                            }
                        }
                    },
                    // On other player splits
                    (splits) => {
                        // Initialize splits with interpolation data
                        const splitsWithInterpolation = splits.map(split => ({
                            ...split,
                            targetX: split.x,
                            targetY: split.y,
                            lastUpdateTime: Date.now(),
                            updateInterval: 50
                        }));
                        gameState.current.otherPlayerSplits = splitsWithInterpolation;
                        console.log(`Received ${splits.length} other player splits`);
                    },
                    // On other player ejected
                    (ejected) => {
                        gameState.current.otherPlayerEjected = ejected;
                    },
                    // On player consumed
                    (targetId, targetType, consumerId, newMass, gainedMass, consumingEntityType, consumingEntityId) => {
                        if (targetType === 'player') {
                            // Check if I was the one consumed
                            if (targetId === playerIdRef.current) {
                                console.log('I was eaten! Triggering death screen and reconnecting...');
                                // Trigger death callback first
                                if (onPlayerDeath) {
                                    onPlayerDeath();
                                }
                                // Reconnect to get fresh player and clean state
                                if (wsService.current) {
                                    wsService.current.reconnect();
                                }
                                return;
                            }
                            
                            // Check if I was the consumer - update mass
                            if (consumerId === playerIdRef.current && newMass) {
                                if (consumingEntityType === 'player' && consumingEntityId === 'main') {
                                    gameState.current.player.mass = newMass;
                                    gameState.current.player.radius = radiusFromMass(newMass);
                                    console.log(`Main player consumed player! Gained ${gainedMass} mass. New mass: ${newMass}`);
                                } else if (consumingEntityType === 'split' && consumingEntityId) {
                                    const split = gameState.current.splits.find(s => s.id === consumingEntityId);
                                    if (split) {
                                        split.mass = newMass;
                                        console.log(`Split ${consumingEntityId} consumed player! Gained ${gainedMass} mass. New mass: ${newMass}`);
                                    }
                                }
                            }
                            
                            // Remove consumed player from otherPlayers
                            otherPlayersMap.current.delete(targetId);
                            gameState.current.otherPlayers = Array.from(otherPlayersMap.current.values());
                            gameState.current.otherPlayerSplits = gameState.current.otherPlayerSplits.filter(s => s.playerId !== targetId);
                            gameState.current.otherPlayerEjected = gameState.current.otherPlayerEjected.filter(e => e.playerId !== targetId);
                        } else if (targetType === 'split') {
                            // Check if I was the consumer - update mass
                            if (consumerId === playerIdRef.current && newMass) {
                                if (consumingEntityType === 'player' && consumingEntityId === 'main') {
                                    gameState.current.player.mass = newMass;
                                    gameState.current.player.radius = radiusFromMass(newMass);
                                    console.log(`Main player consumed split! Gained ${gainedMass} mass. New mass: ${newMass}`);
                                } else if (consumingEntityType === 'split' && consumingEntityId) {
                                    const split = gameState.current.splits.find(s => s.id === consumingEntityId);
                                    if (split) {
                                        split.mass = newMass;
                                        console.log(`Split ${consumingEntityId} consumed split! Gained ${gainedMass} mass. New mass: ${newMass}`);
                                    }
                                }
                            }
                            
                            // FIX: Remove consumed split with proper type handling
                            // Handle both string and number IDs
                            gameState.current.otherPlayerSplits = gameState.current.otherPlayerSplits.filter(s => {
                                // Compare both as strings to handle type mismatches
                                return s.id.toString() !== targetId.toString();
                            });
                            
                            console.log(`Removed split ${targetId}, remaining splits:`, gameState.current.otherPlayerSplits.length);
                        }
                    },
                    // On other ejected consumed
                    (ejectedId, consumerId, newMass, gainedMass, consumingEntityType, consumingEntityId, originalOwnerId) => {
                        // Check if I was the consumer - update mass
                        if (consumerId === playerIdRef.current && newMass) {
                            if (consumingEntityType === 'player' && consumingEntityId === 'main') {
                                gameState.current.player.mass = newMass;
                                gameState.current.player.radius = radiusFromMass(newMass);
                                console.log(`Main player consumed ejected! Gained ${gainedMass} mass. New mass: ${newMass}`);
                            } else if (consumingEntityType === 'split' && consumingEntityId) {
                                const split = gameState.current.splits.find(s => s.id === consumingEntityId);
                                if (split) {
                                    split.mass = newMass;
                                    console.log(`Split ${consumingEntityId} consumed ejected! Gained ${gainedMass} mass. New mass: ${newMass}`);
                                }
                            }
                        }
                        
                        // CRITICAL FIX: If I'm the original owner, clear my ejected array
                        if (originalOwnerId === playerIdRef.current) {
                            gameState.current.ejected = [];
                            console.log(`Cleared my ejected array because someone consumed my ejected mass`);
                        }
                        
                        // Remove consumed ejected mass from otherPlayerEjected array (for all clients)
                        gameState.current.otherPlayerEjected = gameState.current.otherPlayerEjected.filter(e => e.id !== ejectedId);
                        
                        // Remove from consumed tracking set
                        consumedEjectedIds.current.delete(ejectedId);
                    }
                );
            }, 100);
        }
    }, [onPlayerDeath, resetGameState]);

    const consumePellet = useCallback((pelletId: number) => {
        if (wsService.current) {
            wsService.current.consumePellet(pelletId);
        }
    }, []);

    const feedVirus = useCallback((virusId: number, angle: number) => {
        if (wsService.current) {
            wsService.current.feedVirus(virusId, angle);
        }
    }, []);

    const consumeVirus = useCallback((virusId: number) => {
        if (wsService.current) {
            wsService.current.consumeVirus(virusId);
        }
    }, []);

    const consumePlayer = useCallback((targetId: string, targetType: 'player' | 'split', consumingEntityType?: 'player' | 'split', consumingEntityId?: string) => {
        // Prevent double consumption
        const consumedKey = `${targetType}-${targetId}`;
        if (consumedSplitsRef.current.has(consumedKey)) {
            return;
        }
        
        if (wsService.current) {
            consumedSplitsRef.current.add(consumedKey);
            
            let consumingEntity = null;
            if (consumingEntityType === 'player') {
                consumingEntity = {
                    x: gameState.current.player.x,
                    y: gameState.current.player.y,
                    mass: gameState.current.player.mass
                };
            } else if (consumingEntityType === 'split' && consumingEntityId) {
                const split = gameState.current.splits.find(s => s.id === consumingEntityId);
                if (split) {
                    consumingEntity = {
                        x: split.x,
                        y: split.y,
                        mass: split.mass
                    };
                }
            }
            
            wsService.current.consumePlayer(targetId, targetType, consumingEntityType, consumingEntityId, consumingEntity);
        }
    }, []);

    const consumeOtherEjected = useCallback((ejectedId: number, consumingEntityType?: 'player' | 'split', consumingEntityId?: string) => {
        if (wsService.current) {
            if (consumedEjectedIds.current.has(ejectedId)) {
                return;
            }
            
            consumedEjectedIds.current.add(ejectedId);
            
            let consumingEntity = null;
            if (consumingEntityType === 'player') {
                consumingEntity = {
                    x: gameState.current.player.x,
                    y: gameState.current.player.y,
                    mass: gameState.current.player.mass
                };
            } else if (consumingEntityType === 'split' && consumingEntityId) {
                const split = gameState.current.splits.find(s => s.id === consumingEntityId);
                if (split) {
                    consumingEntity = {
                        x: split.x,
                        y: split.y,
                        mass: split.mass
                    };
                }
            }
            
            wsService.current.consumeOtherEjected(ejectedId, consumingEntityType, consumingEntityId, consumingEntity);
        }
    }, []);

    const updateZoom = useCallback(() => {
        const m = gameState.current.player.mass;
        const targetZoom = Math.max(MIN_ZOOM, 1 - m * 0.0015);
        gameState.current.currentZoom += 
            (targetZoom - gameState.current.currentZoom) * SMOOTH_FACTOR;
    }, []);

    const getPlayerVelocity = useCallback((dt: number) => {
        const velX = (gameState.current.player.x - prevPos.current.x) / dt;
        const velY = (gameState.current.player.y - prevPos.current.y) / dt;
        prevPos.current = { 
            x: gameState.current.player.x, 
            y: gameState.current.player.y 
        };
        return { velX, velY };
    }, []);

    const sendPlayerUpdate = useCallback(() => {
        if (wsService.current) {
            wsService.current.sendPlayerUpdate(
                gameState.current.player.x,
                gameState.current.player.y,
                gameState.current.player.mass,
                gameState.current.player.radius,
                gameState.current.player.color,
                gameState.current.splits,
                gameState.current.ejected
            );
        }
    }, []);

    const getMyPlayerId = useCallback(() => {
        return playerIdRef.current || '';
    }, []);

    const getAllEntities = useCallback((): Entity[] => {
        const entities: Entity[] = [];
        const state = gameState.current;

        // Add viruses
        for (const virus of state.viruses) {
            entities.push({
                type: "virus",
                x: virus.x,
                y: virus.y,
                radius: radiusFromMass(virus.mass),
                mass: virus.mass,
                data: virus,
            });
        }

        // Add virus projectiles
        for (const proj of state.virusProjectiles) {
            entities.push({
                type: "virusProjectile",
                x: proj.x,
                y: proj.y,
                radius: radiusFromMass(proj.mass),
                mass: proj.mass,
                data: proj,
            });
        }

        // Add pellets
        for (const pel of state.pellets) {
            entities.push({
                type: "pellet",
                x: pel.x,
                y: pel.y,
                radius: radiusFromMass(pel.mass),
                mass: pel.mass,
                data: pel,
            });
        }

        // Add other players' ejected (but not our own!)
        for (const ej of state.otherPlayerEjected) {
            if (playerIdRef.current && ej.playerId === playerIdRef.current) {
                continue;
            }
            
            const player = otherPlayersMap.current.get(ej.playerId);
            entities.push({
                type: "otherEjected",
                x: ej.x,
                y: ej.y,
                radius: radiusFromMass(ej.mass),
                mass: ej.mass,
                data: { ...ej, color: player?.color || "#999999" },
            });
        }

        // Add other players' splits (but not our own!)
        for (const split of state.otherPlayerSplits) {
            if (playerIdRef.current && split.playerId === playerIdRef.current) {
                continue;
            }
            
            const player = otherPlayersMap.current.get(split.playerId);
            entities.push({
                type: "otherSplit",
                x: split.x,
                y: split.y,
                radius: radiusFromMass(split.mass),
                mass: split.mass,
                data: { ...split, color: player?.color || "#999999" },
            });
        }

        // Add other players
        for (const player of state.otherPlayers) {
            entities.push({
                type: "otherPlayer",
                x: player.x,
                y: player.y,
                radius: player.radius,
                mass: player.mass,
                data: { color: player.color },
            });
        }

        // Add my ejected
        for (const ej of state.ejected) {
            entities.push({
                type: "ejected",
                x: ej.x,
                y: ej.y,
                radius: radiusFromMass(ej.mass),
                mass: ej.mass,
                data: { ...ej, color: state.player.color },
            });
        }

        // Add my splits
        for (const split of state.splits) {
            entities.push({
                type: "split",
                x: split.x,
                y: split.y,
                radius: radiusFromMass(split.visualMass), // NEW: Use visual mass for rendering
                mass: split.visualMass, // NEW: Use visual mass for rendering
                data: { ...split, color: state.player.color },
            });
        }

        // Add my player (last to render on top)
        entities.push({
            type: "player",
            x: state.player.x,
            y: state.player.y,
            radius: state.player.radius, // Already calculated using visual mass in PlayerManager
            mass: state.player.visualMass, // NEW: Use visual mass for rendering
            data: { color: state.player.color },
        });

        return entities;
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (wsService.current) {
                wsService.current.disconnect();
            }
        };
    }, []);

    return {
        gameState: gameState.current,
        initializeGame,
        updateZoom,
        getPlayerVelocity,
        getAllEntities,
        consumePellet,
        feedVirus,
        consumeVirus,
        consumePlayer,
        consumeOtherEjected,
        sendPlayerUpdate,
        getMyPlayerId,
        consumedSplitsRef,
        resetGame: resetGameState,
        getWorldSize: () => WORLD_SIZE,
        getGridSize: () => GRID_SIZE,
        getVirusExplodeThreshold: () => VIRUS_EXPLODE_THRESHOLD,
        getVirusExplodeSpeed: () => VIRUS_EXPLODE_SPEED,
        getVirusMass: () => VIRUS_MASS,
        getEjectThreshold: () => EJECT_THRESHOLD,
        getEjectLoss: () => EJECT_LOSS,
        getEjectMassGain: () => EJECT_MASS_GAIN,
        getEjectRange: () => EJECT_RANGE,
        getEjectSpeed: () => EJECT_SPEED,
        getSplitThreshold: () => SPLIT_THRESHOLD,
        getSplitSpeed: () => SPLIT_SPEED,
        getSplitFlightDuration: () => SPLIT_FLIGHT_DURATION,
        getMergeSpeed: () => MERGE_SPEED,
        getStartMass: () => START_MASS,
        getDecayRate: () => DECAY_RATE,
    };
};