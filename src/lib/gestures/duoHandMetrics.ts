import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { isHandCircle, isThumbUp } from '@/lib/gestures/handDetection';
import {
  DUO_CIRCLES_PER_PLAYER,
  DUO_PLAYER_COUNT,
  DUO_THUMBS_PER_PLAYER,
  DUO_TOTAL_CIRCLES,
  DUO_TOTAL_THUMBS,
} from '@/lib/gestures/duoConstants';
import { countHandsPerPlayer, countBodiesInFrame, countPlayersInFrame } from '@/lib/gestures/playerTracking';
import { evaluateHug } from '@/lib/gestures/poseDetection';

export interface DuoHandMetrics {
  playerCount: number;
  poseTrackCount: number;
  faceCount: number;
  bodyCount: number;
  hugBodiesClose: boolean;
  hugLeftArm: boolean;
  hugRightArm: boolean;
  thumbUpTotal: number;
  thumbUpByPlayer: [number, number];
  circleTotal: number;
  circleByPlayer: [number, number];
}

export function computeDuoHandMetrics(
  handLandmarks: NormalizedLandmark[][],
  poseLandmarks: NormalizedLandmark[][],
  faceLandmarks: NormalizedLandmark[][] = [],
): DuoHandMetrics {
  const thumbHands = handLandmarks.filter((lm) => isThumbUp(lm));
  const circleHands = handLandmarks.filter((lm) => isHandCircle(lm));
  const hug = evaluateHug(poseLandmarks, handLandmarks);

  return {
    playerCount: countPlayersInFrame(poseLandmarks, faceLandmarks),
    poseTrackCount: poseLandmarks.length,
    faceCount: faceLandmarks.length,
    bodyCount: countBodiesInFrame(poseLandmarks),
    hugBodiesClose: hug.bodiesClose,
    hugLeftArm: hug.leftArmAround,
    hugRightArm: hug.rightArmAround,
    thumbUpTotal: thumbHands.length,
    thumbUpByPlayer: countHandsPerPlayer(thumbHands, poseLandmarks, faceLandmarks, {
      maxPerPlayer: DUO_THUMBS_PER_PLAYER,
    }),
    circleTotal: circleHands.length,
    circleByPlayer: countHandsPerPlayer(circleHands, poseLandmarks, faceLandmarks, {
      maxPerPlayer: DUO_CIRCLES_PER_PLAYER,
    }),
  };
}

export interface DuoChecklistItem {
  id: string;
  met: boolean;
}

export function buildDuoChecklist(
  gestureKey: string,
  metrics: DuoHandMetrics,
): DuoChecklistItem[] {
  const layout = buildDuoChecklistLayout(gestureKey, metrics);
  return [...layout.shared, ...layout.left, ...layout.right];
}

export interface DuoChecklistLayout {
  shared: DuoChecklistItem[];
  left: DuoChecklistItem[];
  right: DuoChecklistItem[];
}

export function buildDuoChecklistLayout(
  gestureKey: string,
  metrics: DuoHandMetrics,
): DuoChecklistLayout {
  if (gestureKey === 'double_thumb_up_duo') {
    return {
      shared: [
        { id: 'bodies', met: metrics.playerCount >= DUO_PLAYER_COUNT },
        { id: 'thumbsTotal', met: metrics.thumbUpTotal >= DUO_TOTAL_THUMBS },
      ],
      left: [{ id: 'leftThumbs', met: metrics.thumbUpByPlayer[0] >= DUO_THUMBS_PER_PLAYER }],
      right: [{ id: 'rightThumbs', met: metrics.thumbUpByPlayer[1] >= DUO_THUMBS_PER_PLAYER }],
    };
  }

  if (gestureKey === 'infinity_symbol') {
    return {
      shared: [
        { id: 'bodies', met: metrics.playerCount >= DUO_PLAYER_COUNT },
        { id: 'circlesTotal', met: metrics.circleTotal >= DUO_TOTAL_CIRCLES },
      ],
      left: [{ id: 'leftCircle', met: metrics.circleByPlayer[0] >= DUO_CIRCLES_PER_PLAYER }],
      right: [{ id: 'rightCircle', met: metrics.circleByPlayer[1] >= DUO_CIRCLES_PER_PLAYER }],
    };
  }

  if (gestureKey === 'hug') {
    const bodiesInFrame =
      metrics.playerCount >= DUO_PLAYER_COUNT ||
      metrics.bodyCount >= DUO_PLAYER_COUNT ||
      (metrics.bodyCount === 1 && metrics.hugBodiesClose);
    return {
      shared: [
        { id: 'bodies', met: bodiesInFrame },
        { id: 'hugClose', met: metrics.hugBodiesClose },
      ],
      left: [{ id: 'hugLeftArm', met: metrics.hugLeftArm }],
      right: [{ id: 'hugRightArm', met: metrics.hugRightArm }],
    };
  }

  return { shared: [], left: [], right: [] };
}

export function duoChecklistComplete(gestureKey: string, metrics: DuoHandMetrics): boolean {
  const items = buildDuoChecklist(gestureKey, metrics);
  return items.length > 0 && items.every((item) => item.met);
}
