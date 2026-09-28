import type { GameState, PlayerSide, RoomSummary } from "./types";

export interface JoinRoomAck {
  ok: boolean;
  error?: string;
  side?: PlayerSide;
  room?: RoomSummary;
  state?: GameState;
}

/** Events emitted by the client, received by the server. */
export interface ClientToServerEvents {
  "room:join": (roomId: string, ack: (response: JoinRoomAck) => void) => void;
  "room:leave": () => void;
  "paddle:move": (y: number) => void;
}

/** Events emitted by the server, received by the client. */
export interface ServerToClientEvents {
  "game:state": (state: GameState) => void;
  "room:updated": (room: RoomSummary) => void;
  "game:started": () => void;
  "game:finished": (winner: PlayerSide) => void;
  "player:left": (side: PlayerSide) => void;
}

export interface InterServerEvents {
  // Reserved for future multi-instance coordination.
}

export interface SocketData {
  roomId?: string;
  side?: PlayerSide;
}
