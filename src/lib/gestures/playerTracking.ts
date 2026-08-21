import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { allVisible, dist, mid } from '@/lib/gestures/geometry';
import { DUO_PLAYER_COUNT, DUO_THUMBS_PER_PLAYER } from '@/lib/gestures/duoConstants';

const POSE = {
  nose: 0,
  lShoulder: 11,
  rShoulder: 12,
} as const;

export interface CountHandsPerPlayerOptions {
  maxAssignDist?: number;
  maxPerPlayer?: number;
}

function sortByX(points: NormalizedLandmark[]): NormalizedLandmark[] {
  return [...points].sort((a, b) => a.x - b.x);
}

function poseTorsoMid(pose: NormalizedLandmark[]): NormalizedLandmark | null {
  if (pose.length < 13) return null;
  const ls = pose[POSE.lShoulder];
  const rs = pose[POSE.rShoulder];
  const lh = pose[23];
  const rh = pose[24];
  if (allVisible(pose, [POSE.lShoulder, POSE.rShoulder], 0.2)) {
    return mid(ls, rs);
  }
  if (pose.length >= 25 && allVisible(pose, [23, 24], 0.2)) {
    return mid(lh, rh);
  }
  if (visibleEnough(ls, 0.2) && visibleEnough(rs, 0.2)) return mid(ls, rs);
  if (visibleEnough(pose[POSE.nose], 0.2)) return pose[POSE.nose];
  return null;
}

function faceCenter(face: NormalizedLandmark[]): NormalizedLandmark | null {
  if (face.length === 0) return null;
  let x = 0;
  let y = 0;
  let n = 0;
  for (const point of face) {
    if (!visibleEnough(point)) continue;
    x += point.x;
    y += point.y;
    n += 1;
  }
  if (n === 0) return face[0] ?? null;
  return { x: x / n, y: y / n, z: 0, visibility: 1 };
}

function visibleEnough(lm: NormalizedLandmark | undefined, min = 0.25): lm is NormalizedLandmark {
  if (!lm) return false;
  return (lm.visibility ?? 1) >= min;
}

function countVisiblePoses(poseLandmarks: NormalizedLandmark[][]): number {
  return poseLandmarks.filter((pose) => poseTorsoMid(pose) !== null).length;
}

/** Best estimate of how many players are in frame (poses + faces). */
export function countPlayersInFrame(
  poseLandmarks: NormalizedLandmark[][],
  faceLandmarks: NormalizedLandmark[][] = [],
): number {
  return Math.max(countVisiblePoses(poseLandmarks), faceLandmarks.length);
}

/** Visible body tracks from pose landmarks only. */
export function countBodiesInFrame(poseLandmarks: NormalizedLandmark[][]): number {
  return countVisiblePoses(poseLandmarks);
}

/** Two player anchor points (left → right). Prefer faces — more stable when standing close. */
export function getPlayerAnchors(
  poseLandmarks: NormalizedLandmark[][],
  faceLandmarks: NormalizedLandmark[][] = [],
): [NormalizedLandmark, NormalizedLandmark] | null {
  const faceMids = sortByX(
    faceLandmarks.map(faceCenter).filter((point): point is NormalizedLandmark => point !== null),
  );

  if (faceMids.length >= 2) {
    return [faceMids[0], faceMids[faceMids.length - 1]];
  }

  const poseMids = sortByX(
    poseLandmarks.map(poseTorsoMid).filter((point): point is NormalizedLandmark => point !== null),
  );

  if (poseMids.length >= 2) {
    return [poseMids[0], poseMids[poseMids.length - 1]];
  }

  if (poseMids.length === 1 && faceMids.length === 1) {
    const pair = sortByX([poseMids[0], faceMids[0]]);
    if (dist(pair[0], pair[1]) < 0.06) return null;
    return [pair[0], pair[1]];
  }

  return null;
}

/** Body-only player anchors (left → right) from pose tracks. */
export function getBodyAnchors(
  poseLandmarks: NormalizedLandmark[][],
): [NormalizedLandmark, NormalizedLandmark] | null {
  return getPlayerAnchors(poseLandmarks, []);
}

