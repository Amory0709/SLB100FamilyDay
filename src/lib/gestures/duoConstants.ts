/** Couple mode always expects two players in frame. */
export const DUO_PLAYER_COUNT = 2;

/** PoseLandmarker numPoses — model may still return one track; see poseRegionDetection. */
export const POSE_LANDMARKER_NUM_POSES = DUO_PLAYER_COUNT;

/** Level 1: each player shows both hands thumbs up. */
export const DUO_THUMBS_PER_PLAYER = 2;

/** Level 2: each player shows one circle hand. */
export const DUO_CIRCLES_PER_PLAYER = 1;

export const DUO_TOTAL_THUMBS = DUO_PLAYER_COUNT * DUO_THUMBS_PER_PLAYER;
export const DUO_TOTAL_CIRCLES = DUO_PLAYER_COUNT * DUO_CIRCLES_PER_PLAYER;
