import React, { useRef, useEffect } from "react";
import { useGameState } from "../hooks/useGameState";
import { GameRenderer } from "../rendering/GameRenderer";
import { CollisionDetection } from "../physics/CollisionDetection";
import { InputHandler } from "../input/InputHandler";
import {
    EjectedManager,
    SplitBlobManager,
    PlayerManager,
} from "../entities/EntityManagers";

const GameCanvas: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<GameRenderer | null>(null);
    const mousePos = useRef({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
    });

    const { 
        gameState, 
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
        getWorldSize,
        getGridSize,
        getVirusExplodeThreshold,
        getVirusExplodeSpeed,
        getVirusMass,
        getEjectThreshold,
        getEjectLoss,
        getEjectMassGain,
        getEjectRange,
        getEjectSpeed,
        getSplitThreshold,
        getSplitSpeed,
        getSplitFlightDuration,
        getMergeSpeed,
        getDecayRate,
        getMyPlayerId
    } = useGameState();

    useEffect(() => {
        const canvas = canvasRef.current!;
        rendererRef.current = new GameRenderer(canvas);

        const onResize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        window.addEventListener("resize", onResize);
        onResize();

        const onMouseMove = (e: MouseEvent) => {
            mousePos.current = { x: e.clientX, y: e.clientY };
        };
        window.addEventListener("mousemove", onMouseMove);

        const onKeyDown = (e: KeyboardEvent) => {
            const worldMouseX =
                (mousePos.current.x - canvas.width / 2) / gameState.currentZoom +
                gameState.player.x;
            const worldMouseY =
                (mousePos.current.y - canvas.height / 2) / gameState.currentZoom +
                gameState.player.y;

            if (e.key === "w" || e.key === "W") {
                InputHandler.handleEject(
                    gameState.player,
                    gameState.splits,
                    gameState.ejected,
                    worldMouseX,
                    worldMouseY,
                    getEjectThreshold(),
                    getEjectLoss(),
                    getEjectMassGain(),
                    getEjectSpeed()
                );
            }
            
            if (e.key === " ") {
                const newSplits = InputHandler.handleSplit(
                    gameState.player,
                    gameState.splits,
                    worldMouseX,
                    worldMouseY,
                    getSplitThreshold(),
                    getSplitSpeed()
                );
                gameState.splits.push(...newSplits);
            }
        };
        window.addEventListener("keydown", onKeyDown);

        // Initialize game only once
        initializeGame();
        
        let lastTs = performance.now();
        let animationId: number;

        const gameLoop = (ts: number) => {
            const dt = (ts - lastTs) / 1000;
            lastTs = ts;
            const nowTs = Date.now();

            // Get player velocity for split blob mimicking
            const { velX, velY } = getPlayerVelocity(dt);

            // Update zoom
            updateZoom();

            // Setup rendering transform
            rendererRef.current!.setupTransform(
                gameState.player.x,
                gameState.player.y,
                gameState.currentZoom
            );

            // Draw grid with server-provided values
            rendererRef.current!.drawGrid(getWorldSize(), getGridSize());

            // Calculate mouse direction for player movement
            const pdx = mousePos.current.x - canvas.width / 2;
            const pdy = mousePos.current.y - canvas.height / 2;

            // Update player
            PlayerManager.update(gameState.player, pdx, pdy, dt, getWorldSize(), getDecayRate());

            // Update split blobs
            SplitBlobManager.update(
                gameState.splits,
                gameState.player,
                dt,
                nowTs,
                velX,
                velY,
                getWorldSize(),
                getSplitFlightDuration(),
                getMergeSpeed(),
                getDecayRate()
            );

            // Handle collision detection
            CollisionDetection.handleSplitBlobCollisions(
                gameState.player,
                gameState.splits,
                nowTs
            );

            // Update ejected masses
            EjectedManager.update(gameState.ejected, dt, getWorldSize(), getEjectRange());

            // Handle all collision checks
            CollisionDetection.checkEjectedCollisions(
                gameState.player,
                gameState.splits,
                gameState.ejected,
                gameState.viruses,
                feedVirus
            );

            // Check pellet collisions with server notification
            CollisionDetection.checkPelletCollisions(
                gameState.player,
                gameState.splits,
                gameState.pellets,
                consumePellet
            );

            const virusExplosionPieces = CollisionDetection.checkVirusCollisions(
                gameState.player,
                gameState.splits,
                gameState.viruses,
                getVirusExplodeThreshold(),
                getVirusExplodeSpeed(),
                getVirusMass(),
                consumeVirus
            );
            gameState.splits.push(...virusExplosionPieces);

            // NEW: Check player vs other players collisions
            CollisionDetection.checkPlayerVsOtherPlayersCollisions(
                gameState.player,
                gameState.splits,
                gameState.otherPlayers,
                gameState.otherPlayerSplits,
                getMyPlayerId(),
                (targetId, targetType, consumingEntityType, consumingEntityId) => 
                    consumePlayer(targetId, targetType, consumingEntityType, consumingEntityId)
            );

            // NEW: Check player vs other players' ejected mass collisions
            CollisionDetection.checkPlayerVsOtherEjectedCollisions(
                gameState.player,
                gameState.splits,
                gameState.otherPlayerEjected,
                (ejectedId, consumingEntityType, consumingEntityId) => 
                    consumeOtherEjected(ejectedId, consumingEntityType, consumingEntityId)
            );

            // Render all entities
            const allEntities = getAllEntities();
            const sortedEntities = rendererRef.current!.sortEntities(allEntities);
            
            for (const entity of sortedEntities) {
                rendererRef.current!.drawEntity(entity);
            }

            // Send player update to server
            sendPlayerUpdate();

            animationId = requestAnimationFrame(gameLoop);
        };

        animationId = requestAnimationFrame(gameLoop);

        return () => {
            window.removeEventListener("resize", onResize);
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("keydown", onKeyDown);
            cancelAnimationFrame(animationId);
        };
    }, []); // Remove all dependencies to ensure single initialization
    
    return <canvas ref={canvasRef} />;

};

export default GameCanvas;