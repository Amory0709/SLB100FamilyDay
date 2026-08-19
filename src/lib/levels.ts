import type { GameMode, LevelsConfig } from '@/types/levels';

const LEVELS_URL = '/assets/config/levels.json';

let cached: LevelsConfig | null = null;

export async function loadLevelsConfig(): Promise<LevelsConfig | null> {
  if (cached) return cached;
  try {
    const res = await fetch(LEVELS_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cached = (await res.json()) as LevelsConfig;
    return cached;
  } catch (err) {
    console.warn('Failed to load levels.json:', err);
    return null;
  }
}

export function getModeConfig(config: LevelsConfig | null, mode: GameMode | null) {
  if (!config || !mode) return null;
  return config.modes[mode] ?? null;
}

export function getLevelConfig(
  config: LevelsConfig | null,
  mode: GameMode | null,
  levelId: number,
) {
  const modeCfg = getModeConfig(config, mode);
  return modeCfg?.levels.find((l) => l.id === levelId) ?? null;
}
