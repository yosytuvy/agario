import type {
	Player,
	SplitBlob,
	Pellet,
	Ejected,
	Virus,
	OtherPlayer,
	OtherPlayerSplit,
	OtherPlayerEjected,
} from '../types';
import { distance, radiusFromMass } from '../utils';

export class CollisionDetection {
	static handleSplitBlobCollisions(
		player: Player,
		splits: SplitBlob[],
		nowTs: number
	): void {
		// Handle multiple iterations for stability
		for (let iteration = 0; iteration < 3; iteration++) {
			// Handle split blob to player collisions
			for (let i = 0; i < splits.length; i++) {
				const s = splits[i];
				if (nowTs - s.born < s.mergeDelay) {
					const rS = radiusFromMass(s.mass);
					const rP = player.radius;
					const dx = s.x - player.x;
					const dy = s.y - player.y;
					let d = Math.hypot(dx, dy);
					const minD = rP + rS;

					if (d < 1e-3) {
						const a = Math.random() * 2 * Math.PI;
						s.x = player.x + Math.cos(a) * minD;
						s.y = player.y + Math.sin(a) * minD;
					} else if (d < minD) {
						const nx = dx / d;
						const ny = dy / d;
						s.x = player.x + nx * minD;
						s.y = player.y + ny * minD;
					}
				}
			}

			// Handle collisions between split blobs themselves
			for (let i = 0; i < splits.length; i++) {
				const s1 = splits[i];
				const r1 = radiusFromMass(s1.mass);
				const s1CannotMerge = nowTs - s1.born < s1.mergeDelay;

				for (let j = i + 1; j < splits.length; j++) {
					const s2 = splits[j];
					const r2 = radiusFromMass(s2.mass);
					const s2CannotMerge = nowTs - s2.born < s2.mergeDelay;

					if (s1CannotMerge || s2CannotMerge) {
						const dx = s2.x - s1.x;
						const dy = s2.y - s1.y;
						let d = Math.hypot(dx, dy);
						const minD = r1 + r2;

						if (d < minD && d > 1e-3) {
							const nx = dx / d;
							const ny = dy / d;
							const overlap = minD - d;
							const pushForce = overlap * 0.5;

							s1.x -= nx * pushForce * 0.5;
							s1.y -= ny * pushForce * 0.5;
							s2.x += nx * pushForce * 0.5;
							s2.y += ny * pushForce * 0.5;
						} else if (d <= 1e-3) {
							const a = Math.random() * 2 * Math.PI;
							const minSep = 2;
							s1.x -= Math.cos(a) * minSep;
							s1.y -= Math.sin(a) * minSep;
							s2.x += Math.cos(a) * minSep;
							s2.y += Math.sin(a) * minSep;
						}
					}
				}
			}
		}
	}

	static checkPelletCollisions(
		player: Player,
		splits: SplitBlob[],
		pellets: Pellet[],
		onPelletConsumed: (pelletId: number) => void
	): void {
		for (let i = pellets.length - 1; i >= 0; i--) {
			const pel = pellets[i];
			let eaten = false;

			// Check collision with main player
			if (distance(pel.x, pel.y, player.x, player.y) < player.radius) {
				player.mass += pel.mass;
				onPelletConsumed(pel.id); // Notify server
				eaten = true;
			}

			// Check collision with split blobs
			if (!eaten) {
				for (let j = 0; j < splits.length; j++) {
					const s = splits[j];
					const splitRadius = radiusFromMass(s.mass);
					if (distance(pel.x, pel.y, s.x, s.y) < splitRadius) {
						s.mass += pel.mass;
						onPelletConsumed(pel.id); // Notify server
						eaten = true;
						break;
					}
				}
			}
		}
	}

