export interface Vector2 {
  x: number;
  y: number;
}

export type PlayerSide = "left" | "right";

export type RoomStatus = "waiting" | "in_progress" | "finished";

/** Lightweight view of a room used by the lobby list. */
export interface RoomSummary {
  id: string;
  name: string;
  playerCount: number;
  maxPlayers: number;
  status: RoomStatus;
  createdAt: number;
  /** Game-state updates per second broadcast to players in this room. */
  broadcastRateHz: number;
}

export interface CreateRoomRequest {
  name: string;
  /** Optional; defaults to BROADCAST_RATE_HZ. Must be within [MIN_BROADCAST_RATE_HZ, MAX_BROADCAST_RATE_HZ]. */
  broadcastRateHz?: number;
}

export interface CreateRoomResponse {
  room: RoomSummary;
}

export interface ListRoomsResponse {
  rooms: RoomSummary[];
}

export type GameStatus = "waiting" | "in_progress" | "finished";

export interface BallState {
  position: Vector2;
  velocity: Vector2;
  speed: number;
}

export interface PaddleState {
  /** Y position of the paddle's center, in court coordinates. */
  y: number;
  score: number;
  connected: boolean;
}

export interface GameState {
  status: GameStatus;
  ball: BallState;
  paddles: Record<PlayerSide, PaddleState>;
  /** Winner, set once status is "finished". */
  winner: PlayerSide | null;
}
