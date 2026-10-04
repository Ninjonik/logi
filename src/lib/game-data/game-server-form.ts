import {
    connectionTestOutcomeSchema,
    credentialRequirement,
    sourceCommandErrorSchema,
    type ConnectionTestOutcome,
    type DataProvider,
    type SourceCommandError,
} from "@/domain/game-data/credentials"
import { z } from "zod"

export type GameId = "hell_let_loose" | "wardogs"
/** Providers a workspace can connect for each game, most common first. */
export const PROVIDERS_BY_GAME: Record<GameId, readonly DataProvider[]> = {
    hell_let_loose: ["hll_crcon"],
    wardogs: ["wardogs_warcon", "wardogs_rcon", "wardogs_public_directory"],
}
export const PUBLIC_DIRECTORY_ORIGIN = "https://api.wardogservers.com"

/** Whether the add form shows a key field, and whether it must be filled. */
export function keyField(
    provider: DataProvider
): "required" | "optional" | "hidden" {
    const requirement = credentialRequirement(provider)
    return requirement === "forbidden" ? "hidden" : requirement
}

/** Fills `{name}` placeholders; unknown placeholders stay visible. */
export function fill(
    template: string,
    values: Record<string, string | number>
) {
    return template.replace(/\{(\w+)\}/g, (match, key: string) =>
        key in values ? String(values[key]) : match
    )
}

const testSchema = z.object({
    outcome: connectionTestOutcomeSchema,
    retryAfterMs: z.number().nonnegative().optional(),
})
const responseSchema = z.object({
    ok: z.literal(true).optional(),
    enabled: z.boolean().optional(),
    error: z.string().optional(),
    retryAfterMs: z.number().nonnegative().optional(),
    outcome: connectionTestOutcomeSchema.optional(),
    test: testSchema.optional(),
})
export type CommandResult = {
    ok: boolean
    enabled: boolean | null
    error: SourceCommandError | null
    retryAfterSeconds: number | null
    test: ConnectionTestOutcome | null
}

/** Reads a command response without trusting its shape; unknown codes become `unavailable`. */
export function readCommandResult(
    status: number,
    body: unknown
): CommandResult {
    const parsed = responseSchema.safeParse(body)
    const value = parsed.success ? parsed.data : {}
    const error =
        status >= 400 || value.error !== undefined
            ? (sourceCommandErrorSchema.safeParse(value.error).data ??
              "unavailable")
            : null
    const retry = value.retryAfterMs ?? value.test?.retryAfterMs
    return {
        ok: error === null,
        enabled: value.enabled ?? null,
        error,
        retryAfterSeconds:
            retry === undefined ? null : Math.max(1, Math.ceil(retry / 1000)),
        test: value.test?.outcome ?? value.outcome ?? null,
    }
}
