/** Require the same gesture across recent frames before accepting a change. */
export class GestureKeyStabilizer {
  private readonly windowSize: number;
  private readonly minVotes: number;
  private history: Array<string | null> = [];
  private stableKey: string | null = null;

  constructor(windowSize = 5, minVotes = 3) {
    this.windowSize = windowSize;
    this.minVotes = minVotes;
  }

  update(rawKey: string | null): string | null {
    this.history.push(rawKey);
    if (this.history.length > this.windowSize) {
      this.history.shift();
    }

    if (
      this.stableKey !== null &&
      countMatches(this.history, this.stableKey) >= this.minVotes - 1
    ) {
      return this.stableKey;
    }

    const candidate = pickStableGestureKey(this.history, this.minVotes);
    if (candidate !== null) {
      this.stableKey = candidate;
      return candidate;
    }

    if (rawKey === null) {
      this.stableKey = null;
    }

    return this.stableKey;
  }

  reset(): void {
    this.history = [];
    this.stableKey = null;
  }
}

function countMatches(history: Array<string | null>, key: string): number {
  return history.filter((entry) => entry === key).length;
}

function pickStableGestureKey(history: Array<string | null>, minVotes: number): string | null {
  const counts = new Map<string, number>();
  for (const key of history) {
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  let bestKey: string | null = null;
  let bestCount = 0;
  for (const [key, count] of counts) {
    if (count >= minVotes && count > bestCount) {
      bestKey = key;
      bestCount = count;
    }
  }
  return bestKey;
}
