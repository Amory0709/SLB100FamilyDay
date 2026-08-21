import type {
  GameMode,
  LevelConfig,
  LevelConfigRaw,
  LevelsConfig,
  LevelsConfigRaw,
  ModeConfig,
  ModeConfigRaw,
} from '@/types/levels';
import type { Language } from '@/i18n/types';
import { resolveLocalized } from '@/i18n/resolveLocalized';
import { assetUrl } from '@/lib/assetUrl';

const LEVELS_URL = assetUrl('assets/config/levels.json');

let cached: LevelsConfigRaw | null = null;

export async function loadLevelsConfig(): Promise<LevelsConfigRaw | null> {
  if (cached) return cached;
  try {
    const res = await fetch(LEVELS_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cached = (await res.json()) as LevelsConfigRaw;
    return cached;
  } catch (err) {
    console.warn('Failed to load levels.json:', err);
    return null;
  }
}

export function resolveLevelsConfig(config: LevelsConfigRaw, language: Language): LevelsConfig {
  return {
    version: config.version,
    modes: {
      single: resolveModeConfig(config.modes.single, language),
      couple: resolveModeConfig(config.modes.couple, language),
    },
  };
}

function resolveModeConfig(mode: ModeConfigRaw, language: Language): ModeConfig {
  return {
    name: resolveLocalized(mode.name, language),
    intro: resolveLocalized(mode.intro, language),
    outro: resolveLocalized(mode.outro, language),
    levels: mode.levels.map((level) => resolveLevelConfig(level, language)),
  };
}

function resolveLevelConfig(level: LevelConfigRaw, language: Language): LevelConfig {
  return {
    ...level,
    title: resolveLocalized(level.title, language),
    intro: resolveLocalized(level.intro, language),
    task: resolveLocalized(level.task, language),
    reward: level.reward ? resolveLocalized(level.reward, language) : undefined,
    gestures: level.gestures.map((gesture) => ({
      ...gesture,
      word: resolveLocalized(gesture.word, language),
      hint: gesture.hint ? resolveLocalized(gesture.hint, language) : undefined,
    })),
  };
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

export function getModeLevelColorList(levels: LevelConfig[]): string[] {
  return levels.map((level) => level.color ?? '#0014c8');
}

export function getModeLevelColors(levels: LevelConfig[]): string[] {
  const colors = getModeLevelColorList(levels).filter((color) => color !== '#0014c8');
  return colors.length > 0 ? [...new Set(colors)] : ['#0014c8'];
}
