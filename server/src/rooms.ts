import { randomUUID } from "node:crypto";
import { MAX_PLAYERS_PER_ROOM } from "@pong/common";
import type { PlayerSide, RoomStatus, RoomSummary } from "@pong/common";
import { GameSession } from "./game";

export interface Room {
  id: string;
  name: string;
  createdAt: number;
  /** Game-state updates per second broadcast to players in this room. */
  broadcastRateHz: number;
  /** socket.io socket id currently occupying each side, if any. */
  players: Partial<Record<PlayerSide, string>>;
  game: GameSession | null;
}

const SIDES: PlayerSide[] = ["left", "right"];

export class RoomManager {
  private rooms = new Map<string, Room>();

  createRoom(name: string, broadcastRateHz: number): Room {
    const room: Room = {
      id: randomUUID(),
      name,
      createdAt: Date.now(),
      broadcastRateHz,
      players: {},
      game: null,
    };
    this.rooms.set(room.id, room);
    return room;
  }

  getRoom(id: string): Room | undefined {
    return this.rooms.get(id);
  }

  listRooms(): RoomSummary[] {
    return Array.from(this.rooms.values())
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((room) => this.toSummary(room));
  }

  toSummary(room: Room): RoomSummary {
    return {
      id: room.id,
      name: room.name,
      playerCount: SIDES.filter((side) => room.players[side]).length,
      maxPlayers: MAX_PLAYERS_PER_ROOM,
      status: this.getStatus(room),
      createdAt: room.createdAt,
      broadcastRateHz: room.broadcastRateHz,
    };
  }

  getStatus(room: Room): RoomStatus {
    if (!room.game) return "waiting";
    return room.game.getState().status;
  }

  /** Assigns the first free side to a socket, or null if the room is full. */
  assignSeat(room: Room, socketId: string): PlayerSide | null {
    for (const side of SIDES) {
      if (!room.players[side]) {
        room.players[side] = socketId;
        return side;
      }
    }
    return null;
  }

  /** Removes whichever seat the given socket occupies, cleaning up empty rooms. */
  removeBySocketId(socketId: string): { room: Room; side: PlayerSide } | null {
    for (const room of this.rooms.values()) {
      for (const side of SIDES) {
        if (room.players[side] === socketId) {
          delete room.players[side];
          const result = { room, side };
          this.cleanupIfEmpty(room);
          return result;
        }
      }
    }
    return null;
  }

  private cleanupIfEmpty(room: Room): void {
    const occupied = SIDES.some((side) => room.players[side]);
    if (!occupied) {
      room.game?.stop();
      this.rooms.delete(room.id);
    }
  }
}
