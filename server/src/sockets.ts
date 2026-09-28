import { MAX_PLAYERS_PER_ROOM } from "@pong/common";
import type {
  ClientToServerEvents,
  InterServerEvents,
  PlayerSide,
  ServerToClientEvents,
  SocketData,
} from "@pong/common";
import type { Socket } from "socket.io";
import { GameSession, type TypedServer } from "./game";
import type { RoomManager } from "./rooms";

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export function registerSocketHandlers(io: TypedServer, roomManager: RoomManager): void {
  function handleLeave(socket: TypedSocket): void {
    const { roomId, side } = socket.data;
    if (!roomId || !side) return;

    socket.leave(roomId);
    const result = roomManager.removeBySocketId(socket.id);
    socket.data.roomId = undefined;
    socket.data.side = undefined;
    if (!result) return;

    const { room } = result;
    if (!roomManager.getRoom(room.id)) {
      // Room was deleted because it's now empty; nobody left to notify.
      return;
    }

    if (room.game && roomManager.getStatus(room) === "in_progress") {
      const opponent: PlayerSide = side === "left" ? "right" : "left";
      room.game.forfeit(opponent);
    }
    room.game?.setPlayerConnected(side, false);

    io.to(room.id).emit("player:left", side);
    io.to(room.id).emit("room:updated", roomManager.toSummary(room));
  }

  io.on("connection", (socket: TypedSocket) => {
    socket.on("room:join", (roomId, ack) => {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        ack({ ok: false, error: "Room not found." });
        return;
      }
      if (roomManager.getStatus(room) === "in_progress") {
        ack({ ok: false, error: "Game already in progress." });
        return;
      }

      const side = roomManager.assignSeat(room, socket.id);
      if (!side) {
        ack({ ok: false, error: "Room is full." });
        return;
      }

      socket.data.roomId = room.id;
      socket.data.side = side;
      socket.join(room.id);

      if (!room.game) {
        room.game = new GameSession(io, room.id, room.broadcastRateHz, () => {
          io.to(room.id).emit("room:updated", roomManager.toSummary(room));
        });
      } else {
        room.game.setPlayerConnected(side, true);
      }

      const occupiedSeats = Object.values(room.players).filter(Boolean).length;
      if (occupiedSeats === MAX_PLAYERS_PER_ROOM) {
        room.game.start();
      }

      ack({ ok: true, side, room: roomManager.toSummary(room), state: room.game.getState() });
      io.to(room.id).emit("room:updated", roomManager.toSummary(room));
    });

    socket.on("paddle:move", (y) => {
      const { roomId, side } = socket.data;
      if (!roomId || !side) return;
      const room = roomManager.getRoom(roomId);
      room?.game?.setPaddleTarget(side, y);
    });

    socket.on("room:leave", () => handleLeave(socket));
    socket.on("disconnect", () => handleLeave(socket));
  });
}
