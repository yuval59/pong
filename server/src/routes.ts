import { Router } from "express";
import {
  BROADCAST_RATE_HZ,
  MAX_BROADCAST_RATE_HZ,
  MIN_BROADCAST_RATE_HZ,
} from "@pong/common";
import type { CreateRoomRequest, CreateRoomResponse, ListRoomsResponse } from "@pong/common";
import type { RoomManager } from "./rooms";

const MAX_ROOM_NAME_LENGTH = 40;

export function createRoomsRouter(roomManager: RoomManager): Router {
  const router = Router();

  router.get("/rooms", (_req, res) => {
    const body: ListRoomsResponse = { rooms: roomManager.listRooms() };
    res.json(body);
  });

  router.post("/rooms", (req, res) => {
    const { name, broadcastRateHz } = (req.body ?? {}) as Partial<CreateRoomRequest>;
    if (typeof name !== "string" || name.trim().length === 0) {
      res.status(400).json({ error: "Room name is required." });
      return;
    }
    if (name.trim().length > MAX_ROOM_NAME_LENGTH) {
      res.status(400).json({ error: `Room name must be ${MAX_ROOM_NAME_LENGTH} characters or fewer.` });
      return;
    }

    let resolvedRateHz: number = BROADCAST_RATE_HZ;
    if (broadcastRateHz !== undefined) {
      if (typeof broadcastRateHz !== "number" || !Number.isFinite(broadcastRateHz)) {
        res.status(400).json({ error: "broadcastRateHz must be a number." });
        return;
      }
      if (broadcastRateHz < MIN_BROADCAST_RATE_HZ || broadcastRateHz > MAX_BROADCAST_RATE_HZ) {
        res.status(400).json({
          error: `broadcastRateHz must be between ${MIN_BROADCAST_RATE_HZ} and ${MAX_BROADCAST_RATE_HZ}.`,
        });
        return;
      }
      resolvedRateHz = broadcastRateHz;
    }

    const room = roomManager.createRoom(name.trim(), resolvedRateHz);
    const body: CreateRoomResponse = { room: roomManager.toSummary(room) };
    res.status(201).json(body);
  });

  router.get("/rooms/:id", (req, res) => {
    const room = roomManager.getRoom(req.params.id);
    if (!room) {
      res.status(404).json({ error: "Room not found." });
      return;
    }
    res.json({ room: roomManager.toSummary(room) });
  });

  return router;
}
