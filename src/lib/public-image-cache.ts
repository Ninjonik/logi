import { createRosterImageCache } from "@/lib/roster-image-cache";

// Public previews are requested repeatedly by Discord, crawlers, and browser
// prefetching. Keeping a small per-process LRU avoids rerendering their PNG.
export const publicImageCache = createRosterImageCache(48);
