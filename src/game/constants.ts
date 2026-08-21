import { assetUrl } from '@/lib/assetUrl';

export const GLB_MODEL_PATH = assetUrl('assets/models/slb-style-oil-rig.glb');

/** Nudge loaded GLB in scene space (x, y, z). */
export const MODEL_POSITION_OFFSET: [number, number, number] = [0, -30, 0];

/** Apply model translation to a world-space point tuned before the offset existed. */
export function applyModelOffset(point: [number, number, number]): [number, number, number] {
  return [
    point[0] + MODEL_POSITION_OFFSET[0],
    point[1] + MODEL_POSITION_OFFSET[1],
    point[2] + MODEL_POSITION_OFFSET[2],
  ];
}

export const LEVEL_DEV_KEY = 'slb100_level_dev_v1';
export const PIN_KEY = 'slb100_pin_views_v1';

/** >1 shrinks that level's paint zone (weighted Voronoi). Lv2 yellow was too large. */
export const LEVEL_ZONE_WEIGHT = [0.9, 1.7, 0.92, 0.88] as const;

/** Default palette — matches single-mode levels.json order (Lv1→Lv4). */
export const LEVEL_COLORS = ['#e0b4ff', '#ffe66d', '#ff8fab', '#7eedd0'] as const;

export const LEVEL_LABELS = ['Lv1', 'Lv2', 'Lv3', 'Lv4'] as const;

export interface LevelRouteEntry {
  id: number;
  label: string;
  pos: [number, number, number];
  cam?: [number, number, number];
  tgt?: [number, number, number];
}

/** Marker positions only — flyToLevel computes cam/tgt on the fly from pos + model bounds. */
export const LEVEL_ROUTE: LevelRouteEntry[] = [
  { id: 1, label: 'Lv1', pos: [-26.9801, 40.2545, 29.6439] },
  { id: 2, label: 'Lv2', pos: [26.267, 40.461, 27.9426] },
  { id: 3, label: 'Lv3', pos: [36.6832, 50.1085, -38.2626] },
  { id: 4, label: 'Lv4', pos: [-34.4756, 44.1978, -47.2318] },
];

/** Hardcoded P1 — user's initial view (set 2026-08-19, from slb100_camera_v1) */
export const P1_CAM: [number, number, number] = [-126.8369, 122.6431, 104.4347];
export const P1_TGT: [number, number, number] = [-26.9801, 54.0251, 29.6439];

export function isDevMode(): boolean {
  return new URLSearchParams(location.search).has('dev') || location.hash === '#dev';
}