	static checkEjectedCollisions(
		player: Player,
		splits: SplitBlob[],
		ejected: Ejected[],
		viruses: Virus[],
		onVirusFeed: (virusId: number, angle: number) => void
	): void {
		for (let i = ejected.length - 1; i >= 0; i--) {
			const p = ejected[i];
			let eaten = false;

			// Check collision with viruses first (feeding mechanism)
			for (let j = viruses.length - 1; j >= 0; j--) {
				const virus = viruses[j];
				const virusRadius = radiusFromMass(virus.mass);
				if (distance(p.x, p.y, virus.x, virus.y) < virusRadius) {
					const angle = Math.atan2(virus.y - p.y, virus.x - p.x);
					onVirusFeed(virus.id, angle); // Notify server

					ejected.splice(i, 1);
					eaten = true;
					break;
				}
			}

			// Check collision with main player
			if (!eaten && distance(p.x, p.y, player.x, player.y) < player.radius) {
				player.mass += p.mass;
				ejected.splice(i, 1);
				eaten = true;
			}

			// Check collision with split blobs
			if (!eaten) {
				for (let j = 0; j < splits.length; j++) {
					const s = splits[j];
					const splitRadius = radiusFromMass(s.mass);
					if (distance(p.x, p.y, s.x, s.y) < splitRadius) {
						s.mass += p.mass;
						ejected.splice(i, 1);
						eaten = true;
						break;
					}
				}
			}
		}
	}

	static checkPlayerVsOtherPlayersCollisions(
		player: Player,
		splits: SplitBlob[],
		otherPlayers: OtherPlayer[],
		otherPlayerSplits: OtherPlayerSplit[],
		myPlayerId: string,
		onPlayerConsume: (
			targetId: string,
			targetType: 'player' | 'split',
			consumingEntityType?: 'player' | 'split',
			consumingEntityIndex?: number
		) => void
	): void {
		// Check if main player can eat other players
		for (const otherPlayer of otherPlayers) {
			if (player.mass >= otherPlayer.mass * 1.1) {
				const dist = distance(player.x, player.y, otherPlayer.x, otherPlayer.y);
				if (dist < player.radius) {
					// DON'T add mass here - let server handle it to avoid double mass
					onPlayerConsume(otherPlayer.id, 'player', 'player', -1);
					return; // Only consume one at a time
				}
			}
		}

		// Check if main player can eat other players' splits
		for (const otherSplit of otherPlayerSplits) {
			if (
				otherSplit.playerId !== myPlayerId &&
				player.mass >= otherSplit.mass * 1.1
			) {
				const dist = distance(player.x, player.y, otherSplit.x, otherSplit.y);
				if (dist < player.radius) {
					// DON'T add mass here - let server handle it to avoid double mass
					onPlayerConsume(otherSplit.id.toString(), 'split', 'player', -1);
					return; // Only consume one at a time
				}
			}
		}

		// Check if my splits can eat other players
		for (let splitIndex = 0; splitIndex < splits.length; splitIndex++) {
			const split = splits[splitIndex];
			const splitRadius = radiusFromMass(split.mass);

			// Check vs other players
			for (const otherPlayer of otherPlayers) {
				if (split.mass >= otherPlayer.mass * 1.1) {
					const dist = distance(split.x, split.y, otherPlayer.x, otherPlayer.y);
					if (dist < splitRadius) {
						// DON'T add mass here - let server handle it to avoid double mass
						onPlayerConsume(otherPlayer.id, 'player', 'split', splitIndex);
						return; // Only consume one at a time
					}
				}
			}

			// Check vs other players' splits
			for (const otherSplit of otherPlayerSplits) {
				if (otherSplit.playerId !== myPlayerId && split.mass >= otherSplit.mass * 1.1) {
					const dist = distance(split.x, split.y, otherSplit.x, otherSplit.y);
					if (dist < splitRadius) {
						// DON'T add mass here - let server handle it to avoid double mass
						onPlayerConsume(otherSplit.id.toString(), 'split', 'split', splitIndex);
						return; // Only consume one at a time
					}
				}
			}
		}
	}

