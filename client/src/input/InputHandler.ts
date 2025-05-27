import type { Player, SplitBlob, Ejected } from '../types';
import { radiusFromMass, getPelletRadius } from '../utils';
import { EJECT_SPREAD } from '../constants';

export class InputHandler {
    static handleEject(
        player: Player,
        splits: SplitBlob[],
        ejected: Ejected[],
        worldMouseX: number,
        worldMouseY: number,
        ejectThreshold: number,
        ejectLoss: number,
        ejectMassGain: number,
        ejectSpeed: number
    ): void {
        // Calculate base direction from main player to mouse
        const baseDx = worldMouseX - player.x;
        const baseDy = worldMouseY - player.y;
        const baseAng = Math.atan2(baseDy, baseDx);
        const pelletRadius = getPelletRadius();

        // Eject from main player if big enough
        if (player.mass >= ejectThreshold) {
            player.mass -= ejectLoss;
            const ang = baseAng + (Math.random() * 2 - 1) * EJECT_SPREAD;
            const px = player.x + Math.cos(ang) * (player.radius + pelletRadius);
            const py = player.y + Math.sin(ang) * (player.radius + pelletRadius);
            const vx = Math.cos(ang) * ejectSpeed;
            const vy = Math.sin(ang) * ejectSpeed;
            
            ejected.push({
                x: px,
                y: py,
                vx,
                vy,
                travelled: 0,
                mass: ejectMassGain,
            });
        }

        // Eject from all split blobs that are big enough
        for (let i = 0; i < splits.length; i++) {
            const s = splits[i];
            if (s.mass >= ejectThreshold) {
                s.mass -= ejectLoss;
                const ang = baseAng + (Math.random() * 2 - 1) * EJECT_SPREAD;
                const sRadius = radiusFromMass(s.mass + ejectLoss); // Use original radius
                const px = s.x + Math.cos(ang) * (sRadius + pelletRadius);
                const py = s.y + Math.sin(ang) * (sRadius + pelletRadius);
                const vx = Math.cos(ang) * ejectSpeed;
                const vy = Math.sin(ang) * ejectSpeed;
                
                ejected.push({
                    x: px,
                    y: py,
                    vx,
                    vy,
                    travelled: 0,
                    mass: ejectMassGain,
                });
            }
        }
    }

    static handleSplit(
        player: Player,
        splits: SplitBlob[],
        worldMouseX: number,
        worldMouseY: number,
        splitThreshold: number,
        splitSpeed: number
    ): SplitBlob[] {
        const now = Date.now();
        const newSplits: SplitBlob[] = [];

        // Calculate base direction from main player to mouse
        const baseDx = worldMouseX - player.x;
        const baseDy = worldMouseY - player.y;
        const baseAng = Math.atan2(baseDy, baseDx);

        // Split main player if big enough
        if (player.mass >= splitThreshold) {
            const half = player.mass / 2;
            player.mass = half;
            player.radius = radiusFromMass(half);
            const vx = Math.cos(baseAng) * splitSpeed;
            const vy = Math.sin(baseAng) * splitSpeed;
            const mergeDelay = 30000 + 0.02333 * half * 1000;
            
            newSplits.push({
                x: player.x,
                y: player.y,
                vx,
                vy,
                mass: half,
                born: now,
                mergeDelay,
            });
        }

        // Split all existing split blobs that are big enough
        for (let i = 0; i < splits.length; i++) {
            const s = splits[i];
            if (s.mass >= splitThreshold) {
                const half = s.mass / 2;
                s.mass = half; // Update the existing split blob
                const vx = Math.cos(baseAng) * splitSpeed;
                const vy = Math.sin(baseAng) * splitSpeed;
                const mergeDelay = 30000 + 0.02333 * half * 1000;
                
                newSplits.push({
                    x: s.x,
                    y: s.y,
                    vx,
                    vy,
                    mass: half,
                    born: now,
                    mergeDelay,
                });
            }
        }

        return newSplits;
    }
}