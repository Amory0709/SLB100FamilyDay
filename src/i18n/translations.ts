import type { Language } from '@/i18n/types';

const en = {
  welcomeTitle: 'Welcome to Family Day',
  selectMode: 'Please select your mode',
  singleMode: 'Single Mode',
  coupleMode: 'Couple Mode',
  loading: 'Loading…',
  loadingProgress: (bytes: string) => `Loading… ${bytes}`,
  ready: 'Ready',
  loadingGestureModel: 'Loading vision models…',
  gestureUnavailable: 'Gesture unavailable',
  failedLoadModel: 'Failed to load 3D model',
  failedLoadLevels: 'Please open this page through the dev server.',
  viewportHint: 'drag to orbit · scroll to zoom',
  startTask: 'Start task →',
  skipLevel: 'Skip level',
  levelComplete: 'Complete!',
  defaultReward: 'Level unlocked!',
  allComplete: 'All complete ✓',
  nextLevel: 'Next level →',
  replayLevel: 'Replay level',
  allLevelsComplete: 'All levels complete!',
  restart: '↻ Restart',
  returnMainMenu: 'Return to main menu',
  currentTask: 'Current task',
  loadingModel: 'Loading model…',
  startingCamera: 'Starting camera…',
  retryCamera: 'Retry camera',
  recognizing: (gesture: string) => `Detected: ${gesture}`,
  waitingGesture: 'Waiting for gesture…',
  recognitionUnavailable: 'Recognition unavailable',
  gestureSequenceHint: 'Hold the pose for 1 second. Stand back so the camera sees your full body.',
  noGesturesConfigured: 'No gestures configured — tap "I\'m Done" to finish',
  imDone: 'I\'m Done ✓',
  recognitionComplete: 'Recognition complete ✓',
  cameraDenied: 'Camera permission denied. Allow access in browser settings.',
  cameraTimeout: 'Camera timed out. Close other apps using the camera, then retry.',
  gestureBootFailed: 'Failed to start gesture recognition',
  switchLanguage: 'Switch language',
} as const;

const zh = {
  welcomeTitle: '欢迎来到 Family Day',
  selectMode: '请选择你的模式',
  singleMode: '单人模式',
  coupleMode: '双人模式',
  loading: '加载中…',
  loadingProgress: (bytes: string) => `加载中… ${bytes}`,
  ready: '就绪',
  loadingGestureModel: '加载视觉模型…',
  gestureUnavailable: '手势不可用',
  failedLoadModel: '3D 模型加载失败',
  failedLoadLevels: '关卡配置加载失败，请通过 dev server 打开页面。',
  viewportHint: '拖动旋转 · 滚轮缩放',
  startTask: '开始任务 →',
  skipLevel: '跳过本关',
  levelComplete: '完成!',
  defaultReward: '恭喜解锁本关!',
  allComplete: '完成全部 ✓',
  nextLevel: '下一关 →',
  replayLevel: '重玩本关',
  allLevelsComplete: '完成全部关卡!',
  restart: '↻ 重新开始',
  returnMainMenu: '回到主菜单',
  currentTask: '当前任务',
  loadingModel: '加载模型…',
  startingCamera: '启动摄像头…',
  retryCamera: '重试摄像头',
  recognizing: (gesture: string) => `识别: ${gesture}`,
  waitingGesture: '等待手势…',
  recognitionUnavailable: '识别不可用',
  gestureSequenceHint: '保持姿势 1 秒。请后退,让摄像头看清全身。',
  noGesturesConfigured: '本关没有配置手势 — 直接点击「我完成了」即可',
  imDone: '我完成了 ✓',
  recognitionComplete: '识别完成 ✓',
  cameraDenied: '摄像头权限被拒绝，请在浏览器设置中允许访问。',
  cameraTimeout: '摄像头启动超时。请关闭占用摄像头的应用后重试。',
  gestureBootFailed: '手势识别启动失败',
  switchLanguage: '切换语言',
} as const;

export type TranslationKey = keyof typeof en;

export const translations = { en, zh } as const;

export function translate(lang: Language, key: TranslationKey, ...args: unknown[]): string {
  const value = translations[lang][key];
  if (typeof value === 'function') {
    return (value as (...params: unknown[]) => string)(...args);
  }
  return value;
}
