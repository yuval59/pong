"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { RoomSummary } from "@pong/common";
import { BROADCAST_RATE_HZ, MAX_BROADCAST_RATE_HZ, MIN_BROADCAST_RATE_HZ } from "@pong/common";
import { createRoom, fetchRooms } from "@/lib/api";
import styles from "./page.module.css";

const POLL_INTERVAL_MS = 2000;

export default function Home() {
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roomName, setRoomName] = useState("");
  const [refreshRate, setRefreshRate] = useState(String(BROADCAST_RATE_HZ));
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(() => {
    fetchRooms()
      .then((nextRooms) => {
        setRooms(nextRooms);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load rooms.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const trimmed = roomName.trim();
    if (!trimmed) return;

    const parsedRate = Number(refreshRate);
    const rate = Number.isFinite(parsedRate)
      ? Math.min(MAX_BROADCAST_RATE_HZ, Math.max(MIN_BROADCAST_RATE_HZ, parsedRate))
      : BROADCAST_RATE_HZ;

    setCreating(true);
    setError(null);
    try {
      const room = await createRoom(trimmed, rate);
      router.push(`/room/${room.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create room.");
      setCreating(false);
    }
  }

  function handleJoin(room: RoomSummary) {
    router.push(`/room/${room.id}`);
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1 className={styles.title}>Pong</h1>
        <p className={styles.subtitle}>Create a room or join one that&apos;s waiting for an opponent.</p>

        <form className={styles.createForm} onSubmit={handleCreate}>
          <input
            className={styles.input}
            type="text"
            placeholder="Room name"
            value={roomName}
            onChange={(event) => setRoomName(event.target.value)}
            maxLength={40}
          />
          <label className={styles.rateLabel}>
            Refresh rate (Hz)
            <input
              className={styles.rateInput}
              type="number"
              min={MIN_BROADCAST_RATE_HZ}
              max={MAX_BROADCAST_RATE_HZ}
              value={refreshRate}
              onChange={(event) => setRefreshRate(event.target.value)}
            />
          </label>
          <button
            className={styles.primaryButton}
            type="submit"
            disabled={creating || !roomName.trim()}
          >
            {creating ? "Creating…" : "Create room"}
          </button>
        </form>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.roomListHeader}>
          <span>Rooms</span>
          <button className={styles.linkButton} onClick={refresh} type="button">
            Refresh
          </button>
        </div>

        <div className={styles.roomList}>
          {loading ? (
            <p className={styles.empty}>Loading rooms…</p>
          ) : rooms.length === 0 ? (
            <p className={styles.empty}>No rooms yet. Create one to get started.</p>
          ) : (
            rooms.map((room) => {
              const joinable = room.status === "waiting" && room.playerCount < room.maxPlayers;
              const label =
                room.status === "in_progress"
                  ? "In progress"
                  : room.status === "finished"
                  ? "Finished"
                  : joinable
                  ? "Join"
                  : "Full";
              return (
                <div key={room.id} className={styles.roomRow}>
                  <div className={styles.roomInfo}>
                    <span className={styles.roomName}>{room.name}</span>
                    <span className={styles.roomMeta}>
                      {room.playerCount}/{room.maxPlayers} players · {room.status.replace("_", " ")} ·{" "}
                      {room.broadcastRateHz} Hz
                    </span>
                  </div>
                  <button
                    className={styles.secondaryButton}
                    type="button"
                    disabled={!joinable}
                    onClick={() => handleJoin(room)}
                  >
                    {label}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
