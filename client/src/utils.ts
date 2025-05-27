// Server-provided values (will be set by useGameState)
let PELLET_RADIUS = 5; // Default value until server provides it

export const setPelletRadius = (radius: number) => {
    PELLET_RADIUS = radius;
};

export const getPelletRadius = () => PELLET_RADIUS;

export const clampToWorld = (x: number, y: number, radius: number, worldSize: number) => {
    return {
        x: Math.min(Math.max(x, radius), worldSize - radius),
        y: Math.min(Math.max(y, radius), worldSize - radius)
    };
};

export const distance = (x1: number, y1: number, x2: number, y2: number): number => {
    return Math.hypot(x2 - x1, y2 - y1);
};

export const angle = (x1: number, y1: number, x2: number, y2: number): number => {
    return Math.atan2(y2 - y1, x2 - x1);
};

export const radiusFromMass = (mass: number): number => {
    return PELLET_RADIUS * Math.sqrt(mass);
};

export const randomColor = (): string => {
    return `hsl(${Math.random() * 360},70%,60%)`;
};

export const randomPosition = (radius: number = 0, worldSize: number = 11000) => {
    return {
        x: Math.random() * (worldSize - radius * 2) + radius,
        y: Math.random() * (worldSize - radius * 2) + radius
    };
};

export const checkCollision = (
    x1: number, y1: number, r1: number,
    x2: number, y2: number, r2: number
): boolean => {
    return distance(x1, y1, x2, y2) < r1 + r2;
};