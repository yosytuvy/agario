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

export const useGameState = () => {
    const gameState = useRef<GameState>({
        player: {
            x: WORLD_SIZE / 2,
            y: WORLD_SIZE / 2,
            mass: START_MASS,
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
    const consumedEjectedIds = useRef<Set<number>>(new Set()); // Track consumed ejected to prevent multiple requests

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
                        
                        // Update player with starting mass from server and generate a color
                        gameState.current.player.mass = START_MASS;
                        gameState.current.player.radius = radiusFromMass(START_MASS);
                        gameState.current.player.color = `hsl(${Math.random() * 360},70%,60%)`;
                        
                        // Update player position to center of world
                        gameState.current.player.x = WORLD_SIZE / 2;
                        gameState.current.player.y = WORLD_SIZE / 2;
                        prevPos.current = { 
                            x: gameState.current.player.x, 
                            y: gameState.current.player.y 
                        };
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
                                // Virus was reset after splitting
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
                        players.forEach(p => otherPlayersMap.current.set(p.id, p));
                        gameState.current.otherPlayers = Array.from(otherPlayersMap.current.values());
                    },
                    // On player joined
                    (player) => {
                        otherPlayersMap.current.set(player.id, player);
                        gameState.current.otherPlayers = Array.from(otherPlayersMap.current.values());
                    },
                    // On player left
                    (playerId) => {
                        otherPlayersMap.current.delete(playerId);
                        gameState.current.otherPlayers = Array.from(otherPlayersMap.current.values());
                        // Remove their splits and ejected
                        gameState.current.otherPlayerSplits = gameState.current.otherPlayerSplits.filter(s => s.playerId !== playerId);
                        gameState.current.otherPlayerEjected = gameState.current.otherPlayerEjected.filter(e => e.playerId !== playerId);
                    },
                    // On player update
                    (playerId, x, y, mass, radius, color) => {
                        const player = otherPlayersMap.current.get(playerId);
                        if (player) {
                            player.x = x;
                            player.y = y;
                            player.mass = mass;
                            player.radius = radius;
                            if (color) {
                                player.color = color;
                            }
                        }
                    },
                    // On other player splits
                    (splits) => {
                        gameState.current.otherPlayerSplits = splits;
                    },
                    // On other player ejected
                    (ejected) => {
                        gameState.current.otherPlayerEjected = ejected;
                    },
                    // On player consumed
                    (targetId, targetType, consumerId, newMass, gainedMass, consumingEntityType, consumingEntityIndex) => {
                        if (targetType === 'player') {
                            // Check if I was the one consumed
                            if (targetId === playerIdRef.current) {
                                // I was eaten! Reset my player
                                console.log('I was eaten! Respawning...');
                                gameState.current.player.mass = START_MASS;
                                gameState.current.player.radius = radiusFromMass(START_MASS);
                                gameState.current.player.x = WORLD_SIZE / 2 + (Math.random() - 0.5) * 1000;
                                gameState.current.player.y = WORLD_SIZE / 2 + (Math.random() - 0.5) * 1000;
                                gameState.current.splits = [];
                                gameState.current.ejected = [];
                                return;
                            }
                            
                            // Check if I was the consumer - update mass
                            if (consumerId === playerIdRef.current && newMass) {
                                if (consumingEntityType === 'player') {
                                    // Update main player mass
                                    gameState.current.player.mass = newMass;
                                    gameState.current.player.radius = radiusFromMass(newMass);
                                    console.log(`Main player consumed player! Gained ${gainedMass} mass. New mass: ${newMass}`);
                                } else if (consumingEntityType === 'split' && consumingEntityIndex !== undefined && consumingEntityIndex >= 0) {
                                    // Update specific split mass
                                    const split = gameState.current.splits[consumingEntityIndex];
                                    if (split) {
                                        split.mass = newMass;
                                        console.log(`Split ${consumingEntityIndex} consumed player! Gained ${gainedMass} mass. New mass: ${newMass}`);
                                    }
                                }
                            }
                            
                            // Remove consumed player from otherPlayers
                            otherPlayersMap.current.delete(targetId);
                            gameState.current.otherPlayers = Array.from(otherPlayersMap.current.values());
                            // Remove their splits and ejected
                            gameState.current.otherPlayerSplits = gameState.current.otherPlayerSplits.filter(s => s.playerId !== targetId);
                            gameState.current.otherPlayerEjected = gameState.current.otherPlayerEjected.filter(e => e.playerId !== targetId);
                        } else if (targetType === 'split') {
                            // Check if I was the consumer - update mass
                            if (consumerId === playerIdRef.current && newMass) {
                                if (consumingEntityType === 'player') {
                                    // Update main player mass
                                    gameState.current.player.mass = newMass;
                                    gameState.current.player.radius = radiusFromMass(newMass);
                                    console.log(`Main player consumed split! Gained ${gainedMass} mass. New mass: ${newMass}`);
                                } else if (consumingEntityType === 'split' && consumingEntityIndex !== undefined && consumingEntityIndex >= 0) {
                                    // Update specific split mass
                                    const split = gameState.current.splits[consumingEntityIndex];
                                    if (split) {
                                        split.mass = newMass;
                                        console.log(`Split ${consumingEntityIndex} consumed split! Gained ${gainedMass} mass. New mass: ${newMass}`);
                                    }
                                }
                            }
                            
                            // Remove consumed split
                            const splitId = parseInt(targetId);
                            gameState.current.otherPlayerSplits = gameState.current.otherPlayerSplits.filter(s => s.id !== splitId);
                        }
                    },
                    // On other ejected consumed
                    (ejectedId, consumerId, newMass, gainedMass, consumingEntityType, consumingEntityIndex, originalOwnerId) => {
                        // Check if I was the consumer - update mass
                        if (consumerId === playerIdRef.current && newMass) {
                            if (consumingEntityType === 'player') {
                                // Update main player mass
                                gameState.current.player.mass = newMass;
                                gameState.current.player.radius = radiusFromMass(newMass);
                                console.log(`Main player consumed ejected! Gained ${gainedMass} mass. New mass: ${newMass}`);
                            } else if (consumingEntityType === 'split' && consumingEntityIndex !== undefined && consumingEntityIndex >= 0) {
                                // Update specific split mass
                                const split = gameState.current.splits[consumingEntityIndex];
                                if (split) {
                                    split.mass = newMass;
                                    console.log(`Split ${consumingEntityIndex} consumed ejected! Gained ${gainedMass} mass. New mass: ${newMass}`);
                                }
                            }
                        }
                        
                        // CRITICAL FIX: If I'm the original owner, clear my ejected array
                        if (originalOwnerId === playerIdRef.current) {
                            // Clear all my ejected masses to prevent re-adding consumed ones
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
    }, []);

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

    const consumePlayer = useCallback((targetId: string, targetType: 'player' | 'split', consumingEntityType?: 'player' | 'split', consumingEntityIndex?: number) => {
        if (wsService.current) {
            // Get the consuming entity's position and mass for server validation
            let consumingEntity = null;
            if (consumingEntityType === 'player') {
                consumingEntity = {
                    x: gameState.current.player.x,
                    y: gameState.current.player.y,
                    mass: gameState.current.player.mass
                };
            } else if (consumingEntityType === 'split' && consumingEntityIndex !== undefined && consumingEntityIndex >= 0) {
                const split = gameState.current.splits[consumingEntityIndex];
                if (split) {
                    consumingEntity = {
                        x: split.x,
                        y: split.y,
                        mass: split.mass
                    };
                }
            }
            
            wsService.current.consumePlayer(targetId, targetType, consumingEntityType, consumingEntityIndex, consumingEntity);
        }
    }, []);

    const consumeOtherEjected = useCallback((ejectedId: number, consumingEntityType?: 'player' | 'split', consumingEntityIndex?: number) => {
        if (wsService.current) {
            // Check if this ejected mass has already been consumed
            if (consumedEjectedIds.current.has(ejectedId)) {
                return; // Already consumed, don't send duplicate request
            }
            
            // Mark as consumed to prevent duplicate requests
            consumedEjectedIds.current.add(ejectedId);
            
            // Get the consuming entity's position and mass for server validation
            let consumingEntity = null;
            if (consumingEntityType === 'player') {
                consumingEntity = {
                    x: gameState.current.player.x,
                    y: gameState.current.player.y,
                    mass: gameState.current.player.mass
                };
            } else if (consumingEntityType === 'split' && consumingEntityIndex !== undefined && consumingEntityIndex >= 0) {
                const split = gameState.current.splits[consumingEntityIndex];
                if (split) {
                    consumingEntity = {
                        x: split.x,
                        y: split.y,
                        mass: split.mass
                    };
                }
            }
            
            wsService.current.consumeOtherEjected(ejectedId, consumingEntityType, consumingEntityIndex, consumingEntity);
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
            // Skip if this ejected mass belongs to our player
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
            // Skip if this split belongs to our player
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
                radius: radiusFromMass(split.mass),
                mass: split.mass,
                data: { ...split, color: state.player.color },
            });
        }

        // Add my player (last to render on top)
        entities.push({
            type: "player",
            x: state.player.x,
            y: state.player.y,
            radius: state.player.radius,
            mass: state.player.mass,
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