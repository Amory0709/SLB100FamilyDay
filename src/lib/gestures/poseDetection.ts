import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { allVisible, dist, mid, visible } from '@/lib/gestures/geometry';

const POSE =
  {
    nose: 0,
    lShoulder: 11,
    rShoulder: 12,
    lElbow: 13,
    rElbow: 14,
    lWrist: 15,
    rWrist: 16,
    lHip: 23,
    rHip: 24,
    lKnee: 25,
    rKnee: 26,
    lAnkle: 27,
    rAnkle: 28,
  } as const;

/** SIPP safe lift: bent knees, neutral spine, load close to chest (green zone). */
export function detectHseLift(landmarks: NormalizedLandmark[]): boolean {
  if (landmarks.length < 29) return false;

  const ls = landmarks[POSE.lShoulder];
  const rs = landmarks[POSE.rShoulder];
  const le = landmarks[POSE.lElbow];
  const re = landmarks[POSE.rElbow];
  const lw = landmarks[POSE.lWrist];
  const rw = landmarks[POSE.rWrist];
  const lh = landmarks[POSE.lHip];
  const rh = landmarks[POSE.rHip];
  const lk = landmarks[POSE.lKnee];
  const rk = landmarks[POSE.rKnee];

  if (
    !allVisible(landmarks, [
      POSE.lShoulder,
      POSE.rShoulder,
      POSE.lElbow,
      POSE.rElbow,
      POSE.lWrist,
      POSE.rWrist,
      POSE.lHip,
      POSE.rHip,
      POSE.lKnee,
      POSE.rKnee,
    ])
  ) {
    return false;
  }

  const shoulderMid = mid(ls, rs);
  const hipMid = mid(lh, rh);

  const kneesBent = lk.y > lh.y + 0.04 && rk.y > rh.y + 0.04;
  const spineNeutral = Math.abs(shoulderMid.x - hipMid.x) < 0.14;
  const backVertical = shoulderMid.y < hipMid.y - 0.08;

  const chestY = (shoulderMid.y + hipMid.y) / 2;
  const wristsInGreenZone =
    lw.y > ls.y - 0.06 &&
    lw.y < hipMid.y + 0.04 &&
    rw.y > rs.y - 0.06 &&
    rw.y < hipMid.y + 0.04;
  const wristsCloseToCore =
    Math.abs(lw.x - shoulderMid.x) < 0.22 && Math.abs(rw.x - shoulderMid.x) < 0.22;
  const elbowsBent =
    dist(lw, le) < dist(le, ls) * 1.15 && dist(rw, re) < dist(re, rs) * 1.15;
  const elbowsTucked =
    dist(le, shoulderMid) < 0.28 && dist(re, shoulderMid) < 0.28;

  return (
    kneesBent &&
    spineNeutral &&
    backVertical &&
    wristsInGreenZone &&
    wristsCloseToCore &&
    elbowsBent &&
    elbowsTucked &&
    Math.abs(lw.y - rw.y) < 0.12 &&
    Math.abs(lw.y - chestY) < 0.14
  );
}

/** Flex both biceps — forearms up, elbows out, wrists near shoulder height. */
export function detectMusclePose(landmarks: NormalizedLandmark[]): boolean {
  if (landmarks.length < 17) return false;

  const ls = landmarks[POSE.lShoulder];
  const rs = landmarks[POSE.rShoulder];
  const le = landmarks[POSE.lElbow];
  const re = landmarks[POSE.rElbow];
  const lw = landmarks[POSE.lWrist];
  const rw = landmarks[POSE.rWrist];

  if (
    !allVisible(landmarks, [
      POSE.lShoulder,
      POSE.rShoulder,
      POSE.lElbow,
      POSE.rElbow,
      POSE.lWrist,
      POSE.rWrist,
    ])
  ) {
    return false;
  }

  const shoulderMid = mid(ls, rs);

  const leftFlexed = lw.y < le.y - 0.02 && le.y <= ls.y + 0.1;
  const rightFlexed = rw.y < re.y - 0.02 && re.y <= rs.y + 0.1;
  const wristsRaised = lw.y < ls.y + 0.08 && rw.y < rs.y + 0.08;
  const elbowsOut =
    Math.abs(le.x - shoulderMid.x) > 0.07 && Math.abs(re.x - shoulderMid.x) > 0.07;
  const forearmsVertical = Math.abs(lw.x - le.x) < 0.14 && Math.abs(rw.x - re.x) < 0.14;

  return leftFlexed && rightFlexed && wristsRaised && elbowsOut && forearmsVertical;
}

