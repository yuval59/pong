/** Court and entity dimensions (logical units, independent of screen pixels). */
export const GAME_CONSTANTS = {
  COURT_WIDTH: 800,
  COURT_HEIGHT: 600,
  PADDLE_HEIGHT: 100,
  PADDLE_WIDTH: 10,
  PADDLE_MARGIN: 20,
  BALL_RADIUS: 8,
} as const;

/** Simulation and networking rates. */
export const TICK_RATE_HZ = 60;
/** Default game-state broadcast rate, used when a room doesn't specify one. */
export const BROADCAST_RATE_HZ = 30;
/** Allowed range for a room's configurable broadcast ("refresh") rate. */
export const MIN_BROADCAST_RATE_HZ = 5;
export const MAX_BROADCAST_RATE_HZ = 256;

/** Ball speed (logical units/sec) and how it escalates over the rally. */
export const BALL_INITIAL_SPEED = 300;
export const BALL_SPEEDUP_FACTOR = 1.05;
export const BALL_MAX_SPEED = 900;

/** Paddle movement speed for keyboard control (logical units/sec). */
export const PADDLE_SPEED = 500;

/** Match rules. */
export const WIN_SCORE = 11;
export const MAX_PLAYERS_PER_ROOM = 2;
