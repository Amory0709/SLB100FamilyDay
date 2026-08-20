import type { Classifications } from '@mediapipe/tasks-vision';

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export interface FaceBlendshapeSmootherOptions {
  /** Max score jump per frame before clamping. Default 0.12 */
  maxDelta?: number;
  /** EMA alpha when face is still. Default 0.28 */
  alphaMin?: number;
  /** EMA alpha when face is moving fast. Default 0.72 */
  alphaMax?: number;
  /** Average score delta per category that reaches max alpha. Default 0.018 */
  speedForMaxAlpha?: number;
}

export const DEFAULT_FACE_BLENDSHAPE_SMOOTHER_OPTIONS: Required<FaceBlendshapeSmootherOptions> = {
  maxDelta: 0.12,
  alphaMin: 0.28,
  alphaMax: 0.72,
  speedForMaxAlpha: 0.018,
};

class FaceBlendshapeStabilizer {
  private readonly options: Required<FaceBlendshapeSmootherOptions>;
  private prevScores: Map<string, number> | null = null;

  constructor(options: Required<FaceBlendshapeSmootherOptions>) {
    this.options = options;
  }

  smooth(classification: Classifications): Classifications {
    const categories = classification.categories ?? [];
    if (categories.length === 0) return classification;

    const rawScores = new Map(categories.map((c) => [c.categoryName, c.score]));
    const motion = this.measureMotion(rawScores);
    const moveFactor = Math.min(1, motion / this.options.speedForMaxAlpha);
    const alpha = lerp(this.options.alphaMin, this.options.alphaMax, moveFactor);
    const maxDelta = lerp(this.options.maxDelta * 0.55, this.options.maxDelta, moveFactor);

    const prev = this.prevScores;
    const nextScores = new Map<string, number>();

    for (const [name, raw] of rawScores) {
      const previous = prev?.get(name);
      if (previous === undefined) {
        nextScores.set(name, raw);
        continue;
      }

      const delta = raw - previous;
      const clamped =
        Math.abs(delta) <= maxDelta ? raw : previous + Math.sign(delta) * maxDelta;
      nextScores.set(name, lerp(previous, clamped, alpha));
    }

    this.prevScores = nextScores;

    return {
      ...classification,
      categories: categories.map((category) => ({
        ...category,
        score: nextScores.get(category.categoryName) ?? category.score,
      })),
    };
  }

  reset(): void {
    this.prevScores = null;
  }

  private measureMotion(rawScores: Map<string, number>): number {
    const prev = this.prevScores;
    if (!prev) return 0;

    let total = 0;
    let count = 0;
    for (const [name, score] of rawScores) {
      const previous = prev.get(name);
      if (previous === undefined) continue;
      total += Math.abs(score - previous);
      count += 1;
    }

    return count > 0 ? total / count : 0;
  }
}

export class MultiFaceBlendshapeSmoother {
  private readonly options: Required<FaceBlendshapeSmootherOptions>;
  private faces: FaceBlendshapeStabilizer[] = [];

  constructor(options: FaceBlendshapeSmootherOptions = {}) {
    this.options = { ...DEFAULT_FACE_BLENDSHAPE_SMOOTHER_OPTIONS, ...options };
  }

  smooth(
    allBlendshapes: Classifications[] | undefined,
    _tMs: number,
  ): Classifications[] | undefined {
    if (!allBlendshapes?.length) {
      this.reset();
      return undefined;
    }

    const count = allBlendshapes.length;
    while (this.faces.length < count) {
      this.faces.push(new FaceBlendshapeStabilizer(this.options));
    }
    if (this.faces.length > count) {
      this.faces.splice(count).forEach((face) => face.reset());
    }

    return allBlendshapes.map((blendshapes, i) => this.faces[i].smooth(blendshapes));
  }

  reset(): void {
    this.faces.forEach((face) => face.reset());
    this.faces = [];
  }
}
