import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

const HAND_BONES: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
];

function cloneLandmarks(landmarks: NormalizedLandmark[]): NormalizedLandmark[] {
  return landmarks.map((p) => ({ ...p }));
}

function dist3(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export interface LandmarkSmootherOptions {
  /** Max normalized jump per frame before clamping. Default 0.09 */
  maxDelta?: number;
  /** Wrist alpha when hand is still. Default 0.3 */
  wristAlphaMin?: number;
  /** Wrist alpha when hand is moving fast. Default 0.82 */
  wristAlphaMax?: number;
  /** Finger alpha when hand is still. Default 0.2 */
  fingerAlphaMin?: number;
  /** Finger alpha when hand is moving fast. Default 0.72 */
  fingerAlphaMax?: number;
  /** Wrist speed (normalized/frame) that reaches max alpha. Default 0.022 */
  speedForMaxAlpha?: number;
  /** Dead zone for finger offsets while still. Default 0.0007 */
  deadZone?: number;
  /** Bone length blend while hand is still. Default 0.4 */
  boneLengthBlend?: number;
  /** Apply bone constraints only below this wrist speed. Default 0.012 */
  boneLengthSpeedThreshold?: number;
}

export const DEFAULT_LANDMARK_SMOOTHER_OPTIONS: Required<LandmarkSmootherOptions> = {
  maxDelta: 0.09,
  wristAlphaMin: 0.3,
  wristAlphaMax: 0.82,
  fingerAlphaMin: 0.2,
  fingerAlphaMax: 0.72,
  speedForMaxAlpha: 0.022,
  deadZone: 0.0007,
  boneLengthBlend: 0.4,
  boneLengthSpeedThreshold: 0.012,
};

interface HandStabilizerState {
  prev: NormalizedLandmark[] | null;
  boneLengths: number[] | null;
}

class HandLandmarkStabilizer {
  private readonly options: Required<LandmarkSmootherOptions>;
  private state: HandStabilizerState = {
    prev: null,
    boneLengths: null,
  };

  constructor(options: Required<LandmarkSmootherOptions>) {
    this.options = options;
  }

  stabilize(landmarks: NormalizedLandmark[], _tMs: number): NormalizedLandmark[] {
    let next = cloneLandmarks(landmarks);
    const wristSpeed = this.measureWristSpeed(landmarks);

    next = this.clampOutliers(next, wristSpeed);
    next = this.smoothWristAnchored(next, wristSpeed);

    if (wristSpeed < this.options.boneLengthSpeedThreshold) {
      next = this.enforceBoneLengths(next);
    }

    this.state.prev = cloneLandmarks(next);
    return next;
  }

  reset(): void {
    this.state.prev = null;
    this.state.boneLengths = null;
  }

  private measureWristSpeed(landmarks: NormalizedLandmark[]): number {
    const prev = this.state.prev;
    if (!prev || prev.length !== landmarks.length) return 0;
    return Math.hypot(landmarks[0].x - prev[0].x, landmarks[0].y - prev[0].y);
  }

  private movementFactor(wristSpeed: number): number {
    return Math.min(1, wristSpeed / this.options.speedForMaxAlpha);
  }

  private clampOutliers(landmarks: NormalizedLandmark[], wristSpeed: number): NormalizedLandmark[] {
    const prev = this.state.prev;
    if (!prev || prev.length !== landmarks.length) return landmarks;

    const moveFactor = this.movementFactor(wristSpeed);
    const maxDelta = lerp(this.options.maxDelta * 0.55, this.options.maxDelta, moveFactor);
    return landmarks.map((point, i) => {
      const dx = point.x - prev[i].x;
      const dy = point.y - prev[i].y;
      const jump = Math.hypot(dx, dy);
      if (jump <= maxDelta) return point;

      const scale = maxDelta / jump;
      return {
        ...point,
        x: prev[i].x + dx * scale,
        y: prev[i].y + dy * scale,
        z:
          point.z !== undefined && prev[i].z !== undefined
            ? prev[i].z + ((point.z ?? 0) - (prev[i].z ?? 0)) * scale
            : point.z,
      };
    });
  }

  private smoothWristAnchored(landmarks: NormalizedLandmark[], wristSpeed: number): NormalizedLandmark[] {
    const prev = this.state.prev;
    if (!prev || prev.length !== landmarks.length) return landmarks;

    const moveFactor = this.movementFactor(wristSpeed);
    const wristAlpha = lerp(this.options.wristAlphaMin, this.options.wristAlphaMax, moveFactor);
    const fingerAlpha = lerp(this.options.fingerAlphaMin, this.options.fingerAlphaMax, moveFactor);
    const applyDeadZone = moveFactor < 0.25;
    const { deadZone } = this.options;
    const wrist = landmarks[0];
    const prevWrist = prev[0];

    const smoothWrist = {
      x: lerp(prevWrist.x, wrist.x, wristAlpha),
      y: lerp(prevWrist.y, wrist.y, wristAlpha),
      z:
        wrist.z !== undefined && prevWrist.z !== undefined
          ? lerp(prevWrist.z, wrist.z, wristAlpha)
          : wrist.z,
    };

    return landmarks.map((point, i) => {
      if (i === 0) {
        return { ...point, ...smoothWrist };
      }

      const offX = point.x - wrist.x;
      const offY = point.y - wrist.y;
      const offZ = (point.z ?? 0) - (wrist.z ?? 0);

      const prevOffX = prev[i].x - prevWrist.x;
      const prevOffY = prev[i].y - prevWrist.y;
      const prevOffZ = (prev[i].z ?? 0) - (prevWrist.z ?? 0);

      let nextOffX = lerp(prevOffX, offX, fingerAlpha);
      let nextOffY = lerp(prevOffY, offY, fingerAlpha);
      let nextOffZ = lerp(prevOffZ, offZ, fingerAlpha);

      if (applyDeadZone && Math.abs(nextOffX - prevOffX) < deadZone) nextOffX = prevOffX;
      if (applyDeadZone && Math.abs(nextOffY - prevOffY) < deadZone) nextOffY = prevOffY;
      if (applyDeadZone && Math.abs(nextOffZ - prevOffZ) < deadZone) nextOffZ = prevOffZ;

      return {
        ...point,
        x: smoothWrist.x + nextOffX,
        y: smoothWrist.y + nextOffY,
        z: smoothWrist.z !== undefined ? smoothWrist.z + nextOffZ : point.z,
      };
    });
  }

  private enforceBoneLengths(landmarks: NormalizedLandmark[]): NormalizedLandmark[] {
    const result = cloneLandmarks(landmarks);
    const measured = HAND_BONES.map(([a, b]) => dist3(result[a], result[b]));
    const { boneLengthBlend } = this.options;

    const targets = this.state.boneLengths
      ? measured.map((len, i) => lerp(len, this.state.boneLengths![i], boneLengthBlend))
      : measured;

    for (let i = 0; i < HAND_BONES.length; i++) {
      const [parent, child] = HAND_BONES[i];
      const parentPoint = result[parent];
      const childPoint = result[child];
      const currentLen = dist3(parentPoint, childPoint);
      const targetLen = targets[i];
      if (currentLen < 1e-6) continue;

      const scale = targetLen / currentLen;
      result[child] = {
        ...childPoint,
        x: parentPoint.x + (childPoint.x - parentPoint.x) * scale,
        y: parentPoint.y + (childPoint.y - parentPoint.y) * scale,
        z:
          childPoint.z !== undefined
            ? parentPoint.z! + ((childPoint.z ?? 0) - (parentPoint.z ?? 0)) * scale
            : childPoint.z,
      };
    }

    this.state.boneLengths = this.state.boneLengths
      ? targets.map((_, i) => lerp(this.state.boneLengths![i], measured[i], 0.12))
      : measured;

    return result;
  }
}

export class MultiHandLandmarkSmoother {
  private readonly options: Required<LandmarkSmootherOptions>;
  private hands: HandLandmarkStabilizer[] = [];

  constructor(options: LandmarkSmootherOptions = {}) {
    this.options = { ...DEFAULT_LANDMARK_SMOOTHER_OPTIONS, ...options };
  }

  smooth(allLandmarks: NormalizedLandmark[][], tMs: number): NormalizedLandmark[][] {
    const count = allLandmarks.length;

    while (this.hands.length < count) {
      this.hands.push(new HandLandmarkStabilizer(this.options));
    }
    if (this.hands.length > count) {
      this.hands.splice(count).forEach((hand) => hand.reset());
    }

    return allLandmarks.map((landmarks, i) => this.hands[i].stabilize(landmarks, tMs));
  }

  reset(): void {
    this.hands.forEach((hand) => hand.reset());
    this.hands = [];
  }
}
