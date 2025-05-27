import type { Ejected, SplitBlob, Player } from '../types';
import { radiusFromMass, clampToWorld } from '../utils';
import { MIMIC_FACTOR } from '../constants';

// PelletManager removed - pellets are now fully managed by the server
// VirusManager removed - viruses are now fully managed by the server
// VirusProjectileManager removed - virus projectiles are now fully managed by the server

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
                
                if (age >= s.mergeDelay && dist < player.radius) {
                    player.mass += s.mass;
                    toRemove.push(i);
                    continue;
                }
            }

            // Apply boundary constraints
            const r = radiusFromMass(s.mass);
            const clamped = clampToWorld(s.x, s.y, r, worldSize);
            s.x = clamped.x;
            s.y = clamped.y;

            // Apply decay
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
        const pspd = 600 * Math.pow(player.mass, -0.35);
        
        player.x += Math.cos(peng) * pspd * dt;
        player.y += Math.sin(peng) * pspd * dt;
        
        // Boundary constraints
        const clamped = clampToWorld(player.x, player.y, player.radius, worldSize);
        player.x = clamped.x;
        player.y = clamped.y;

        // Update radius
        player.radius = radiusFromMass(player.mass);

        // Apply mass decay
        if (player.mass > 10) {
            player.mass -= player.mass * decayRate * dt;
            player.mass = Math.max(10, player.mass);
        }
    }
}