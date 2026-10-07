/**
 * The closed vocabularies of game-data rows, as plain lists with type guards.
 * `contracts.ts` builds its Zod enums from them; readers of schema-validated
 * rows narrow with the guards and never load Zod (ARCHITECTURE.md, "Convex
 * hot paths").
 */
export const DATA_GAMES = ["hell_let_loose", "wardogs"] as const
export type DataGame = (typeof DATA_GAMES)[number]
export const DATA_PROVIDERS = [
    "hll_crcon",
    "wardogs_rcon",
    "wardogs_warcon",
    "wardogs_public_directory",
] as const
export type DataProviderId = (typeof DATA_PROVIDERS)[number]
export const DATA_CAPABILITIES = ["server_snapshot", "match_history"] as const
export type DataCapability = (typeof DATA_CAPABILITIES)[number]
export const ERROR_CATEGORIES = [
    "timeout",
    "network",
    "rate_limited",
    "unauthorized",
    "invalid_response",
    "unsupported",
    "configuration",
    "not_listed",
] as const
export type ErrorCategoryId = (typeof ERROR_CATEGORIES)[number]
export const OBSERVED_STATES = ["online", "offline", "unknown"] as const
export type ObservedState = (typeof OBSERVED_STATES)[number]

export function isDataGame(value: unknown): value is DataGame {
    return (DATA_GAMES as readonly unknown[]).includes(value)
}
export function isDataProvider(value: unknown): value is DataProviderId {
    return (DATA_PROVIDERS as readonly unknown[]).includes(value)
}
export function isErrorCategory(value: unknown): value is ErrorCategoryId {
    return (ERROR_CATEGORIES as readonly unknown[]).includes(value)
}
export function isObservedState(value: unknown): value is ObservedState {
    return (OBSERVED_STATES as readonly unknown[]).includes(value)
}
