import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@pong/common";
import { SERVER_URL } from "./api";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function createGameSocket(): GameSocket {
  return io(SERVER_URL, {
    autoConnect: false,
    transports: ["websocket", "polling"],
  });
}
