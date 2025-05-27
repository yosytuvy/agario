import { radiusFromMass } from '../utils';

// These will be set by GameRenderer
let VIRUS_COLOR = "#00ff00";
let VIRUS_SPIKE_COUNT = 24;

export class VirusRenderer {
    static setConfig(color: string, spikeCount: number) {
        VIRUS_COLOR = color;
        VIRUS_SPIKE_COUNT = spikeCount;
    }
    
    static draw(ctx: CanvasRenderingContext2D, x: number, y: number, mass: number): void {
        ctx.save();

        const radius = radiusFromMass(mass);

        // Draw the main virus body
        ctx.fillStyle = VIRUS_COLOR;
        ctx.beginPath();
        ctx.arc(x, y, radius * 0.85, 0, Math.PI * 2);
        ctx.fill();

        // Draw spikes
        ctx.fillStyle = VIRUS_COLOR;
        const spikeLength = radius * 0.25;
        const innerRadius = radius * 0.85;

        ctx.beginPath();
        for (let i = 0; i < VIRUS_SPIKE_COUNT; i++) {
            const angle = (i / VIRUS_SPIKE_COUNT) * Math.PI * 2;
            const nextAngle = ((i + 1) / VIRUS_SPIKE_COUNT) * Math.PI * 2;
            const midAngle = (angle + nextAngle) / 2;

            // Inner points
            const innerX1 = x + Math.cos(angle) * innerRadius;
            const innerY1 = y + Math.sin(angle) * innerRadius;
            const innerX2 = x + Math.cos(nextAngle) * innerRadius;
            const innerY2 = y + Math.sin(nextAngle) * innerRadius;

            // Spike point
            const spikeX = x + Math.cos(midAngle) * (innerRadius + spikeLength);
            const spikeY = y + Math.sin(midAngle) * (innerRadius + spikeLength);

            if (i === 0) {
                ctx.moveTo(innerX1, innerY1);
            }
            ctx.lineTo(spikeX, spikeY);
            ctx.lineTo(innerX2, innerY2);
        }
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }
}