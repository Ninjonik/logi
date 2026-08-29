export type RosterImageCache = {
  get(key: string): Uint8Array | undefined;
  set(key: string, image: Uint8Array): void;
};

export function createRosterImageCache(maxEntries: number): RosterImageCache {
  const entries = new Map<string, Uint8Array>();

  return {
    get(key) {
      const image = entries.get(key);
      if (!image) return undefined;

      // Move the image to the end so insertion order remains least-recently-used.
      entries.delete(key);
      entries.set(key, image);
      return image.slice();
    },
    set(key, image) {
      entries.delete(key);
      entries.set(key, image.slice());

      while (entries.size > maxEntries) {
        const oldestKey = entries.keys().next().value;
        if (!oldestKey) break;
        entries.delete(oldestKey);
      }
    },
  };
}

// A single Next.js server process renders and serves both the warm request and
// Discord's follow-up request. Versioned keys make stale images unreachable;
// the small LRU cap prevents old roster versions accumulating indefinitely.
export const rosterImageCache = createRosterImageCache(24);