function sortPosesByX(poses: NormalizedLandmark[][]): NormalizedLandmark[][] {
  return [...poses].sort((a, b) => {
    const ax = (a[POSE.lShoulder].x + a[POSE.rShoulder].x) / 2;
    const bx = (b[POSE.lShoulder].x + b[POSE.rShoulder].x) / 2;
    return ax - bx;
  });
}

/** Both players hold HSE safe-lift pose at the same time. */
export function detectHseLiftDuo(poses: NormalizedLandmark[][]): boolean {
  if (poses.length < 2) return false;
  const sorted = sortPosesByX(poses);
  return detectHseLift(sorted[0]) && detectHseLift(sorted[1]);
}

/**
 * Couple infinity: inner wrists meet near center, outer wrists spread outward
 * at similar height (arms form the two loops of ∞).
 */
export function detectInfinitySymbol(poses: NormalizedLandmark[][]): boolean {
  if (poses.length < 2) return false;

  const [leftPerson, rightPerson] = sortPosesByX(poses);
  const innerL = leftPerson[POSE.rWrist];
  const innerR = rightPerson[POSE.lWrist];
  const outerL = leftPerson[POSE.lWrist];
  const outerR = rightPerson[POSE.rWrist];

  if (
    !allVisible(leftPerson, [POSE.lWrist, POSE.rWrist]) ||
    !allVisible(rightPerson, [POSE.lWrist, POSE.rWrist])
  ) {
    return false;
  }

  const innerDist = dist(innerL, innerR);
  const innerMeet = innerDist < 0.16;
  const innerHeightMatch = Math.abs(innerL.y - innerR.y) < 0.1;
  const innerRaised = innerL.y < leftPerson[POSE.lHip].y && innerR.y < rightPerson[POSE.rHip].y;

  const shoulderMidL = mid(leftPerson[POSE.lShoulder], leftPerson[POSE.rShoulder]);
  const shoulderMidR = mid(rightPerson[POSE.lShoulder], rightPerson[POSE.rShoulder]);
  const centerX = (shoulderMidL.x + shoulderMidR.x) / 2;

  const outerSpread =
    outerL.x < centerX - 0.06 &&
    outerR.x > centerX + 0.06 &&
    dist(outerL, outerR) > innerDist * 1.6;
  const outerHeightMatch = Math.abs(outerL.y - outerR.y) < 0.14;

  const elbowsRaised =
    leftPerson[POSE.rElbow].y < leftPerson[POSE.lHip].y &&
    rightPerson[POSE.lElbow].y < rightPerson[POSE.rHip].y;

  return (
    innerMeet &&
    innerHeightMatch &&
    innerRaised &&
    outerSpread &&
    outerHeightMatch &&
    elbowsRaised
  );
}

/** Two people close together with arms wrapped around each other. */
export function detectHug(poses: NormalizedLandmark[][]): boolean {
  if (poses.length < 2) return false;

  const [leftPerson, rightPerson] = sortPosesByX(poses);
  const lShoulderMid = mid(leftPerson[POSE.lShoulder], leftPerson[POSE.rShoulder]);
  const rShoulderMid = mid(rightPerson[POSE.lShoulder], rightPerson[POSE.rShoulder]);
  const lHipMid = mid(leftPerson[POSE.lHip], leftPerson[POSE.rHip]);
  const rHipMid = mid(rightPerson[POSE.lHip], rightPerson[POSE.rHip]);

  if (!visible(lShoulderMid) || !visible(rShoulderMid)) return false;

  const bodiesClose =
    dist(lShoulderMid, rShoulderMid) < 0.22 && dist(lHipMid, rHipMid) < 0.26;

  const leftArmAround =
    dist(leftPerson[POSE.rWrist], rShoulderMid) < 0.22 ||
    dist(leftPerson[POSE.rElbow], rShoulderMid) < 0.24;
  const rightArmAround =
    dist(rightPerson[POSE.lWrist], lShoulderMid) < 0.22 ||
    dist(rightPerson[POSE.lElbow], lShoulderMid) < 0.24;

  const torsosOverlap = Math.abs(lShoulderMid.x - rShoulderMid.x) < 0.18;

  return bodiesClose && leftArmAround && rightArmAround && torsosOverlap;
}

export function detectPoseKeys(poses: NormalizedLandmark[][]): string[] {
  const keys: string[] = [];
  if (poses.length === 0) return keys;

  if (poses.some((p) => detectHseLift(p))) keys.push('hse_lift');
  if (poses.some((p) => detectMusclePose(p))) keys.push('muscle_pose');
  if (detectHseLiftDuo(poses)) keys.push('hse_lift_duo');
  if (detectInfinitySymbol(poses)) keys.push('infinity_symbol');
  if (detectHug(poses)) keys.push('hug');

  return keys;
}
