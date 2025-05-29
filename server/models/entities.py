# server/models/entities.py
"""Game entity models and data classes."""

from dataclasses import dataclass
from typing import Optional, Union


@dataclass
class Player:
    """Represents a player in the game."""

    id: str
    x: float
    y: float
    mass: float
    radius: float
    color: str


@dataclass
class PlayerSplit:
    """Represents a split part of a player."""

    id: Union[str, int]  # Can be either string (new) or int (legacy)
    playerId: str
    x: float
    y: float
    vx: float
    vy: float
    mass: float
    born: int
    mergeDelay: float


@dataclass
class PlayerEjected:
    """Represents ejected mass from a player."""

    id: int
    playerId: str
    x: float
    y: float
    vx: float
    vy: float
    travelled: float
    mass: float


@dataclass
class Pellet:
    """Represents a food pellet in the game."""

    id: int
    x: float
    y: float
    mass: int
    color: str


@dataclass
class Virus:
    """Represents a virus entity that can split players."""

    id: int
    x: float
    y: float
    mass: float
    feedCount: int
    lastFeedAngle: Optional[float] = None


@dataclass
class VirusProjectile:
    """Represents a projectile spawned when a virus splits."""

    id: int
    x: float
    y: float
    vx: float
    vy: float
    travelled: float
    mass: float