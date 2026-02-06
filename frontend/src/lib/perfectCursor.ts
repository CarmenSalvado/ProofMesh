"use client";

type CursorPoint = [number, number];

export class PerfectCursor {
  private current: CursorPoint | null = null;
  private target: CursorPoint | null = null;
  private velocity: CursorPoint = [0, 0];
  private requestId: number | null = null;
  private lastFrame = 0;
  private lastInput: CursorPoint | null = null;
  private lastInputAt = 0;
  private disposed = false;
  private cb: (point: number[]) => void;

  constructor(cb: (point: number[]) => void) {
    this.cb = cb;
  }

  private tick = (now: number) => {
    if (this.disposed || !this.current || !this.target) {
      this.stop();
      return;
    }

    if (this.lastFrame === 0) {
      this.lastFrame = now;
    }

    const dt = Math.min(Math.max((now - this.lastFrame) / 1000, 1 / 240), 1 / 30);
    this.lastFrame = now;

    // Critically damped spring toward latest pointer target (low-latency, natural motion).
    const stiffness = 430;
    const damping = 36;
    const dx = this.target[0] - this.current[0];
    const dy = this.target[1] - this.current[1];

    this.velocity[0] += (dx * stiffness - this.velocity[0] * damping) * dt;
    this.velocity[1] += (dy * stiffness - this.velocity[1] * damping) * dt;

    this.current[0] += this.velocity[0] * dt;
    this.current[1] += this.velocity[1] * dt;
    this.cb(this.current);

    const speed = Math.hypot(this.velocity[0], this.velocity[1]);
    const distance = Math.hypot(this.target[0] - this.current[0], this.target[1] - this.current[1]);

    if (distance < 0.12 && speed < 6) {
      this.current = [this.target[0], this.target[1]];
      this.velocity = [0, 0];
      this.cb(this.current);
      this.stop();
      return;
    }

    this.requestId = requestAnimationFrame(this.tick);
  };

  addPoint = (point: number[]) => {
    if (this.disposed || point.length < 2) return;
    const next: CursorPoint = [point[0], point[1]];
    if (!Number.isFinite(next[0]) || !Number.isFinite(next[1])) return;

    if (!this.current) {
      this.current = [next[0], next[1]];
      this.target = [next[0], next[1]];
      this.cb(this.current);
      return;
    }

    // Small lead prediction to counter network/update delay without visible overshoot.
    const now = performance.now();
    if (this.lastInput && this.lastInputAt > 0) {
      const dt = Math.max((now - this.lastInputAt) / 1000, 1 / 240);
      const vx = (next[0] - this.lastInput[0]) / dt;
      const vy = (next[1] - this.lastInput[1]) / dt;
      const leadMs = 0.012;
      const px = next[0] + vx * leadMs;
      const py = next[1] + vy * leadMs;
      const leadDist = Math.hypot(px - next[0], py - next[1]);
      const maxLead = 14;
      if (leadDist > maxLead) {
        const scale = maxLead / leadDist;
        this.target = [next[0] + (px - next[0]) * scale, next[1] + (py - next[1]) * scale];
      } else {
        this.target = [px, py];
      }
    } else {
      this.target = [next[0], next[1]];
    }

    this.lastInput = [next[0], next[1]];
    this.lastInputAt = now;

    if (this.requestId === null) {
      this.lastFrame = 0;
      this.requestId = requestAnimationFrame(this.tick);
    }
  };

  dispose = () => {
    this.disposed = true;
    this.current = null;
    this.target = null;
    this.stop();
  };

  private stop = () => {
    if (this.requestId !== null) {
      cancelAnimationFrame(this.requestId);
    }
    this.requestId = null;
    this.lastFrame = 0;
  };
}
