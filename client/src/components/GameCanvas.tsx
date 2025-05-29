import React, { useRef, useEffect, useState, useCallback } from "react";
import { useGameState } from "../hooks/useGameState";
import { GameRenderer } from "../rendering/GameRenderer";
import { CollisionDetection } from "../physics/CollisionDetection";
import { InputHandler } from "../input/InputHandler";
import {
    EjectedManager,
    SplitBlobManager,
    PlayerManager,
} from "../entities/EntityManagers";
import StartScreen from "./StartScreen";

const GameCanvas: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<GameRenderer | null>(null);
    const mousePos = useRef({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
    });

    const [gameStarted, setGameStarted] = useState(false);
    const [backgroundOffset, setBackgroundOffset] = useState({ x: 0, y: 0 });
    const animationIdRef = useRef<number>();

    const handlePlayerDeath = useCallback(() => {
        setGameStarted(false);
        // Generate new random background offset
        const randomX = Math.random() * 2000 - 1000;
        const randomY = Math.random() * 2000 - 1000;
        setBackgroundOffset({ x: randomX, y: randomY });
    }, []);

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
        getMyPlayerId,
        resetGame
    } = useGameState(handlePlayerDeath);

    // Generate random background offset for start screen
    useEffect(() => {
        const randomX = Math.random() * 2000 - 1000;
        const randomY = Math.random() * 2000 - 1000;
        setBackgroundOffset({ x: randomX, y: randomY });
    }, []);

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

        // Initialize game only once
        initializeGame();

        return () => {
            window.removeEventListener("resize", onResize);
            window.removeEventListener("mousemove", onMouseMove);
            if (animationIdRef.current) {
                cancelAnimationFrame(animationIdRef.current);
            }
        };
    }, []); // Remove gameStarted dependency to prevent re-initialization

    // Separate effect for keyboard events that depends on gameStarted
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            // Only handle input when game is started
            if (!gameStarted) return;

            const canvas = canvasRef.current!;
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
                e.preventDefault();
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

        return () => {
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [gameStarted, gameState.currentZoom]); // Add dependencies so it updates when game state changes

    // Separate effect for game loop to control performance
    useEffect(() => {
        let lastTs = performance.now();

        const gameLoop = (ts: number) => {
            const dt = (ts - lastTs) / 1000;
            lastTs = ts;
            const nowTs = Date.now();

            // PERFORMANCE FIX: Reduce update frequency when on start screen
            if (!gameStarted) {
                // Only update 10 times per second when on start screen
                if (ts % 100 < 16) { // Roughly every 100ms
                    renderStartScreenBackground();
                }
                animationIdRef.current = requestAnimationFrame(gameLoop);
                return;
            }

            // Normal game loop when playing
            const { velX, velY } = getPlayerVelocity(dt);
            updateZoom();

            // Setup rendering transform
            rendererRef.current!.setupTransform(
                gameState.player.x,
                gameState.player.y,
                gameState.currentZoom
            );

            // Clear any filters for active gameplay
            const ctx = canvasRef.current!.getContext('2d')!;
            ctx.filter = 'none';

            // Draw grid
            rendererRef.current!.drawGrid(getWorldSize(), getGridSize());

            // Calculate mouse direction for player movement
            const pdx = mousePos.current.x - canvasRef.current!.width / 2;
            const pdy = mousePos.current.y - canvasRef.current!.height / 2;

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

            CollisionDetection.checkPlayerVsOtherPlayersCollisions(
                gameState.player,
                gameState.splits,
                gameState.otherPlayers,
                gameState.otherPlayerSplits,
                getMyPlayerId(),
                (targetId, targetType, consumingEntityType, consumingEntityId) => 
                    consumePlayer(targetId, targetType, consumingEntityType, consumingEntityId)
            );

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

            animationIdRef.current = requestAnimationFrame(gameLoop);
        };

        const renderStartScreenBackground = () => {
            const canvas = canvasRef.current!;
            const ctx = canvas.getContext('2d')!;
            
            // PERFORMANCE FIX: Apply gray filter via canvas, not CSS
            rendererRef.current!.setupTransform(
                getWorldSize() / 2 + backgroundOffset.x,
                getWorldSize() / 2 + backgroundOffset.y,
                0.5
            );

            // Draw grid
            rendererRef.current!.drawGrid(getWorldSize(), getGridSize());

            // Draw some entities for background
            const allEntities = getAllEntities();
            const sortedEntities = rendererRef.current!.sortEntities(allEntities);
            
            // PERFORMANCE FIX: Only draw a subset of entities for background
            for (let i = 0; i < Math.min(sortedEntities.length, 50); i++) {
                rendererRef.current!.drawEntity(sortedEntities[i]);
            }

            // Apply grayscale effect via canvas globalCompositeOperation
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = 'rgba(128, 128, 128, 0.7)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.globalCompositeOperation = 'source-over';
        };

        animationIdRef.current = requestAnimationFrame(gameLoop);

        return () => {
            if (animationIdRef.current) {
                cancelAnimationFrame(animationIdRef.current);
            }
        };
    }, [gameStarted]); // Only depend on gameStarted

    const handleStartGame = () => {
        setGameStarted(true);
        // Generate new random background offset for next time
        const randomX = Math.random() * 2000 - 1000;
        const randomY = Math.random() * 2000 - 1000;
        setBackgroundOffset({ x: randomX, y: randomY });
    };

    return (
        <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
            <canvas 
                ref={canvasRef} 
                style={{ 
                    display: 'block',
                    background: '#f0f0f0'
                }} 
            />
            {!gameStarted && (
                <StartScreen onStartGame={handleStartGame} />
            )}
        </div>
    );
};

export default GameCanvas;