import type { ApplicationState } from "./membership-application-store"

/**
 * Discord gives a button three seconds to answer, and opening a window is
 * that answer, so it must not wait on a Convex round trip (lead decision 7).
 * The bot keeps every clan's application definition (switches, channels,
 * form, categories, language) live from a Convex subscription, which also
 * delivers settings changes within seconds, and remembers each applicant's
 * own state (draft, verified Steam, found players) from the last read or
 * save, refreshed in the background. "Podat přihlášku", "Pokračovat" and
 * "Upravit" then call `showModal` straight away.
 */

type ApplicantPart =
    | "openApplication"
    | "assignedGames"
    | "draft"
    | "verifiedSteamId"
    | "previousPlayers"
    | "linkedPlatformIds"

/** The clan's part of the state: the same for every applicant. */
export type ApplicationDefinition = Omit<ApplicationState, ApplicantPart>

/** The applicant's own part of the state. */
export type ApplicantState = Pick<ApplicationState, ApplicantPart>

/** Where the definitions come from (Convex in production). */
export type ApplicationDefinitionSource = {
    /** Subscribes to every clan's definition; returns the unsubscribe. */
    watch(onRows: (rows: unknown) => void): () => void
}

/** How long an applicant's remembered state is trusted to open a window. */
export const APPLICANT_STATE_TTL_MS = 30 * 60 * 1000

const APPLICANT_KEYS: readonly ApplicantPart[] = [
    "openApplication",
    "assignedGames",
    "draft",
    "verifiedSteamId",
    "previousPlayers",
    "linkedPlatformIds",
]

/** The clan's part of a state or row: never an applicant's draft or accounts. */
function clanPart(value: Record<string, unknown>) {
    return Object.fromEntries(
        Object.entries(value).filter(
            ([key]) => !APPLICANT_KEYS.includes(key as ApplicantPart)
        )
    ) as ApplicationDefinition
}

function isDefinitionRow(
    row: unknown
): row is ApplicationDefinition & { guildId: string } {
    if (!row || typeof row !== "object") return false
    const value = row as Record<string, unknown>
    return (
        typeof value.guildId === "string" &&
        typeof value.enabled === "boolean" &&
        typeof value.language === "string" &&
        Boolean(value.form) &&
        Array.isArray(value.categories)
    )
}

export class ApplicationStateCache {
    private definitions = new Map<string, ApplicationDefinition>()
    private applicants = new Map<
        string,
        { state: ApplicantState; at: number }
    >()
    private unsubscribe?: () => void

    constructor(private readonly now: () => number = Date.now) {}

    /** Follows every clan's definition: in the background and on every settings change. */
    start(source: ApplicationDefinitionSource) {
        this.unsubscribe?.()
        this.unsubscribe = source.watch((rows) => this.applyDefinitions(rows))
    }

    stop() {
        this.unsubscribe?.()
        this.unsubscribe = undefined
    }

    /** Replaces the known definitions with a fresh list from Convex. */
    applyDefinitions(rows: unknown) {
        if (!Array.isArray(rows)) return
        const next = new Map<string, ApplicationDefinition>()
        for (const row of rows) {
            if (!isDefinitionRow(row)) continue
            const { guildId, ...rest } = row
            next.set(guildId, clanPart(rest))
        }
        this.definitions = next
    }

    /** The clan's definition without a backend read. */
    definition(guildId: string) {
        return this.definitions.get(guildId)
    }

    /** Remembers a state the bot just read; the clan part refreshes the definition too. */
    remember(guildId: string, userId: string, state: ApplicationState | null) {
        if (!state) {
            this.definitions.delete(guildId)
            this.applicants.delete(`${guildId}:${userId}`)
            return
        }
        const applicant = Object.fromEntries(
            APPLICANT_KEYS.map((key) => [key, state[key]])
        ) as ApplicantState
        this.definitions.set(guildId, clanPart(state))
        this.setApplicant(guildId, userId, applicant)
    }

    /** Changes part of an applicant's remembered state (after a submit or a cancel). */
    update(guildId: string, userId: string, patch: Partial<ApplicantState>) {
        const known = this.applicant(guildId, userId)
        if (known) this.setApplicant(guildId, userId, { ...known, ...patch })
    }

    forget(guildId: string, userId: string) {
        this.applicants.delete(`${guildId}:${userId}`)
    }

    /** The applicant's recent state, or undefined when unknown or too old. */
    applicant(guildId: string, userId: string) {
        const entry = this.applicants.get(`${guildId}:${userId}`)
        if (!entry || this.now() - entry.at > APPLICANT_STATE_TTL_MS)
            return undefined
        return entry.state
    }

    /**
     * The full state to open a window with, without a backend read: the live
     * definition with the applicant's remembered state, or with an empty one
     * (`known: false`) for an applicant this bot has not seen yet.
     */
    peek(
        guildId: string,
        userId: string
    ): { state: ApplicationState; known: boolean } | undefined {
        const definition = this.definitions.get(guildId)
        if (!definition) return undefined
        const applicant = this.applicant(guildId, userId)
        return {
            state: {
                openApplication: null,
                assignedGames: [],
                draft: null,
                verifiedSteamId: null,
                previousPlayers: [],
                linkedPlatformIds: [],
                ...applicant,
                ...definition,
            },
            known: Boolean(applicant),
        }
    }

    /** Clears everything (tests). */
    reset() {
        this.definitions.clear()
        this.applicants.clear()
    }

    private setApplicant(
        guildId: string,
        userId: string,
        state: ApplicantState
    ) {
        const at = this.now()
        // Old entries go, so the map stays small.
        for (const [key, entry] of this.applicants)
            if (at - entry.at > APPLICANT_STATE_TTL_MS)
                this.applicants.delete(key)
        this.applicants.set(`${guildId}:${userId}`, { state, at })
    }
}

/** The bot's one cache, started on ClientReady (`index.ts`). */
export const applicationStateCache = new ApplicationStateCache()
