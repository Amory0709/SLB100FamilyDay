import type { Classifications } from '@mediapipe/tasks-vision';

const SMILE_BLENDSHAPES = ['mouthSmileLeft', 'mouthSmileRight'] as const;
const SMILE_THRESHOLD = 0.45;

export function detectSmile(blendshapes: Classifications[] | undefined): boolean {
  const categories = blendshapes?.[0]?.categories;
  if (!categories?.length) return false;

  const scores = new Map(categories.map((c) => [c.categoryName, c.score]));
  return SMILE_BLENDSHAPES.every((name) => (scores.get(name) ?? 0) >= SMILE_THRESHOLD);
}

export function detectFaceKeys(blendshapes: Classifications[] | undefined): string[] {
  if (detectSmile(blendshapes)) return ['smile'];
  return [];
}
