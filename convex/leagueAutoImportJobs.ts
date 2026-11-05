"use node"
import {
    parseKeyring,
    encryptCredential,
    decryptCredential,
} from "../src/infrastructure/game-data/credential-cipher"
import {
    credentialEnvelopeSchema,
    providerKeySchema,
} from "../src/domain/game-data/credentials.schema"
import { fetchTeamFixtures } from "../src/infrastructure/wardogs-league/fetch-team-fixtures"
import { autoImportSettingsSchema } from "../src/domain/wardogs-league/team-api"
import { internalAction, action } from "./_generated/server"
import { makeFunctionReference } from "convex/server"
import type { Doc } from "./_generated/dataModel"
import { dashboardActor } from "./dashboardActor"
import { v } from "convex/values"

export const save = action({
    args: {
        secret: v.string(),
        guildId: v.string(),
        actor: dashboardActor,
        settingsJson: v.string(),
        apiKey: v.optional(v.string()),
    },
    handler: async (ctx, args): Promise<{ ok: boolean }> => {
        const { apiKey, ...input } = args
        // Authorize before contacting the provider; the mutation checks authority again.
        await ctx.runQuery(
            makeFunctionReference<"query">("leagueAutoImport:read"),
            { secret: args.secret, guildId: args.guildId, actor: args.actor }
        )
        autoImportSettingsSchema.parse(JSON.parse(args.settingsJson))
        let credentialJson: string | undefined
        if (apiKey) {
            const key = providerKeySchema.parse(apiKey)
            const keyring = parseKeyring(process.env.LOGI_CREDENTIAL_KEYRING)
            if (!keyring)
                throw new Error("Credential encryption is not configured.")
            await fetchTeamFixtures(key)
            credentialJson = JSON.stringify(
                encryptCredential(
                    keyring,
                    key,
                    `wardogs-team-fixtures:${args.guildId}`
                )
            )
        }
        return ctx.runMutation(
            makeFunctionReference<"mutation">("leagueAutoImport:save"),
            { ...input, credentialJson }
        )
    },
})
export const collectDue = internalAction({
    args: {},
    handler: async (ctx) => {
        for (let n = 0; n < 5; n++) {
            const config: Doc<"leagueAutoImportSettings"> | null =
                await ctx.runMutation(
                    makeFunctionReference<"mutation">("leagueAutoImport:claim"),
                    {}
                )
            if (!config) break
            const claim = {
                id: config._id,
                fence: config.fence,
                revision: config.revision,
            }
            let error: string | undefined
            try {
                const key = decryptCredential(
                    parseKeyring(process.env.LOGI_CREDENTIAL_KEYRING),
                    credentialEnvelopeSchema.parse(
                        JSON.parse(config.credentialJson)
                    ),
                    `wardogs-team-fixtures:${config.guildId}`
                )
                const fixtures = await fetchTeamFixtures(key)
                // Never infer cancellation from absence in this bounded API window.
                const seen = new Set<string>()
                for (const fixture of [
                    ...fixtures.upcoming,
                    ...fixtures.recent,
                ]) {
                    if (seen.has(fixture.id)) continue
                    seen.add(fixture.id)
                    await ctx.runMutation(
                        makeFunctionReference<"mutation">(
                            "leagueAutoImport:importFixture"
                        ),
                        { ...claim, fixtureJson: JSON.stringify(fixture) }
                    )
                }
            } catch {
                error = "import_failed"
            }
            await ctx.runMutation(
                makeFunctionReference<"mutation">("leagueAutoImport:finish"),
                { ...claim, error }
            )
        }
        const pending: Doc<"leagueAutoImportFixtures">[] = await ctx.runQuery(
            makeFunctionReference<"query">("leagueAutoImport:pendingCache"),
            {}
        )
        for (const row of pending) {
            if (
                !row.eventId ||
                !process.env.SITE_URL ||
                !process.env.INTERNAL_AUTH_SECRET
            )
                continue
            try {
                const response = await fetch(
                    new URL("/api/cache/revalidate", process.env.SITE_URL),
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            secret: process.env.INTERNAL_AUTH_SECRET,
                            payload: {
                                type: "event-changed",
                                serverId: row.guildId,
                                eventId: String(row.eventId),
                            },
                        }),
                        signal: AbortSignal.timeout(5000),
                        redirect: "error",
                    }
                )
                if (response.ok)
                    await ctx.runMutation(
                        makeFunctionReference<"mutation">(
                            "leagueAutoImport:acknowledgeCache"
                        ),
                        { id: row._id, updatedAt: row.updatedAt }
                    )
            } catch {
                /* Retained for the next cron, including while import is disabled. */
            }
        }
    },
})
