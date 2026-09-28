import type { Server } from "socket.io";
import type {
  BallState,
  ClientToServerEvents,
  GameState,
  InterServerEvents,
  PaddleState,
  PlayerSide,
  ServerToClientEvents,
  SocketData,
} from "@pong/common";
import {
  BALL_INITIAL_SPEED,
  BALL_MAX_SPEED,
  BALL_SPEEDUP_FACTOR,
  GAME_CONSTANTS,
  TICK_RATE_HZ,
  WIN_SCORE,
} from "@pong/common";

export type TypedServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

const { COURT_WIDTH, COURT_HEIGHT, PADDLE_HEIGHT, PADDLE_WIDTH, PADDLE_MARGIN, BALL_RADIUS } =
  GAME_CONSTANTS;

const TICK_INTERVAL_MS = 1000 / TICK_RATE_HZ;
const MAX_DELTA_SECONDS = 0.05;

/** Serves the ball from the center, within +/-45 degrees of horizontal. */
function serveBall(directionSign: 1 | -1): BallState {
  const maxAngle = Math.PI / 4;
  const angle = (Math.random() * 2 - 1) * maxAngle;
  const speed = BALL_INITIAL_SPEED;
  return {
    position: { x: COURT_WIDTH / 2, y: COURT_HEIGHT / 2 },
    velocity: {
      x: Math.cos(angle) * speed * directionSign,
      y: Math.sin(angle) * speed,
    },
    speed,
  };
}

function createPaddle(): PaddleState {
  return { y: COURT_HEIGHT / 2, score: 0, connected: true };
}

export class GameSession {
  private state: GameState;
  private tickHandle: ReturnType<typeof setInterval> | null = null;
  private lastBroadcastAt = 0;
  private lastTickAt = Date.now();
  /**
   * How often `game:state` is broadcast, in ms. Actual broadcast frequency is
   * capped by TICK_RATE_HZ, since state only changes once per tick.
   */
  private readonly broadcastIntervalMs: number;

  constructor(
    private readonly io: TypedServer,
    private readonly roomId: string,
    broadcastRateHz: number,
    private readonly onFinished: (winner: PlayerSide) => void,
  ) {
    this.broadcastIntervalMs = 1000 / broadcastRateHz;
    this.state = {
      status: "waiting",
      winner: null,
      ball: serveBall(Math.random() < 0.5 ? 1 : -1),
      paddles: { left: createPaddle(), right: createPaddle() },
    };
  }

  getState(): GameState {
    return this.state;
  }

  start(): void {
    if (this.tickHandle || this.state.status === "finished") return;
    this.state.status = "in_progress";
    this.lastTickAt = Date.now();
    this.tickHandle = setInterval(() => this.tick(), TICK_INTERVAL_MS);
    this.io.to(this.roomId).emit("game:started");
  }

  stop(): void {
    if (this.tickHandle) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
  }

  setPlayerConnected(side: PlayerSide, connected: boolean): void {
    this.state.paddles[side].connected = connected;
  }

  setPaddleTarget(side: PlayerSide, y: number): void {
    const half = PADDLE_HEIGHT / 2;
    const clamped = Math.min(COURT_HEIGHT - half, Math.max(half, y));
    this.state.paddles[side].y = clamped;
  }

  /** Ends the game immediately in favor of `winner` (e.g. opponent disconnected). */
  forfeit(winner: PlayerSide): void {
    if (this.state.status === "finished") return;
    this.finish(winner);
  }

  private tick(): void {
    const now = Date.now();
    const dt = Math.min(MAX_DELTA_SECONDS, (now - this.lastTickAt) / 1000);
    this.lastTickAt = now;

    if (this.state.status === "in_progress") {
      this.step(dt);
    }

    if (now - this.lastBroadcastAt >= this.broadcastIntervalMs) {
      this.lastBroadcastAt = now;
      this.io.to(this.roomId).emit("game:state", this.state);
    }
  }

  private step(dt: number): void {
    const ball = this.state.ball;
    ball.position.x += ball.velocity.x * dt;
    ball.position.y += ball.velocity.y * dt;

    if (ball.position.y - BALL_RADIUS <= 0 && ball.velocity.y < 0) {
      ball.position.y = BALL_RADIUS;
      ball.velocity.y *= -1;
    } else if (ball.position.y + BALL_RADIUS >= COURT_HEIGHT && ball.velocity.y > 0) {
      ball.position.y = COURT_HEIGHT - BALL_RADIUS;
      ball.velocity.y *= -1;
    }

    this.handlePaddleCollision("left");
    this.handlePaddleCollision("right");

    if (ball.position.x < -BALL_RADIUS * 2) {
      this.score("right");
    } else if (ball.position.x > COURT_WIDTH + BALL_RADIUS * 2) {
      this.score("left");
    }
  }

  private handlePaddleCollision(side: PlayerSide): void {
    const ball = this.state.ball;
    const paddle = this.state.paddles[side];
    const paddleX = side === "left" ? PADDLE_MARGIN : COURT_WIDTH - PADDLE_MARGIN;
    const movingToward = side === "left" ? ball.velocity.x < 0 : ball.velocity.x > 0;
    if (!movingToward) return;

    const withinX =
      side === "left"
        ? ball.position.x - BALL_RADIUS <= paddleX + PADDLE_WIDTH / 2 &&
          ball.position.x >= paddleX - PADDLE_WIDTH / 2
        : ball.position.x + BALL_RADIUS >= paddleX - PADDLE_WIDTH / 2 &&
          ball.position.x <= paddleX + PADDLE_WIDTH / 2;
    const withinY = Math.abs(ball.position.y - paddle.y) <= PADDLE_HEIGHT / 2 + BALL_RADIUS;
    if (!withinX || !withinY) return;

    // Deflection angle depends on where the ball struck the paddle (-1..1 -> +/-60deg).
    const offset = (ball.position.y - paddle.y) / (PADDLE_HEIGHT / 2);
    const newSpeed = Math.min(ball.speed * BALL_SPEEDUP_FACTOR, BALL_MAX_SPEED);
    const angle = offset * (Math.PI / 3);
    const directionSign = side === "left" ? 1 : -1;

    ball.velocity.x = Math.cos(angle) * newSpeed * directionSign;
    ball.velocity.y = Math.sin(angle) * newSpeed;
    ball.speed = newSpeed;

    // Nudge the ball just outside the paddle so it isn't re-detected next tick.
    ball.position.x =
      side === "left"
        ? paddleX + PADDLE_WIDTH / 2 + BALL_RADIUS
        : paddleX - PADDLE_WIDTH / 2 - BALL_RADIUS;
  }

  private score(scoringSide: PlayerSide): void {
    this.state.paddles[scoringSide].score += 1;
    if (this.state.paddles[scoringSide].score >= WIN_SCORE) {
      this.finish(scoringSide);
      return;
    }
    // Serve toward whoever was just scored on.
    const servedTowardSign: 1 | -1 = scoringSide === "right" ? -1 : 1;
    this.state.ball = serveBall(servedTowardSign);
  }

  private finish(winner: PlayerSide): void {
    this.state.status = "finished";
    this.state.winner = winner;
    this.stop();
    this.io.to(this.roomId).emit("game:state", this.state);
    this.io.to(this.roomId).emit("game:finished", winner);
    this.onFinished(winner);
  }
}
