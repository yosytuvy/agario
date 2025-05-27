// These constants are now provided by the server:
// - WORLD_SIZE, GRID_SIZE, PELLET_COUNT, PELLET_RADIUS
// - All virus constants
// - EJECT_THRESHOLD, EJECT_LOSS, EJECT_MASS_GAIN, EJECT_RANGE, EJECT_SPEED
// - SPLIT_THRESHOLD, SPLIT_SPEED, SPLIT_FLIGHT_DURATION, MERGE_SPEED
// - START_MASS, DECAY_RATE

// Client-only constants (UI/Visual)
export const EJECT_SPREAD = 0.1;      // Random angle variation for visual variety
export const MIMIC_FACTOR = 0.7;      // How closely split blobs follow player movement
export const SMOOTH_FACTOR = 0.05;    // Camera zoom smoothing factor
export const MIN_ZOOM = 0.4;          // Minimum zoom level