	static checkPlayerVsOtherEjectedCollisions(
		player: Player,
		splits: SplitBlob[],
		otherPlayerEjected: OtherPlayerEjected[],
		onEjectedConsume: (
			ejectedId: number,
			consumingEntityType?: 'player' | 'split',
			consumingEntityIndex?: number
		) => void
	): void {
		// Check if main player can eat other players' ejected mass
		for (let i = otherPlayerEjected.length - 1; i >= 0; i--) {
			const ejected = otherPlayerEjected[i];

			const dist = distance(player.x, player.y, ejected.x, ejected.y);
			if (dist < player.radius) {
				// DON'T remove here - let server broadcast handle removal for all clients
				onEjectedConsume(ejected.id, 'player', -1);
				return; // Only consume one at a time
			}
		}

		// Check if my splits can eat other players' ejected mass
		for (let splitIndex = 0; splitIndex < splits.length; splitIndex++) {
			const split = splits[splitIndex];
			const splitRadius = radiusFromMass(split.mass);

			for (let i = otherPlayerEjected.length - 1; i >= 0; i--) {
				const ejected = otherPlayerEjected[i];

				const dist = distance(split.x, split.y, ejected.x, ejected.y);
				if (dist < splitRadius) {
					// DON'T remove here - let server broadcast handle removal for all clients
					onEjectedConsume(ejected.id, 'split', splitIndex);
					return; // Only consume one at a time
				}
			}
		}
	}

	static explodeOnVirus(
		blob: { x: number; y: number; mass: number },
		virusX: number,
		virusY: number,
		currentSplitCount: number,
		virusExplodeSpeed: number,
		virusMass: number
	): SplitBlob[] {
		const totalCells = currentSplitCount + 1; // +1 for main player
		const maxNewCells = 16 - totalCells;

		if (maxNewCells <= 0) {
			// Already at 16 cells, just consume the virus
			blob.mass += virusMass;
			return [];
		}

		// Calculate how many pieces to create
		const targetPieces = Math.min(Math.floor(blob.mass / 12.5), maxNewCells);
		const piecesToCreate = Math.max(4, targetPieces);

		const now = Date.now();
		const newPieces: SplitBlob[] = [];

		// Add virus mass to the blob before splitting
		const totalMass = blob.mass + virusMass;
		const massPerPiece = totalMass / (piecesToCreate + 1);

		// Update the original blob's mass
		blob.mass = massPerPiece;

		// Create the explosion pieces
		for (let i = 0; i < piecesToCreate; i++) {
			const angle = (i / piecesToCreate) * Math.PI * 2 + Math.random() * 0.2;
			const speed = virusExplodeSpeed + Math.random() * 50;
			const vx = Math.cos(angle) * speed;
			const vy = Math.sin(angle) * speed;
			const mergeDelay = 30000 + 0.02333 * massPerPiece * 1000;

			newPieces.push({
				x: virusX,
				y: virusY,
				vx,
				vy,
				mass: massPerPiece,
				born: now,
				mergeDelay,
			});
		}

		return newPieces;
	}

	static checkVirusCollisions(
		player: Player,
		splits: SplitBlob[],
		viruses: Virus[],
		virusExplodeThreshold: number,
		virusExplodeSpeed: number,
		virusMass: number,
		onVirusConsume: (virusId: number) => void
	): SplitBlob[] {
		const newPieces: SplitBlob[] = [];

		// Check virus collisions with player
		for (let i = viruses.length - 1; i >= 0; i--) {
			const virus = viruses[i];
			const dist = distance(virus.x, virus.y, player.x, player.y);

			if (dist < player.radius && player.mass >= virusExplodeThreshold) {
				const pieces = this.explodeOnVirus(
					player,
					virus.x,
					virus.y,
					splits.length,
					virusExplodeSpeed,
					virusMass
				);
				newPieces.push(...pieces);
				onVirusConsume(virus.id); // Notify server
				continue;
			}

			// Check virus collisions with split blobs
			for (let j = 0; j < splits.length; j++) {
				const s = splits[j];
				const splitRadius = radiusFromMass(s.mass);
				const splitDist = distance(virus.x, virus.y, s.x, s.y);

				if (splitDist < splitRadius && s.mass >= virusExplodeThreshold) {
					const pieces = this.explodeOnVirus(
						s,
						virus.x,
						virus.y,
						splits.length,
						virusExplodeSpeed,
						virusMass
					);
					newPieces.push(...pieces);
					onVirusConsume(virus.id); // Notify server
					break;
				}
			}
		}

		return newPieces;
	}
}
