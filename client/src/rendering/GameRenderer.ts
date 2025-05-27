import type { Entity } from '../types';
import { VirusRenderer } from './VirusRenderer';

// This will be set from server config
let VIRUS_MASS = 100;

export class GameRenderer {
    private ctx: CanvasRenderingContext2D;
    private canvas: HTMLCanvasElement;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
    }

    static setVirusMass(mass: number) {
        VIRUS_MASS = mass;
    }

    setupTransform(playerX: number, playerY: number, zoom: number): void {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.setTransform(
            zoom, 0, 0, zoom,
            this.canvas.width / 2 - playerX * zoom,
            this.canvas.height / 2 - playerY * zoom
        );
    }

    drawGrid(worldSize: number, gridSize: number): void {
        this.ctx.strokeStyle = "#dddddd";
        this.ctx.lineWidth = 1;
        
        // Vertical lines
        for (let x = 0; x <= worldSize; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, worldSize);
            this.ctx.stroke();
        }
        
        // Horizontal lines
        for (let y = 0; y <= worldSize; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(worldSize, y);
            this.ctx.stroke();
        }
    }

    sortEntities(entities: Entity[]): Entity[] {
        return entities.sort((a, b) => {
            // Viruses have mass from server config
            // Cells smaller than virus should render below viruses (behind)
            // Cells bigger than virus should render above viruses (on top)
            if (a.type === "virus" && b.type !== "virus") {
                return b.mass < VIRUS_MASS ? 1 : -1;
            }
            if (b.type === "virus" && a.type !== "virus") {
                return a.mass < VIRUS_MASS ? -1 : 1;
            }
            return a.mass - b.mass;
        });
    }

    drawEntity(entity: Entity): void {
        switch (entity.type) {
            case "virus":
            case "virusProjectile":
                VirusRenderer.draw(this.ctx, entity.x, entity.y, entity.data.mass);
                break;
            case "pellet":
                this.drawPellet(entity);
                break;
            case "ejected":
            case "otherEjected":
                this.drawEjected(entity);
                break;
            case "split":
                this.drawSplit(entity);
                break;
            case "otherSplit":
                this.drawOtherSplit(entity);
                break;
            case "player":
                this.drawPlayer(entity);
                break;
            case "otherPlayer":
                this.drawOtherPlayer(entity);
                break;
        }
    }

    private drawPellet(entity: Entity): void {
        this.ctx.beginPath();
        this.ctx.arc(entity.x, entity.y, entity.radius, 0, Math.PI * 2);
        this.ctx.fillStyle = entity.data.color;
        this.ctx.fill();
    }

    private drawEjected(entity: Entity): void {
        this.ctx.beginPath();
        this.ctx.arc(entity.x, entity.y, entity.radius, 0, Math.PI * 2);
        this.ctx.fillStyle = entity.data.color || "#66ccff";
        this.ctx.fill();
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = "#ffffff";
        this.ctx.stroke();
    }

    private drawSplit(entity: Entity): void {
        this.ctx.beginPath();
        this.ctx.arc(entity.x, entity.y, entity.radius, 0, Math.PI * 2);
        this.ctx.fillStyle = entity.data.color || "#66ccff";
        this.ctx.fill();
        this.ctx.lineWidth = 4;
        this.ctx.strokeStyle = "#ffffff";
        this.ctx.stroke();
        // No mass text for splits - only show on main player blob
    }

    private drawOtherSplit(entity: Entity): void {
        this.ctx.beginPath();
        this.ctx.arc(entity.x, entity.y, entity.radius, 0, Math.PI * 2);
        this.ctx.fillStyle = entity.data.color || "#999999";
        this.ctx.fill();
        this.ctx.lineWidth = 4;
        this.ctx.strokeStyle = "#ffffff";
        this.ctx.stroke();
        // No mass text for other players
    }

    private drawOtherPlayer(entity: Entity): void {
        this.ctx.beginPath();
        this.ctx.arc(entity.x, entity.y, entity.radius, 0, Math.PI * 2);
        this.ctx.fillStyle = entity.data.color || "#999999";
        this.ctx.fill();
        this.ctx.lineWidth = 6;
        this.ctx.strokeStyle = "#ffffff";
        this.ctx.stroke();
        // No mass text for other players
    }

    private drawPlayer(entity: Entity): void {
        this.ctx.beginPath();
        this.ctx.arc(entity.x, entity.y, entity.radius, 0, Math.PI * 2);
        this.ctx.fillStyle = entity.data.color || "#66ccff";
        this.ctx.fill();
        this.ctx.lineWidth = 6;
        this.ctx.strokeStyle = "#ffffff";
        this.ctx.stroke();

        // Draw mass text
        const playerFontSize = Math.max(14, entity.radius * 0.4);
        this.ctx.font = `bold ${playerFontSize}px Arial`;
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";

        // Black border (stroke)
        this.ctx.lineWidth = playerFontSize * 0.15;
        this.ctx.strokeStyle = "#000000";
        this.ctx.strokeText(
            Math.floor(entity.mass).toString(),
            entity.x,
            entity.y
        );

        // White fill
        this.ctx.fillStyle = "#ffffff";
        this.ctx.fillText(
            Math.floor(entity.mass).toString(),
            entity.x,
            entity.y
        );
    }
}