import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

const HAND_BONES: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
];

const POSE_BONES: ReadonlyArray<readonly [number, number]> = [
  [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21],
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 29], [27, 31],
  [24, 26], [26, 28], [28, 30], [28, 32],
  [0, 11], [0, 12],
];

/** Mean hand bone length — reference for scale-normalized motion thresholds. */
const HAND_REFERENCE_SCALE = 0.045;

export interface LandmarkSkeleton {
  bones: ReadonlyArray<readonly [number, number]>;
  getAnchor: (landmarks: NormalizedLandmark[]) => NormalizedLandmark;
  minLandmarks: number;
}

export const HAND_SKELETON: LandmarkSkeleton = {
  bones: HAND_BONES,
  getAnchor: (landmarks) => landmarks[0],
  minLandmarks: 21,
};

export const POSE_SKELETON: LandmarkSkeleton = {
  bones: POSE_BONES,
  getAnchor: hipCenter,
  minLandmarks: 25,
};

function cloneLandmarks(landmarks: NormalizedLandmark[]): NormalizedLandmark[] {
  return landmarks.map((p) => ({ ...p }));
}

function dist3(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hipCenter(landmarks: NormalizedLandmark[]): NormalizedLandmark {
  const lh = landmarks[23];
  const rh = landmarks[24];
  return {
    x: (lh.x + rh.x) / 2,
    y: (lh.y + rh.y) / 2,
    z: ((lh.z ?? 0) + (rh.z ?? 0)) / 2,
    visibility: Math.min(lh.visibility ?? 1, rh.visibility ?? 1),
  };
}

export interface LandmarkSmootherOptions {
  /** Max normalized jump per frame before clamping. Default 0.09 */
  maxDelta?: number;
  /** Anchor alpha when still. Default 0.3 */
  wristAlphaMin?: number;
  /** Anchor alpha when moving fast. Default 0.82 */
  wristAlphaMax?: number;
  /** Limb alpha when still. Default 0.2 */
  fingerAlphaMin?: number;
  /** Limb alpha when moving fast. Default 0.72 */
  fingerAlphaMax?: number;
  /** Anchor speed (normalized/frame) that reaches max alpha. Default 0.022 */
  speedForMaxAlpha?: number;
  /** Dead zone for offsets while still. Default 0.0007 */
  deadZone?: number;
  /** Bone length blend while still. Default 0.4 */
  boneLengthBlend?: number;
  /** Apply bone constraints only below this anchor speed. Default 0.012 */
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

/** @deprecated use DEFAULT_LANDMARK_SMOOTHER_OPTIONS — pose now shares hand tuning. */
export const DEFAULT_POSE_LANDMARK_SMOOTHER_OPTIONS = DEFAULT_LANDMARK_SMOOTHER_OPTIONS;

interface StabilizerState {
  prev: NormalizedLandmark[] | null;
  boneLengths: number[] | null;
}

function movementFactor(anchorSpeed: number, speedForMaxAlpha: number): number {
  return Math.min(1, anchorSpeed / speedForMaxAlpha);
}

function measureSkeletonScale(
  landmarks: NormalizedLandmark[],
  bones: ReadonlyArray<readonly [number, number]>,
): number {
  if (landmarks.length === 0 || bones.length === 0) return HAND_REFERENCE_SCALE;

  let sum = 0;
  for (const [a, b] of bones) {
    sum += dist3(landmarks[a], landmarks[b]);
  }
  return sum / bones.length;
}

function scaleMotionOptions(
  options: Required<LandmarkSmootherOptions>,
  landmarks: NormalizedLandmark[],
  bones: ReadonlyArray<readonly [number, number]>,
): Required<LandmarkSmootherOptions> {
  const scale = measureSkeletonScale(landmarks, bones) / HAND_REFERENCE_SCALE;
  return {
    ...options,
    maxDelta: options.maxDelta * scale,
    deadZone: options.deadZone * scale,
    speedForMaxAlpha: options.speedForMaxAlpha * scale,
    boneLengthSpeedThreshold: options.boneLengthSpeedThreshold * scale,
  };
}

function measureAnchorSpeed(
  landmarks: NormalizedLandmark[],
  prev: NormalizedLandmark[] | null,
  getAnchor: (lm: NormalizedLandmark[]) => NormalizedLandmark,
): number {
  if (!prev || prev.length !== landmarks.length) return 0;
  const anchor = getAnchor(landmarks);
  const prevAnchor = getAnchor(prev);
  return Math.hypot(anchor.x - prevAnchor.x, anchor.y - prevAnchor.y);
}

function clampPointDelta(
  current: number,
  previous: number,
  maxDelta: number,
): number {
  const delta = current - previous;
  if (Math.abs(delta) <= maxDelta) return current;
  return previous + Math.sign(delta) * maxDelta;
}

function clampOutliers(
  landmarks: NormalizedLandmark[],
  prev: NormalizedLandmark[] | null,
  anchorSpeed: number,
  options: Required<LandmarkSmootherOptions>,
  getAnchor: (lm: NormalizedLandmark[]) => NormalizedLandmark,
): NormalizedLandmark[] {
  if (!prev || prev.length !== landmarks.length) return landmarks;

  const moveFactor = movementFactor(anchorSpeed, options.speedForMaxAlpha);
  const maxDelta = lerp(options.maxDelta * 0.55, options.maxDelta, moveFactor);
  const anchor = getAnchor(landmarks);
  const prevAnchor = getAnchor(prev);

  const clampedAnchor = {
    ...anchor,
    x: clampPointDelta(anchor.x, prevAnchor.x, maxDelta),
    y: clampPointDelta(anchor.y, prevAnchor.y, maxDelta),
    z:
      anchor.z !== undefined && prevAnchor.z !== undefined
        ? clampPointDelta(anchor.z, prevAnchor.z, maxDelta)
        : anchor.z,
  };

  return landmarks.map((point, i) => {
    const offX = point.x - anchor.x;
    const offY = point.y - anchor.y;
    const offZ = (point.z ?? 0) - (anchor.z ?? 0);
    const prevOffX = prev[i].x - prevAnchor.x;
    const prevOffY = prev[i].y - prevAnchor.y;
    const prevOffZ = (prev[i].z ?? 0) - (prevAnchor.z ?? 0);

    const nextOffX = clampPointDelta(offX, prevOffX, maxDelta);
    const nextOffY = clampPointDelta(offY, prevOffY, maxDelta);
    const nextOffZ = clampPointDelta(offZ, prevOffZ, maxDelta);

    return {
      ...point,
      x: clampedAnchor.x + nextOffX,
      y: clampedAnchor.y + nextOffY,
      z: clampedAnchor.z !== undefined ? clampedAnchor.z + nextOffZ : point.z,
    };
  });
}

function smoothAnchorRelative(
  landmarks: NormalizedLandmark[],
  prev: NormalizedLandmark[] | null,
  anchorSpeed: number,
  options: Required<LandmarkSmootherOptions>,
  getAnchor: (lm: NormalizedLandmark[]) => NormalizedLandmark,
): NormalizedLandmark[] {
  if (!prev || prev.length !== landmarks.length) return landmarks;

  const moveFactor = movementFactor(anchorSpeed, options.speedForMaxAlpha);
  const anchorAlpha = lerp(options.wristAlphaMin, options.wristAlphaMax, moveFactor);
  const limbAlpha = lerp(options.fingerAlphaMin, options.fingerAlphaMax, moveFactor);
  const applyDeadZone = moveFactor < 0.25;
  const { deadZone } = options;
  const anchor = getAnchor(landmarks);
  const prevAnchor = getAnchor(prev);

  const smoothAnchor = {
    x: lerp(prevAnchor.x, anchor.x, anchorAlpha),
    y: lerp(prevAnchor.y, anchor.y, anchorAlpha),
    z:
      anchor.z !== undefined && prevAnchor.z !== undefined
        ? lerp(prevAnchor.z, anchor.z, anchorAlpha)
        : anchor.z,
  };

  return landmarks.map((point, i) => {
    const offX = point.x - anchor.x;
    const offY = point.y - anchor.y;
    const offZ = (point.z ?? 0) - (anchor.z ?? 0);

    const prevOffX = prev[i].x - prevAnchor.x;
    const prevOffY = prev[i].y - prevAnchor.y;
    const prevOffZ = (prev[i].z ?? 0) - (prevAnchor.z ?? 0);

    let nextOffX = lerp(prevOffX, offX, limbAlpha);
    let nextOffY = lerp(prevOffY, offY, limbAlpha);
    let nextOffZ = lerp(prevOffZ, offZ, limbAlpha);

    if (applyDeadZone && Math.abs(nextOffX - prevOffX) < deadZone) nextOffX = prevOffX;
    if (applyDeadZone && Math.abs(nextOffY - prevOffY) < deadZone) nextOffY = prevOffY;
    if (applyDeadZone && Math.abs(nextOffZ - prevOffZ) < deadZone) nextOffZ = prevOffZ;

    return {
      ...point,
      x: smoothAnchor.x + nextOffX,
      y: smoothAnchor.y + nextOffY,
      z: smoothAnchor.z !== undefined ? smoothAnchor.z + nextOffZ : point.z,
    };
  });
}

function enforceBoneLengths(
  landmarks: NormalizedLandmark[],
  state: StabilizerState,
  options: Required<LandmarkSmootherOptions>,
  bones: ReadonlyArray<readonly [number, number]>,
): NormalizedLandmark[] {
  const result = cloneLandmarks(landmarks);
  const measured = bones.map(([a, b]) => dist3(result[a], result[b]));
  const { boneLengthBlend } = options;

  const targets = state.boneLengths
    ? measured.map((len, i) => lerp(len, state.boneLengths![i], boneLengthBlend))
    : measured;

  for (let i = 0; i < bones.length; i++) {
    const [parent, child] = bones[i];
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

  state.boneLengths = state.boneLengths
    ? targets.map((_, i) => lerp(state.boneLengths![i], measured[i], 0.12))
    : measured;

  return result;
}

function stabilizeLandmarkSet(
  landmarks: NormalizedLandmark[],
  state: StabilizerState,
  options: Required<LandmarkSmootherOptions>,
  skeleton: LandmarkSkeleton,
): NormalizedLandmark[] {
  const motionOptions = scaleMotionOptions(options, landmarks, skeleton.bones);
  const anchorSpeed = measureAnchorSpeed(landmarks, state.prev, skeleton.getAnchor);

  let next = clampOutliers(landmarks, state.prev, anchorSpeed, motionOptions, skeleton.getAnchor);
  next = smoothAnchorRelative(next, state.prev, anchorSpeed, motionOptions, skeleton.getAnchor);

  if (anchorSpeed < motionOptions.boneLengthSpeedThreshold) {
    next = enforceBoneLengths(next, state, motionOptions, skeleton.bones);
  }

  state.prev = cloneLandmarks(next);
  return next;
}

class LandmarkStabilizer {
  private readonly skeleton: LandmarkSkeleton;
  private readonly options: Required<LandmarkSmootherOptions>;
  private state: StabilizerState = { prev: null, boneLengths: null };

  constructor(skeleton: LandmarkSkeleton, options: Required<LandmarkSmootherOptions>) {
    this.skeleton = skeleton;
    this.options = options;
  }

  stabilize(landmarks: NormalizedLandmark[], _tMs: number): NormalizedLandmark[] {
    if (landmarks.length < this.skeleton.minLandmarks) return landmarks;
    return stabilizeLandmarkSet(landmarks, this.state, this.options, this.skeleton);
  }

  reset(): void {
    this.state.prev = null;
    this.state.boneLengths = null;
  }
}

export class MultiLandmarkSmoother {
  private readonly skeleton: LandmarkSkeleton;
  private readonly options: Required<LandmarkSmootherOptions>;
  private stabilizers: LandmarkStabilizer[] = [];

  constructor(skeleton: LandmarkSkeleton, options: LandmarkSmootherOptions = {}) {
    this.skeleton = skeleton;
    this.options = { ...DEFAULT_LANDMARK_SMOOTHER_OPTIONS, ...options };
  }

  smooth(allLandmarks: NormalizedLandmark[][], tMs: number): NormalizedLandmark[][] {
    const count = allLandmarks.length;

    while (this.stabilizers.length < count) {
      this.stabilizers.push(new LandmarkStabilizer(this.skeleton, this.options));
    }
    if (this.stabilizers.length > count) {
      this.stabilizers.splice(count).forEach((stabilizer) => stabilizer.reset());
    }

    return allLandmarks.map((landmarks, i) => this.stabilizers[i].stabilize(landmarks, tMs));
  }

  reset(): void {
    this.stabilizers.forEach((stabilizer) => stabilizer.reset());
    this.stabilizers = [];
  }
}

export class MultiHandLandmarkSmoother extends MultiLandmarkSmoother {
  constructor(options: LandmarkSmootherOptions = {}) {
    super(HAND_SKELETON, options);
  }
}

export class MultiPoseLandmarkSmoother extends MultiLandmarkSmoother {
  constructor(options: LandmarkSmootherOptions = {}) {
    super(POSE_SKELETON, options);
  }
}
