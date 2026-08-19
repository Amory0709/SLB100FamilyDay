export type GameMode = 'single' | 'couple';

export type CompletionType = 'manual' | 'gesture';

export interface LevelGesture {
  word: string;
  gestureKey?: string;
  hint?: string;
}

export interface LevelConfig {
  id: number;
  title: string;
  intro: string;
  task: string;
  taskIcon?: string;
  completionType: CompletionType;
  gestures: LevelGesture[];
  reward?: string;
  color?: string;
}

export interface ModeConfig {
  name: string;
  intro: string;
  outro: string;
  levels: LevelConfig[];
}

export interface LevelsConfig {
  version: number;
  modes: Record<GameMode, ModeConfig>;
}

export type LevelFlowState = 'idle' | 'intro' | 'task' | 'won' | 'outro';
