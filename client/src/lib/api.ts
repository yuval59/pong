import type { CreateRoomResponse, ListRoomsResponse, RoomSummary } from "@pong/common";

export const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";

interface ErrorBody {
  error?: string;
}

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => null)) as T | ErrorBody | null;
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : `Request failed with status ${res.status}`;
    throw new Error(message);
  }
  return data as T;
}

export async function fetchRooms(): Promise<RoomSummary[]> {
  const res = await fetch(`${SERVER_URL}/api/rooms`, { cache: "no-store" });
  const data = await parseJsonOrThrow<ListRoomsResponse>(res);
  return data.rooms;
}

export async function createRoom(name: string, broadcastRateHz?: number): Promise<RoomSummary> {
  const res = await fetch(`${SERVER_URL}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, broadcastRateHz }),
  });
  const data = await parseJsonOrThrow<CreateRoomResponse>(res);
  return data.room;
}
