/** Keep recently seen gesture keys alive briefly to avoid choppy hold detection. */
export class DetectedKeysHold {
  private expiry = new Map<string, number>();
  private readonly graceMs: number;

  constructor(graceMs = 480) {
    this.graceMs = graceMs;
  }

  update(rawKeys: string[], now: number): string[] {
    for (const key of rawKeys) {
      this.expiry.set(key, now + this.graceMs);
    }

    const held: string[] = [];
    for (const [key, until] of this.expiry) {
      if (until >= now) held.push(key);
      else this.expiry.delete(key);
    }

    return held.length ? held : rawKeys;
  }

  reset(): void {
    this.expiry.clear();
  }
}
