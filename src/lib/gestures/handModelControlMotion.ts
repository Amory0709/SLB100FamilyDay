export const HAND_MODEL_MOTION = {
  /** Horizontal orbit — slightly softer than before. */
  orbitAzimuth: 3.4,
  /** Vertical orbit — a bit slower than horizontal. */
  orbitPolar: 2.6,
  /** Multiplicative zoom strength (hand up = zoom in). */
  zoomExponent: 4.2,
  /** 0–1; higher = snappier, lower = smoother. */
  cursorSmoothing: 0.38,
  /** Ignore micro jitter below this normalized delta. */
  deadZone: 0.001,
  /** Cap per-frame palm travel to avoid landmark spikes. */
  maxDelta: 0.045,
  /** Skip motion for a few frames after entering a control mode. */
  warmupFrames: 2,
} as const;

export type HandControlMode = 'idle' | 'rotate' | 'zoom';

export interface HandMotionDelta {
  dx: number;
  dy: number;
}

export class HandMotionSmoother {
  private smoothed: { x: number; y: number } | null = null;
  private mode: HandControlMode = 'idle';
  private warmupLeft = 0;

  reset(): void {
    this.smoothed = null;
    this.mode = 'idle';
    this.warmupLeft = 0;
  }

  release(): void {
    this.mode = 'idle';
    this.smoothed = null;
    this.warmupLeft = 0;
  }

  update(cursor: { x: number; y: number }, mode: 'rotate' | 'zoom'): HandMotionDelta | null {
    if (this.mode !== mode) {
      this.mode = mode;
      this.smoothed = { x: cursor.x, y: cursor.y };
      this.warmupLeft = HAND_MODEL_MOTION.warmupFrames;
      return null;
    }

    if (!this.smoothed) {
      this.smoothed = { x: cursor.x, y: cursor.y };
      return null;
    }

    const alpha = HAND_MODEL_MOTION.cursorSmoothing;
    const sx = this.smoothed.x + (cursor.x - this.smoothed.x) * alpha;
    const sy = this.smoothed.y + (cursor.y - this.smoothed.y) * alpha;

    let dx = sx - this.smoothed.x;
    let dy = sy - this.smoothed.y;
    this.smoothed = { x: sx, y: sy };

    if (this.warmupLeft > 0) {
      this.warmupLeft -= 1;
      return null;
    }

    const mag = Math.hypot(dx, dy);
    if (mag < HAND_MODEL_MOTION.deadZone) {
      return { dx: 0, dy: 0 };
    }

    if (mag > HAND_MODEL_MOTION.maxDelta) {
      const scale = HAND_MODEL_MOTION.maxDelta / mag;
      dx *= scale;
      dy *= scale;
    }

    return { dx, dy };
  }
}

/** Normalize motion to ~60 fps so 120 Hz screens do not feel twice as fast. */
export function frameMotionScale(dtSeconds: number): number {
  return Math.min(2.2, Math.max(0.55, dtSeconds * 60));
}
