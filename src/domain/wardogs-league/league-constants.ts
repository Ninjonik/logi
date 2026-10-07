/**
 * The League reader's constants, apart from the Zod contracts so the panel
 * reads that only project stored snapshots never load Zod (`contracts.ts`
 * re-exports them).
 */
export const PARSER_VERSION = "wardogs-league-html/1"
export const CACHE_MS = 5 * 60_000
export const LEASE_MS = 25_000
export const MAX_RETRY_AFTER_MS = 24 * 60 * 60_000
