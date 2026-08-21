import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { allVisible, dist, mid, visible } from '@/lib/gestures/geometry';
import { DUO_PLAYER_COUNT } from '@/lib/gestures/duoConstants';
import { countBodiesInFrame, getBodyAnchors } from '@/lib/gestures/playerTracking';

const HUG_MIN_VIS = 0.2;

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

function isCelebratingPose(landmarks: NormalizedLandmark[]): boolean {
  if (landmarks.length < 17) return false;
  const ls = landmarks[POSE.lShoulder];
  const rs = landmarks[POSE.rShoulder];
  const lw = landmarks[POSE.lWrist];
  const rw = landmarks[POSE.rWrist];
  if (!visible(lw, HUG_MIN_VIS) || !visible(rw, HUG_MIN_VIS)) return false;
  return lw.y < ls.y - 0.04 && rw.y < rs.y - 0.04;
}

function handPalm(hand: NormalizedLandmark[]): NormalizedLandmark {
  return hand[9] ?? hand[0];
}

function armsWrappingTorso(landmarks: NormalizedLandmark[], allowBackWrap = false): boolean {
  if (landmarks.length < 25) return false;

  const ls = landmarks[POSE.lShoulder];
  const rs = landmarks[POSE.rShoulder];
  const le = landmarks[POSE.lElbow];
  const re = landmarks[POSE.rElbow];
  const lw = landmarks[POSE.lWrist];
  const rw = landmarks[POSE.rWrist];
  const lh = landmarks[POSE.lHip];
  const rh = landmarks[POSE.rHip];

  if (
    !allVisible(
      landmarks,
      [POSE.lShoulder, POSE.rShoulder, POSE.lElbow, POSE.rElbow, POSE.lWrist, POSE.rWrist, POSE.lHip, POSE.rHip],
      HUG_MIN_VIS,
    )
  ) {
    return false;
  }

  const shoulderMid = mid(ls, rs);
  const hipMid = mid(lh, rh);
  const torsoWidth = dist(ls, rs);

  const elbowsBent =
    dist(lw, le) < dist(le, ls) * 1.25 && dist(rw, re) < dist(re, rs) * 1.25;

  if (isCelebratingPose(landmarks)) return false;

  const wristsInWrapZone =
    lw.y > ls.y - 0.05 &&
    lw.y < hipMid.y + 0.08 &&
    rw.y > rs.y - 0.05 &&
    rw.y < hipMid.y + 0.08;

  const wristsPulledIn =
    Math.abs(lw.x - shoulderMid.x) < torsoWidth * 0.72 &&
    Math.abs(rw.x - shoulderMid.x) < torsoWidth * 0.72;

  const wristsNearEachOther = dist(lw, rw) < Math.max(0.36, torsoWidth * 1.15);
  const armsCrossed =
    (lw.x > shoulderMid.x && rw.x < shoulderMid.x) ||
    (lw.x < shoulderMid.x && rw.x > shoulderMid.x);

  const wrapSignal = wristsNearEachOther || armsCrossed || allowBackWrap;
  return elbowsBent && wristsInWrapZone && wristsPulledIn && wrapSignal;
}

function armReachingTorso(
  pose: NormalizedLandmark[],
  targetTorsoMid: NormalizedLandmark,
  maxReach = 0.42,
): boolean {
  if (pose.length < 17) return false;

  const candidates = [POSE.lWrist, POSE.rWrist, POSE.lElbow, POSE.rElbow];
  return candidates.some((index) => visible(pose[index], HUG_MIN_VIS) && dist(pose[index], targetTorsoMid) < maxReach);
}

function armsReachHugMid(pose: NormalizedLandmark[], hugMid: NormalizedLandmark): boolean {
  if (pose.length < 17) return false;
  if (isCelebratingPose(pose)) return false;

  const lw = pose[POSE.lWrist];
  const rw = pose[POSE.rWrist];
  const le = pose[POSE.lElbow];
  const re = pose[POSE.rElbow];

  if (!visible(lw, HUG_MIN_VIS) && !visible(le, HUG_MIN_VIS)) return false;
  if (!visible(rw, HUG_MIN_VIS) && !visible(re, HUG_MIN_VIS)) return false;

  const leftReach =
    (visible(lw, HUG_MIN_VIS) && dist(lw, hugMid) < 0.4) ||
    (visible(le, HUG_MIN_VIS) && dist(le, hugMid) < 0.4);
  const rightReach =
    (visible(rw, HUG_MIN_VIS) && dist(rw, hugMid) < 0.4) ||
    (visible(re, HUG_MIN_VIS) && dist(re, hugMid) < 0.4);

  return leftReach && rightReach;
}

function mergedHugSilhouette(pose: NormalizedLandmark[]): boolean {
  if (pose.length < 25) return false;
  const ls = pose[POSE.lShoulder];
  const rs = pose[POSE.rShoulder];
  const lh = pose[POSE.lHip];
  const rh = pose[POSE.rHip];
  if (!visible(ls, HUG_MIN_VIS) || !visible(rs, HUG_MIN_VIS)) return false;

  const shoulderWidth = dist(ls, rs);
  const hipWidth = visible(lh, HUG_MIN_VIS) && visible(rh, HUG_MIN_VIS) ? dist(lh, rh) : shoulderWidth;
  return shoulderWidth > 0.3 && hipWidth > 0.26;
}