interface HandAssignInfo {
  leftDist: number;
  rightDist: number;
}

function bestHandAssignment(
  handInfo: HandAssignInfo[],
  maxAssignDist: number,
  maxPerPlayer: number,
): [number, number] {
  const n = handInfo.length;
  if (n === 0) return [0, 0];

  let bestCounts: [number, number] = [0, 0];
  let bestScore = -Infinity;

  for (let mask = 0; mask < 1 << n; mask += 1) {
    const counts: [number, number] = [0, 0];
    let score = 0;
    let valid = true;

    for (let i = 0; i < n; i += 1) {
      const assignLeft = (mask & (1 << i)) !== 0;
      const info = handInfo[i];
      const assignDist = assignLeft ? info.leftDist : info.rightDist;
      if (assignDist > maxAssignDist) {
        valid = false;
        break;
      }
      if (assignLeft) counts[0] += 1;
      else counts[1] += 1;
      score -= assignDist;
    }

    if (!valid) continue;
    if (counts[0] > maxPerPlayer || counts[1] > maxPerPlayer) continue;

    score -= Math.abs(counts[0] - counts[1]) * 0.03;

    if (score > bestScore) {
      bestScore = score;
      bestCounts = counts;
    }
  }

  if (bestScore > -Infinity) return bestCounts;

  return greedyHandAssignment(handInfo, maxAssignDist, maxPerPlayer);
}

function greedyHandAssignment(
  handInfo: HandAssignInfo[],
  maxAssignDist: number,
  maxPerPlayer: number,
): [number, number] {
  const ranked = handInfo
    .map((info, index) => ({
      index,
      ...info,
      preferLeft: info.leftDist <= info.rightDist,
      margin: Math.abs(info.leftDist - info.rightDist),
      nearest: Math.min(info.leftDist, info.rightDist),
    }))
    .filter((item) => item.nearest <= maxAssignDist)
    .sort((a, b) => b.margin - a.margin);

  const counts: [number, number] = [0, 0];
  const overflow: typeof ranked = [];

  for (const item of ranked) {
    const side: 0 | 1 = item.preferLeft ? 0 : 1;
    if (counts[side] < maxPerPlayer) counts[side] += 1;
    else overflow.push(item);
  }

  for (const item of overflow) {
    const primary: 0 | 1 = item.preferLeft ? 0 : 1;
    const other: 0 | 1 = primary === 0 ? 1 : 0;
    if (counts[other] >= maxPerPlayer) continue;
    const otherDist = other === 0 ? item.leftDist : item.rightDist;
    if (otherDist <= maxAssignDist * 1.15) counts[other] += 1;
  }

  return counts;
}

export function countHandsPerPlayer(
  hands: NormalizedLandmark[][],
  poseLandmarks: NormalizedLandmark[][],
  faceLandmarks: NormalizedLandmark[][] = [],
  options: CountHandsPerPlayerOptions = {},
): [number, number] {
  const maxAssignDist = options.maxAssignDist ?? 0.48;
  const maxPerPlayer = options.maxPerPlayer ?? DUO_THUMBS_PER_PLAYER;

  const anchors = getPlayerAnchors(poseLandmarks, faceLandmarks);
  if (!anchors) return [0, 0];

  const [leftMid, rightMid] = anchors;
  if (dist(leftMid, rightMid) < 0.05) return [0, 0];

  const handInfo = hands.map((hand) => {
    const wrist = hand[0];
    return {
      leftDist: dist(wrist, leftMid),
      rightDist: dist(wrist, rightMid),
    };
  });

  return bestHandAssignment(handInfo, maxAssignDist, maxPerPlayer);
}

export function hasTwoPlayersInFrame(
  poseLandmarks: NormalizedLandmark[][],
  faceLandmarks: NormalizedLandmark[][] = [],
): boolean {
  return countPlayersInFrame(poseLandmarks, faceLandmarks) >= DUO_PLAYER_COUNT;
}
