# server/services/game_service.py
"""Core game logic and state management."""

import random
import math
import uuid
from typing import Dict, List, Optional
from dataclasses import asdict

from models.entities import (
    Player,
    PlayerSplit,
    PlayerEjected,
    Pellet,
    Virus,
    VirusProjectile,
)
from config.settings import *
from utils.helpers import calculate_radius


class GameService:
    """Main game service that manages game state and logic."""

    def __init__(self):
        self.pellets: Dict[int, Pellet] = {}
        self.viruses: Dict[int, Virus] = {}
        self.virus_projectiles: Dict[int, VirusProjectile] = {}
        self.players: Dict[str, Player] = {}
        self.player_splits: Dict[str, PlayerSplit] = {}  # Changed to store by split ID
        self.player_ejected: Dict[int, PlayerEjected] = {}

        # ID generators
        self.next_pellet_id = 0
        self.next_virus_id = 0
        self.next_projectile_id = 0
        self.next_ejected_id = 0

        self._initialize_world()

    def _initialize_world(self):
        """Initialize the game world with pellets and viruses."""
        self._initialize_pellets()
        self._initialize_viruses()

    def _initialize_pellets(self):
        """Initialize pellets with random positions."""
        for _ in range(PELLET_COUNT):
            self._spawn_pellet()

    def _initialize_viruses(self):
        """Initialize viruses with random positions."""
        for _ in range(VIRUS_COUNT):
            self._spawn_virus()

    def _spawn_pellet(self) -> Pellet:
        """Spawn a single pellet at a random position."""
        pellet_id = self.next_pellet_id
        self.next_pellet_id += 1

        pellet = Pellet(
            id=pellet_id,
            x=random.uniform(PELLET_RADIUS, WORLD_SIZE - PELLET_RADIUS),
            y=random.uniform(PELLET_RADIUS, WORLD_SIZE - PELLET_RADIUS),
            mass=random.randint(1, 5),
            color=f"hsl({random.randint(0, 360)},70%,60%)",
        )
        self.pellets[pellet_id] = pellet
        return pellet

    def _spawn_virus(self, existing_viruses: List[Virus] = None) -> Virus:
        """Spawn a single virus avoiding overlap with existing ones."""
        if existing_viruses is None:
            existing_viruses = list(self.viruses.values())

        virus_radius = calculate_radius(VIRUS_MASS)

        # Try to find a valid position
        for _ in range(50):  # Max attempts
            x = random.uniform(virus_radius, WORLD_SIZE - virus_radius)
            y = random.uniform(virus_radius, WORLD_SIZE - virus_radius)

            # Check distance from other viruses
            valid = True
            for v in existing_viruses:
                if math.hypot(v.x - x, v.y - y) < virus_radius * 3:
                    valid = False
                    break

            if valid:
                break
        else:
            # Fallback if no valid position found
            x = random.uniform(virus_radius, WORLD_SIZE - virus_radius)
            y = random.uniform(virus_radius, WORLD_SIZE - virus_radius)

        virus_id = self.next_virus_id
        self.next_virus_id += 1

        virus = Virus(id=virus_id, x=x, y=y, mass=VIRUS_MASS, feedCount=0)
        self.viruses[virus_id] = virus
        return virus

    def create_player(self) -> Player:
        """Create a new player with random position and color."""
        player_id = str(uuid.uuid4())
        player = Player(
            id=player_id,
            x=random.uniform(100, WORLD_SIZE - 100),
            y=random.uniform(100, WORLD_SIZE - 100),
            mass=START_MASS,
            radius=calculate_radius(START_MASS),
            color=f"hsl({random.randint(0, 360)},70%,60%)",
        )
        self.players[player_id] = player
        return player

    def remove_player(self, player_id: str):
        """Remove a player and all their associated entities."""
        # Remove player
        if player_id in self.players:
            del self.players[player_id]

        # Remove player's splits
        splits_to_remove = [
            id
            for id, split in self.player_splits.items()
            if split.playerId == player_id
        ]
        for split_id in splits_to_remove:
            del self.player_splits[split_id]

        # Remove player's ejected mass
        ejected_to_remove = [
            id for id, ej in self.player_ejected.items() if ej.playerId == player_id
        ]
        for ej_id in ejected_to_remove:
            del self.player_ejected[ej_id]

    def update_player(
        self,
        player_id: str,
        x: float,
        y: float,
        mass: float,
        radius: float,
        color: str = None,
    ):
        """Update player position and stats."""
        if player_id in self.players:
            player = self.players[player_id]
            player.x = x
            player.y = y
            player.mass = mass
            player.radius = radius
            if color:
                player.color = color

    def update_player_splits(self, player_id: str, splits_data: List[dict]):
        """Update player's split blobs."""
        # Remove old splits for this player
        splits_to_remove = [
            id
            for id, split in self.player_splits.items()
            if split.playerId == player_id
        ]
        for split_id in splits_to_remove:
            del self.player_splits[split_id]

        # Add new splits with their client-provided IDs
        for split_data in splits_data:
            split_id = split_data.get("id", f"split-{player_id}-{len(self.player_splits)}")
            
            split = PlayerSplit(
                id=split_id,
                playerId=player_id,
                x=split_data["x"],
                y=split_data["y"],
                vx=split_data.get("vx", 0),
                vy=split_data.get("vy", 0),
                mass=split_data["mass"],
                born=split_data.get("born", 0),
                mergeDelay=split_data.get("mergeDelay", 0),
            )
            self.player_splits[split_id] = split

    def update_player_ejected(self, player_id: str, ejected_data: List[dict]):
        """Update player's ejected mass."""
        # Remove old ejected for this player
        ejected_to_remove = [
            id for id, ej in self.player_ejected.items() if ej.playerId == player_id
        ]
        for ej_id in ejected_to_remove:
            del self.player_ejected[ej_id]

        # Add new ejected
        for ej_data in ejected_data:
            ej_id = self.next_ejected_id
            self.next_ejected_id += 1

            ejected = PlayerEjected(
                id=ej_id,
                playerId=player_id,
                x=ej_data["x"],
                y=ej_data["y"],
                vx=ej_data.get("vx", 0),
                vy=ej_data.get("vy", 0),
                travelled=ej_data.get("travelled", 0),
                mass=ej_data["mass"],
            )
            self.player_ejected[ej_id] = ejected

    def consume_pellet(self, pellet_id: int) -> Optional[dict]:
        """Handle pellet consumption and spawn a new one."""
        if pellet_id in self.pellets:
            del self.pellets[pellet_id]
            new_pellet = self._spawn_pellet()
            return {"consumed": pellet_id, "spawned": asdict(new_pellet)}
        return None

    def feed_virus(self, virus_id: int, feed_angle: float) -> Optional[dict]:
        """Feed a virus, potentially causing it to split and spawn a projectile."""
        if virus_id not in self.viruses:
            return None

        virus = self.viruses[virus_id]
        virus.lastFeedAngle = feed_angle
        virus.feedCount += 1
        virus.mass += VIRUS_FEED_MASS

        result = {"virusId": virus_id, "newMass": virus.mass}

        # Check if virus should spawn a projectile
        if virus.feedCount >= VIRUS_FEEDS_TO_SPLIT:
            # Create projectile
            projectile_id = self.next_projectile_id
            self.next_projectile_id += 1

            vx = math.cos(feed_angle) * VIRUS_PROJECTILE_SPEED
            vy = math.sin(feed_angle) * VIRUS_PROJECTILE_SPEED

            projectile = VirusProjectile(
                id=projectile_id,
                x=virus.x,
                y=virus.y,
                vx=vx,
                vy=vy,
                travelled=0,
                mass=VIRUS_MASS,
            )
            self.virus_projectiles[projectile_id] = projectile

            # Reset virus
            virus.mass = VIRUS_MASS
            virus.feedCount = 0
            virus.lastFeedAngle = None

            result["projectileSpawned"] = asdict(projectile)

        return result

    def consume_virus(self, virus_id: int) -> Optional[dict]:
        """Handle virus consumption and spawn a new one."""
        if virus_id in self.viruses:
            del self.viruses[virus_id]
            new_virus = self._spawn_virus()
            return {"consumed": virus_id, "spawned": asdict(new_virus)}
        return None

    def consume_player(
        self,
        consumer_id: str,
        target_id: str,
        target_type: str,
        consuming_entity_type: str = "player",
        consuming_entity_id: str = "main",
        consuming_entity_data: dict = None,
    ) -> Optional[dict]:
        """Handle player consuming another player or split."""
        # Validate the consumer exists
        if consumer_id not in self.players:
            return None

        consumer = self.players[consumer_id]

        # Get consuming entity data for validation
        consuming_mass, consuming_x, consuming_y = self._get_consuming_entity_data(
            consumer, consuming_entity_type, consuming_entity_id, consuming_entity_data
        )

        if consuming_mass == 0:
            return None

        if target_type == "player":
            return self._consume_target_player(
                consumer,
                target_id,
                consuming_mass,
                consuming_x,
                consuming_y,
                consuming_entity_type,
                consuming_entity_id,
            )
        elif target_type == "split":
            return self._consume_target_split(
                consumer,
                target_id,
                consuming_mass,
                consuming_x,
                consuming_y,
                consuming_entity_type,
                consuming_entity_id,
            )

        return None

    def consume_other_ejected(
        self,
        consumer_id: str,
        ejected_id: int,
        consuming_entity_type: str = "player",
        consuming_entity_id: str = "main",
        consuming_entity_data: dict = None,
    ) -> Optional[dict]:
        """Handle player consuming other players' ejected mass."""
        # Validate consumer and ejected mass exist
        if consumer_id not in self.players or ejected_id not in self.player_ejected:
            return None

        target_ejected = self.player_ejected[ejected_id]

        # Don't consume own ejected mass
        if target_ejected.playerId == consumer_id:
            return None

        consumer = self.players[consumer_id]

        # Validate collision
        consuming_x, consuming_y, consuming_radius = (
            self._get_consuming_position_and_radius(
                consumer, consuming_entity_type, consuming_entity_id, consuming_entity_data
            )
        )

        distance = math.hypot(
            consuming_x - target_ejected.x, consuming_y - target_ejected.y
        )
        if distance >= consuming_radius:
            return None

        # Remove the ejected mass first to prevent double consumption
        del self.player_ejected[ejected_id]

        # Calculate new mass
        gained_mass = EJECT_MASS_GAIN

        if consuming_entity_type == "player":
            consumer.mass += gained_mass
            consumer.radius = calculate_radius(consumer.mass)
            new_mass = consumer.mass
        else:
            current_split_mass = consuming_entity_data.get("mass", 0)
            new_mass = current_split_mass + gained_mass

        return {
            "ejectedId": ejected_id,
            "gainedMass": gained_mass,
            "consumerId": consumer_id,
            "newMass": new_mass,
            "consumingEntityType": consuming_entity_type,
            "consumingEntityId": consuming_entity_id,
            "originalOwnerId": target_ejected.playerId,
        }

    async def update_virus_projectiles(self, dt: float) -> List[dict]:
        """Update virus projectile positions and convert to viruses when needed."""
        updates = []
        to_remove = []

        for proj_id, proj in self.virus_projectiles.items():
            # Update position
            mvx = proj.vx * dt
            mvy = proj.vy * dt
            proj.x += mvx
            proj.y += mvy
            proj.travelled += math.hypot(mvx, mvy)

            # Check if projectile should convert to virus
            proj_radius = calculate_radius(proj.mass)

            if (
                proj.travelled >= VIRUS_PROJECTILE_RANGE
                or proj.x <= proj_radius
                or proj.x >= WORLD_SIZE - proj_radius
                or proj.y <= proj_radius
                or proj.y >= WORLD_SIZE - proj_radius
            ):

                # Convert to virus
                new_virus = self._spawn_virus()
                new_virus.x = max(proj_radius, min(WORLD_SIZE - proj_radius, proj.x))
                new_virus.y = max(proj_radius, min(WORLD_SIZE - proj_radius, proj.y))

                to_remove.append(proj_id)
                updates.append(
                    {
                        "type": "projectile_to_virus",
                        "projectileId": proj_id,
                        "virus": asdict(new_virus),
                    }
                )
            else:
                updates.append(
                    {"type": "projectile_update", "projectile": asdict(proj)}
                )

        # Remove converted projectiles
        for proj_id in to_remove:
            del self.virus_projectiles[proj_id]

        return updates

    # Helper methods
    def _get_consuming_entity_data(
        self, consumer: Player, consuming_entity_type: str, consuming_entity_id: str, consuming_entity_data: dict
    ) -> tuple:
        """Get consuming entity mass and position."""
        if consuming_entity_type == "player":
            return consumer.mass, consumer.x, consumer.y
        elif consuming_entity_type == "split" and consuming_entity_data:
            return (
                consuming_entity_data.get("mass", 0),
                consuming_entity_data.get("x", 0),
                consuming_entity_data.get("y", 0),
            )
        return 0, 0, 0

    def _get_consuming_position_and_radius(
        self, consumer: Player, consuming_entity_type: str, consuming_entity_id: str, consuming_entity_data: dict
    ) -> tuple:
        """Get consuming entity position and radius."""
        if consuming_entity_type == "player":
            return consumer.x, consumer.y, consumer.radius
        elif consuming_entity_type == "split" and consuming_entity_data:
            consuming_mass = consuming_entity_data.get("mass", 0)
            consuming_radius = calculate_radius(consuming_mass)
            return (
                consuming_entity_data.get("x", 0),
                consuming_entity_data.get("y", 0),
                consuming_radius,
            )
        return 0, 0, 0

    def _consume_target_player(
        self,
        consumer: Player,
        target_id: str,
        consuming_mass: float,
        consuming_x: float,
        consuming_y: float,
        consuming_entity_type: str,
        consuming_entity_id: str,
    ) -> Optional[dict]:
        """Handle consuming a target player."""
        if target_id not in self.players:
            return None

        target = self.players[target_id]

        # Validate size advantage and collision
        if consuming_mass < target.mass * 1.1 or math.hypot(
            consuming_x - target.x, consuming_y - target.y
        ) >= calculate_radius(consuming_mass):
            return None

        gained_mass = target.mass

        # Update consumer mass
        if consuming_entity_type == "player":
            consumer.mass += gained_mass
            consumer.radius = calculate_radius(consumer.mass)
            new_mass = consumer.mass
        else:
            new_mass = consuming_mass + gained_mass

        # Remove target and their entities
        self.remove_player(target_id)

        return {
            "targetId": target_id,
            "targetType": "player",
            "gainedMass": gained_mass,
            "consumerId": consumer.id,
            "newMass": new_mass,
            "consumingEntityType": consuming_entity_type,
            "consumingEntityId": consuming_entity_id,
        }

    def _consume_target_split(
        self,
        consumer: Player,
        target_id: str,
        consuming_mass: float,
        consuming_x: float,
        consuming_y: float,
        consuming_entity_type: str,
        consuming_entity_id: str,
    ) -> Optional[dict]:
        """Handle consuming a target split."""
        # Handle both old integer IDs and new string IDs
        target_split = None
        
        # First check if it's a string ID in our splits
        if target_id in self.player_splits:
            target_split = self.player_splits[target_id]
            actual_split_id = target_id
        else:
            # Try to find by integer ID for backward compatibility
            try:
                target_split_id = int(target_id)
                for split_id, split in self.player_splits.items():
                    if hasattr(split, 'id') and isinstance(split.id, int) and split.id == target_split_id:
                        target_split = split
                        actual_split_id = split_id
                        break
            except ValueError:
                pass
        
        if not target_split:
            return None

        # Validate size advantage and collision
        if consuming_mass < target_split.mass * 1.1 or math.hypot(
            consuming_x - target_split.x, consuming_y - target_split.y
        ) >= calculate_radius(consuming_mass):
            return None

        gained_mass = target_split.mass

        # Update consumer mass
        if consuming_entity_type == "player":
            consumer.mass += gained_mass
            consumer.radius = calculate_radius(consumer.mass)
            new_mass = consumer.mass
        else:
            new_mass = consuming_mass + gained_mass

        # Remove the split
        del self.player_splits[actual_split_id]

        return {
            "targetId": target_id,
            "targetType": "split",
            "gainedMass": gained_mass,
            "consumerId": consumer.id,
            "newMass": new_mass,
            "consumingEntityType": consuming_entity_type,
            "consumingEntityId": consuming_entity_id,
        }

    # Getter methods for game state
    def get_all_pellets(self) -> List[dict]:
        """Get all pellets as dictionaries."""
        return [asdict(pellet) for pellet in self.pellets.values()]

    def get_all_viruses(self) -> List[dict]:
        """Get all viruses as dictionaries."""
        return [asdict(virus) for virus in self.viruses.values()]

    def get_all_virus_projectiles(self) -> List[dict]:
        """Get all virus projectiles as dictionaries."""
        return [asdict(proj) for proj in self.virus_projectiles.values()]

    def get_all_players(self) -> List[dict]:
        """Get all players as dictionaries."""
        return [asdict(player) for player in self.players.values()]

    def get_all_player_splits(self) -> List[dict]:
        """Get all player splits as dictionaries, converting to format expected by client."""
        splits = []
        for split in self.player_splits.values():
            split_dict = asdict(split)
            # For backward compatibility, ensure numeric ID if client expects it
            if 'id' not in split_dict or not isinstance(split_dict['id'], (int, str)):
                split_dict['id'] = hash(split.id) % 1000000  # Create a numeric ID from string
            splits.append(split_dict)
        return splits

    def get_all_player_ejected(self) -> List[dict]:
        """Get all player ejected mass as dictionaries."""
        return [asdict(ej) for ej in self.player_ejected.values()]