function playerLimbsReachPartner(
  pose: NormalizedLandmark[],
  hands: NormalizedLandmark[][],
  playerIndex: 0 | 1,
  partnerTorsoMid: NormalizedLandmark,
  bodyAnchors: [NormalizedLandmark, NormalizedLandmark],
): boolean {
  if (armReachingTorso(pose, partnerTorsoMid)) return true;

  const playerAnchor = bodyAnchors[playerIndex];
  const partnerAnchor = bodyAnchors[1 - playerIndex];
  const hugMid = mid(playerAnchor, partnerAnchor);

  for (const hand of hands) {
    const palm = handPalm(hand);
    const nearerPlayer = dist(palm, playerAnchor) <= dist(palm, partnerAnchor) + 0.08;
    if (!nearerPlayer) continue;
    if (dist(palm, partnerTorsoMid) < 0.44) return true;
    if (dist(palm, hugMid) < 0.34 && dist(palm, partnerTorsoMid) < 0.5) return true;
  }
  return false;
}

function handsAssistMergedHug(
  hands: NormalizedLandmark[][],
  hugMid: NormalizedLandmark,
): boolean {
  if (hands.length < 2) return false;
  const palms = hands.map(handPalm);
  const inZone = palms.filter(
    (palm) => dist(palm, hugMid) < 0.34 && palm.y > hugMid.y - 0.12 && palm.y < hugMid.y + 0.22,
  );
  return inZone.length >= 2;
}

export interface HugProgress {
  bodyCount: number;
  bodiesClose: boolean;
  leftArmAround: boolean;
  rightArmAround: boolean;
  detected: boolean;
}

export function evaluateHug(
  poses: NormalizedLandmark[][],
  handLandmarks: NormalizedLandmark[][] = [],
): HugProgress {
  const bodyCount = countBodiesInFrame(poses);
  const base: HugProgress = {
    bodyCount,
    bodiesClose: false,
    leftArmAround: false,
    rightArmAround: false,
    detected: false,
  };
  if (poses.length === 0) return base;

  const bodyAnchors = getBodyAnchors(poses);

  if (bodyCount < DUO_PLAYER_COUNT && poses.length >= 1 && mergedHugSilhouette(poses[0])) {
    const pose = poses[0];
    const torsoMid = mid(
      mid(pose[POSE.lShoulder], pose[POSE.rShoulder]),
      mid(pose[POSE.lHip], pose[POSE.rHip]),
    );
    const wrap = armsWrappingTorso(pose, true);
    const reach = armsReachHugMid(pose, torsoMid);
    const handsAssist = handsAssistMergedHug(handLandmarks, torsoMid);
    const leftArmAround = wrap || reach || handsAssist;
    return {
      bodyCount: 1,
      bodiesClose: true,
      leftArmAround,
      rightArmAround: leftArmAround,
      detected: leftArmAround,
    };
  }

  if (bodyCount < DUO_PLAYER_COUNT || !bodyAnchors) return base;

  const shoulderGap = dist(bodyAnchors[0], bodyAnchors[1]);
  const bodiesClose = shoulderGap < 0.42;
  if (!bodiesClose) return { ...base, bodiesClose: false };

  const pair = sortPosesByX(poses);
  if (pair.length < 2) return { ...base, bodiesClose: true };

  const [leftPerson, rightPerson] = pair;
  const lShoulderMid = mid(leftPerson[POSE.lShoulder], leftPerson[POSE.rShoulder]);
  const rShoulderMid = mid(rightPerson[POSE.lShoulder], rightPerson[POSE.rShoulder]);
  const lHipMid = mid(leftPerson[POSE.lHip], leftPerson[POSE.rHip]);
  const rHipMid = mid(rightPerson[POSE.lHip], rightPerson[POSE.rHip]);
  const lTorsoMid = mid(lShoulderMid, lHipMid);
  const rTorsoMid = mid(rShoulderMid, rHipMid);

  const anchors: [NormalizedLandmark, NormalizedLandmark] = [lShoulderMid, rShoulderMid];
  const leftArmAround = playerLimbsReachPartner(leftPerson, handLandmarks, 0, rTorsoMid, anchors);
  const rightArmAround = playerLimbsReachPartner(rightPerson, handLandmarks, 1, lTorsoMid, anchors);

  if (isCelebratingPose(leftPerson) && isCelebratingPose(rightPerson)) {
    return { bodyCount, bodiesClose: true, leftArmAround: false, rightArmAround: false, detected: false };
  }

  const hipGap = dist(lHipMid, rHipMid);
  const torsosOverlap = Math.abs(lShoulderMid.x - rShoulderMid.x) < 0.36;
  const closeEnough =
    (shoulderGap < 0.4 && hipGap < 0.46) || shoulderGap < 0.3 || torsosOverlap;

  return {
    bodyCount,
    bodiesClose: closeEnough,
    leftArmAround,
    rightArmAround,
    detected: closeEnough && leftArmAround && rightArmAround,
  };
}

/** Two people close together with arms wrapped — pose + hand limbs on partner torso. */
export function detectHug(
  poses: NormalizedLandmark[][],
  handLandmarks: NormalizedLandmark[][] = [],
): boolean {
  return evaluateHug(poses, handLandmarks).detected;
}

export function detectPoseKeys(
  poses: NormalizedLandmark[][],
  handLandmarks: NormalizedLandmark[][] = [],
): string[] {
  const keys: string[] = [];
  if (poses.length === 0) return keys;

  if (poses.some((p) => detectHseLift(p))) keys.push('hse_lift');
  if (poses.some((p) => detectMusclePose(p))) keys.push('muscle_pose');
  if (detectHseLiftDuo(poses)) keys.push('hse_lift_duo');
  if (detectHug(poses, handLandmarks)) keys.push('hug');

  return keys;
}
