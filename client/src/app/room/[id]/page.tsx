"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import type { GameState, JoinRoomAck, PlayerSide, RoomSummary } from "@pong/common";
import { GAME_CONSTANTS, PADDLE_SPEED } from "@pong/common";
import { createGameSocket, type GameSocket } from "@/lib/socket";
import styles from "./page.module.css";

const { COURT_WIDTH, COURT_HEIGHT, PADDLE_HEIGHT, PADDLE_WIDTH, PADDLE_MARGIN, BALL_RADIUS } =
  GAME_CONSTANTS;

type ViewStatus = "connecting" | "waiting" | "in_progress" | "finished" | "error";
type ControlMode = "keyboard" | "mouse";
const MAX_FRAME_DT_SECONDS = 0.05;

export default function RoomPage() {
  const params = useParams();
  const roomId = typeof params.id === "string" ? params.id : "";
  const router = useRouter();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const socketRef = useRef<GameSocket | null>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const localPaddleYRef = useRef<number>(COURT_HEIGHT / 2);
  const sideRef = useRef<PlayerSide | null>(null);
  const pressedRef = useRef<{ up: boolean; down: boolean }>({ up: false, down: false });
  const controlModeRef = useRef<ControlMode>("keyboard");

  const [side, setSide] = useState<PlayerSide | null>(null);
  const [room, setRoom] = useState<RoomSummary | null>(null);
  const [status, setStatus] = useState<ViewStatus>("connecting");
  const [winner, setWinner] = useState<PlayerSide | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [controlMode, setControlMode] = useState<ControlMode>("keyboard");

  // Connect and join the room over the socket.
  useEffect(() => {
    if (!roomId) return;
    const socket = createGameSocket();
    socketRef.current = socket;
    socket.connect();

    socket.on("connect", () => {
      socket.emit("room:join", roomId, (ack: JoinRoomAck) => {
        if (!ack.ok || !ack.side || !ack.room || !ack.state) {
          setErrorMsg(ack.error ?? "Unable to join room.");
          setStatus("error");
          return;
        }
        sideRef.current = ack.side;
        setSide(ack.side);
        setRoom(ack.room);
        gameStateRef.current = ack.state;
        localPaddleYRef.current = ack.state.paddles[ack.side].y;
        setStatus(ack.state.status);
      });
    });

    socket.on("connect_error", () => {
      setErrorMsg("Could not connect to the server.");
      setStatus("error");
    });

    socket.on("game:state", (state) => {
      gameStateRef.current = state;
      setStatus(state.status);
      if (state.status === "finished") setWinner(state.winner);
    });

    socket.on("room:updated", (updatedRoom) => setRoom(updatedRoom));
    socket.on("game:started", () => setStatus("in_progress"));
    socket.on("game:finished", (winnerSide) => {
      setWinner(winnerSide);
      setStatus("finished");
    });

    return () => {
      socket.emit("room:leave");
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId]);

  // Keyboard controls: Arrow Up/Down or W/S while held.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      let matched = false;
      if (event.key === "ArrowUp" || event.key === "w" || event.key === "W") {
        pressedRef.current.up = true;
        matched = true;
      }
      if (event.key === "ArrowDown" || event.key === "s" || event.key === "S") {
        pressedRef.current.down = true;
        matched = true;
      }
      if (matched) {
        controlModeRef.current = "keyboard";
        setControlMode("keyboard");
      }
    }
    function onKeyUp(event: KeyboardEvent) {
      if (event.key === "ArrowUp" || event.key === "w" || event.key === "W") {
        pressedRef.current.up = false;
      }
      if (event.key === "ArrowDown" || event.key === "s" || event.key === "S") {
        pressedRef.current.down = false;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // Mouse control: cursor position over the canvas maps directly to paddle Y.
  const handleMouseMove = useCallback((event: ReactMouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const relativeY = (event.clientY - rect.top) / rect.height;
    const courtY = relativeY * COURT_HEIGHT;
    controlModeRef.current = "mouse";
    setControlMode("mouse");
    localPaddleYRef.current = Math.min(
      COURT_HEIGHT - PADDLE_HEIGHT / 2,
      Math.max(PADDLE_HEIGHT / 2, courtY),
    );
  }, []);

  // Render loop: applies keyboard movement, emits paddle updates, draws the court.
  useEffect(() => {
    let raf = 0;
    let lastTime = performance.now();
    let lastSentY: number | null = null;

    function draw() {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;

      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, COURT_WIDTH, COURT_HEIGHT);

      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.setLineDash([8, 12]);
      ctx.beginPath();
      ctx.moveTo(COURT_WIDTH / 2, 0);
      ctx.lineTo(COURT_WIDTH / 2, COURT_HEIGHT);
      ctx.stroke();
      ctx.setLineDash([]);

      const state = gameStateRef.current;
      const mySide = sideRef.current;
      const leftY = mySide === "left" ? localPaddleYRef.current : state?.paddles.left.y ?? COURT_HEIGHT / 2;
      const rightY =
        mySide === "right" ? localPaddleYRef.current : state?.paddles.right.y ?? COURT_HEIGHT / 2;

      ctx.fillStyle = "#fff";
      ctx.fillRect(PADDLE_MARGIN - PADDLE_WIDTH / 2, leftY - PADDLE_HEIGHT / 2, PADDLE_WIDTH, PADDLE_HEIGHT);
      ctx.fillRect(
        COURT_WIDTH - PADDLE_MARGIN - PADDLE_WIDTH / 2,
        rightY - PADDLE_HEIGHT / 2,
        PADDLE_WIDTH,
        PADDLE_HEIGHT,
      );

      if (state) {
        ctx.beginPath();
        ctx.arc(state.ball.position.x, state.ball.position.y, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = "32px monospace";
        ctx.textAlign = "center";
        ctx.fillText(String(state.paddles.left.score), COURT_WIDTH / 2 - 60, 48);
        ctx.fillText(String(state.paddles.right.score), COURT_WIDTH / 2 + 60, 48);
      }
    }

    function frame(now: number) {
      const dt = Math.min(MAX_FRAME_DT_SECONDS, (now - lastTime) / 1000);
      lastTime = now;

      if (controlModeRef.current === "keyboard") {
        const { up, down } = pressedRef.current;
        if (up !== down) {
          const delta = (down ? 1 : -1) * PADDLE_SPEED * dt;
          localPaddleYRef.current = Math.min(
            COURT_HEIGHT - PADDLE_HEIGHT / 2,
            Math.max(PADDLE_HEIGHT / 2, localPaddleYRef.current + delta),
          );
        }
      }

      const socket = socketRef.current;
      if (socket && sideRef.current && lastSentY !== localPaddleYRef.current) {
        lastSentY = localPaddleYRef.current;
        socket.emit("paddle:move", localPaddleYRef.current);
      }

      draw();
      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const opponentSide: PlayerSide | null = side === "left" ? "right" : side === "right" ? "left" : null;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backButton} type="button" onClick={() => router.push("/")}>
          ← Lobby
        </button>
        <div className={styles.roomTitle}>{room?.name ?? "Room"}</div>
        <div className={styles.controlIndicator}>
          Control: {controlMode === "keyboard" ? "Keyboard (↑/↓ or W/S)" : "Mouse"}
        </div>
      </div>

      <div className={styles.courtWrapper}>
        <canvas
          ref={canvasRef}
          width={COURT_WIDTH}
          height={COURT_HEIGHT}
          className={styles.canvas}
          onMouseMove={handleMouseMove}
        />

        {status === "connecting" && <div className={styles.overlay}>Connecting…</div>}
        {status === "waiting" && (
          <div className={styles.overlay}>Waiting for an opponent to join…</div>
        )}
        {status === "error" && <div className={styles.overlay}>{errorMsg}</div>}
        {status === "finished" && (
          <div className={styles.overlay}>
            <div className={styles.overlayTitle}>{winner === side ? "You win!" : "You lose."}</div>
            <button className={styles.primaryButton} type="button" onClick={() => router.push("/")}>
              Back to lobby
            </button>
          </div>
        )}
      </div>

      <p className={styles.hint}>
        {side ? `You are the ${side} paddle` : "Joining…"}
        {opponentSide ? ` — opponent is ${opponentSide}.` : "."} Move with Arrow Up/Down, W/S, or your
        mouse — whichever you use last takes control.
      </p>
    </div>
  );
}
