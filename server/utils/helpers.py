# server/utils/helpers.py
"""Utility functions and helpers."""

import math
from config.settings import PELLET_RADIUS


def calculate_radius(mass: float) -> float:
    """Calculate radius from mass using the same formula as client."""
    return PELLET_RADIUS * math.sqrt(mass)


def calculate_distance(x1: float, y1: float, x2: float, y2: float) -> float:
    """Calculate distance between two points."""
    return math.hypot(x2 - x1, y2 - y1)


def clamp_to_world(x: float, y: float, radius: float, world_size: float) -> tuple:
    """Clamp position to world boundaries."""
    return (
        max(radius, min(x, world_size - radius)),
        max(radius, min(y, world_size - radius)),
    )


def normalize_angle(angle: float) -> float:
    """Normalize angle to [-π, π] range."""
    while angle > math.pi:
        angle -= 2 * math.pi
    while angle < -math.pi:
        angle += 2 * math.pi
    return angle


def lerp(a: float, b: float, t: float) -> float:
    """Linear interpolation between a and b by factor t."""
    return a + (b - a) * t


def is_collision(
    x1: float, y1: float, r1: float, x2: float, y2: float, r2: float
) -> bool:
    """Check if two circles are colliding."""
    return calculate_distance(x1, y1, x2, y2) < (r1 + r2)
