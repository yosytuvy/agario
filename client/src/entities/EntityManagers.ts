import type { Ejected, SplitBlob, Player } from '../types';
import { radiusFromMass, clampToWorld } from '../utils';
import { MIMIC_FACTOR } from '../constants';

// Growth smoothing factor - lower = slower growth, higher = faster growth
const GROWTH_SMOOTH_FACTOR = 0.08;

export class EjectedManager {
    static update(ejected: Ejected[], dt: number, worldSize: number, ejectRange: number): void {
        for (let i = ejected.length - 1; i >= 0; i--) {
            const p = ejected[i];
            if (p.travelled < ejectRange) {
                const mvx = p.vx * dt;
                const mvy = p.vy * dt;
                p.x += mvx;
                p.y += mvy;
                p.travelled += Math.hypot(mvx, mvy);
            } else {
                p.vx *= 0.92;
                p.vy *= 0.92;
                p.x += p.vx * dt;
                p.y += p.vy * dt;
            }
            
            const r2 = radiusFromMass(p.mass);
            const clamped = clampToWorld(p.x, p.y, r2, worldSize);
            p.x = clamped.x;
            p.y = clamped.y;
        }
    }
}

export class SplitBlobManager {
    static update(
        splits: SplitBlob[], 
        player: Player, 
        dt: number, 
        nowTs: number, 
        velX: number, 
        velY: number,
        worldSize: number,
        splitFlightDuration: number,
        mergeSpeed: number,
        decayRate: number
    ): SplitBlob[] {
        const toRemove: number[] = [];

        for (let i = splits.length - 1; i >= 0; i--) {
            const s = splits[i];
            const age = nowTs - s.born;

            // NEW: Smooth growth animation for splits
            if (s.visualMass !== s.mass) {
                const massDiff = s.mass - s.visualMass;
                s.visualMass += massDiff * GROWTH_SMOOTH_FACTOR;
                
                // Snap to actual mass when very close to avoid infinite animation
                if (Math.abs(massDiff) < 0.1) {
                    s.visualMass = s.mass;
                }
            }
            
            if (age < splitFlightDuration) {
                s.x += s.vx * dt;
                s.y += s.vy * dt;
            } else {
                s.x += velX * MIMIC_FACTOR * dt;
                s.y += velY * MIMIC_FACTOR * dt;
                const dxm = player.x - s.x;
                const dym = player.y - s.y;
                const dist = Math.hypot(dxm, dym) || 1;
                s.x += (dxm / dist) * mergeSpeed * (1 - MIMIC_FACTOR) * dt;
                s.y += (dym / dist) * mergeSpeed * (1 - MIMIC_FACTOR) * dt;
                
                // Use actual mass for merge detection, not visual mass
                if (age >= s.mergeDelay && dist < player.radius) {
                    player.mass += s.mass;
                    // Don't update visual mass here - let PlayerManager handle the smooth growth
                    toRemove.push(i);
                    continue;
                }
            }

            // Apply boundary constraints using visual mass for radius
            const r = radiusFromMass(s.visualMass);
            const clamped = clampToWorld(s.x, s.y, r, worldSize);
            s.x = clamped.x;
            s.y = clamped.y;

            // Apply decay to actual mass
            if (s.mass > 10) {
                s.mass -= s.mass * decayRate * dt;
                s.mass = Math.max(10, s.mass);
            }
        }

        // Remove merged splits
        for (const index of toRemove) {
            splits.splice(index, 1);
        }

        return splits;
    }
}

export class PlayerManager {
    static update(player: Player, mouseX: number, mouseY: number, dt: number, worldSize: number, decayRate: number): void {
        const pdx = mouseX;
        const pdy = mouseY;
        const peng = Math.atan2(pdy, pdx);
        
        // Use actual mass for speed calculation, not visual mass
        const pspd = 600 * Math.pow(player.mass, -0.35);
        
        player.x += Math.cos(peng) * pspd * dt;
        player.y += Math.sin(peng) * pspd * dt;
        
        // NEW: Smooth growth animation for player
        if (player.visualMass !== player.mass) {
            const massDiff = player.mass - player.visualMass;
            player.visualMass += massDiff * GROWTH_SMOOTH_FACTOR;
            
            // Snap to actual mass when very close to avoid infinite animation
            if (Math.abs(massDiff) < 0.1) {
                player.visualMass = player.mass;
            }
        }

        // Update radius using visual mass for smoother appearance
        player.radius = radiusFromMass(player.visualMass);
        
        // Boundary constraints using visual radius
        const clamped = clampToWorld(player.x, player.y, player.radius, worldSize);
        player.x = clamped.x;
        player.y = clamped.y;

        // Apply mass decay to actual mass
        if (player.mass > 10) {
            player.mass -= player.mass * decayRate * dt;
            player.mass = Math.max(10, player.mass);
        }
    }
}