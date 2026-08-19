export const GLB_MODEL_PATH = '/assets/models/slb-style-oil-rig.glb';

export const LEVEL_DEV_KEY = 'slb100_level_dev_v1';
export const LEVEL_PROGRESS_KEY = 'slb100_level_progress_v1';
export const CAM_KEY = 'slb100_camera_v1';
export const PIN_KEY = 'slb100_pin_views_v1';

/** >1 shrinks that level's paint zone (weighted Voronoi). Lv2 yellow was too large. */
export const LEVEL_ZONE_WEIGHT = [0.9, 1.7, 0.92, 0.88] as const;

export const LEVEL_COLORS = ['#7eedd0', '#ffe66d', '#ff8fab', '#e0b4ff'] as const;

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

/** Hardcoded P1 — user's initial view (set 2026-07-28) */
export const P1_CAM: [number, number, number] = [-149.21, 147.49, 155.24];
export const P1_TGT: [number, number, number] = [128.93, -14.5, -43.0];

export function isDevMode(): boolean {
  return new URLSearchParams(location.search).has('dev') || location.hash === '#dev';
}
