import {
    registerSource,
    rotateSource,
    sourceRegistrationSchema,
    sourceRotationSchema,
    type RegisteredSource,
} from "../src/domain/game-data/source-registration"
import { authorizeDashboardAdmin, dashboardActor } from "./dashboardActor"
import { catalogSources, registeredSource } from "./gameDataCatalog"
import { parseSources } from "../src/domain/game-data/policy"
import { mutation, query } from "./_generated/server"
import { applyConnectionSource } from "./gameData"
import { v } from "convex/values"

const access = {
    secret: v.string(),
    guildId: v.string(),
    actor: dashboardActor,
}
const MAX_REGISTRATIONS = 20

function registrationRows(
    ctx: Parameters<typeof catalogSources>[0],
    guildId: string
) {
    return ctx.db
        .query("gameDataSources")
        .withIndex("guildId", (q) => q.eq("guildId", guildId))
        .take(MAX_REGISTRATIONS + 1)
}

/** Workspace registrations plus read-only operator entries; never a token value. */
export const list = query({
    args: access,
    handler: async (ctx, args): Promise<{ sources: RegisteredSource[] }> => {
        await authorizeDashboardAdmin(ctx, args)
        const operator = parseSources(process.env.LOGI_GAME_DATA_SOURCES)
            .filter((source) => source.guildId === args.guildId)
            .map((source) => ({
                ref: source.ref,
                gameId: source.gameId,
                provider: source.provider,
                providerServerId: source.providerServerId,
                origin: source.origin,
                secretRef: source.secretRef,
                allowedAddresses: source.allowedAddresses,
                managed: "operator" as const,
                updatedAt: null,
            }))
        const registered = (await registrationRows(ctx, args.guildId)).map(
            (row) => ({
                ref: row.ref,
                gameId: row.gameId,
                provider: row.provider,
                providerServerId: row.providerServerId,
                origin: row.origin,
                secretRef: row.secretRef,
                allowedAddresses: row.allowedAddresses,
                managed: "workspace" as const,
                updatedAt: row.updatedAt,
            })
        )
        return { sources: [...operator, ...registered] }
    },
})

export const register = mutation({
    args: { ...access, registration: v.any() },
    handler: async (ctx, args) => {
        const admin = await authorizeDashboardAdmin(ctx, args)
        const input = sourceRegistrationSchema.safeParse(args.registration)
        if (!input.success) return { error: "invalid_source" as const }
        if (
            (await registrationRows(ctx, args.guildId)).length >=
            MAX_REGISTRATIONS
        )
            return { error: "limit_reached" as const }
        const decision = registerSource(
            await catalogSources(ctx),
            args.guildId,
            input.data
        )
        if (!decision.ok) return { error: decision.error }
        const now = new Date().toISOString()
        await ctx.db.insert("gameDataSources", {
            ref: decision.source.ref,
            guildId: args.guildId,
            gameId: decision.source.gameId,
            provider: decision.source.provider,
            providerServerId: decision.source.providerServerId,
            origin: decision.source.origin,
            secretRef: decision.source.secretRef,
            allowedAddresses: decision.source.allowedAddresses,
            createdAt: now,
            updatedAt: now,
            updatedBy: admin.session.subject,
        })
        return { ok: true as const, ref: decision.source.ref }
    },
})

/** Rotation keeps the provider identity and refreshes the connection fingerprint so
 * collectors and reads use the new credential reference immediately. */
export const rotate = mutation({
    args: { ...access, rotation: v.any() },
    handler: async (ctx, args) => {
        const admin = await authorizeDashboardAdmin(ctx, args)
        const input = sourceRotationSchema.safeParse(args.rotation)
        if (!input.success) return { error: "invalid_source" as const }
        const row = (await registrationRows(ctx, args.guildId)).find(
            (entry) => entry.ref === input.data.ref
        )
        if (!row) return { error: "not_found" as const }
        const rotated = rotateSource(registeredSource(row), input.data)
        if (!rotated.ok) return { error: rotated.error }
        await ctx.db.patch(row._id, {
            secretRef: rotated.source.secretRef,
            allowedAddresses: rotated.source.allowedAddresses,
            updatedAt: new Date().toISOString(),
            updatedBy: admin.session.subject,
        })
        const connection = await ctx.db
            .query("gameDataConnections")
            .withIndex("sourceRef", (q) => q.eq("sourceRef", row.ref))
            .unique()
        if (connection && connection.guildId === args.guildId)
            await applyConnectionSource(ctx, {
                guildId: args.guildId,
                sourceRef: row.ref,
                enabled: connection.enabled,
            })
        return { ok: true as const }
    },
})

/** Removing a registration disables its connection; retained history is kept. */
export const remove = mutation({
    args: { ...access, ref: v.string() },
    handler: async (ctx, args) => {
        await authorizeDashboardAdmin(ctx, args)
        const row = (await registrationRows(ctx, args.guildId)).find(
            (entry) => entry.ref === args.ref
        )
        if (!row) return { error: "not_found" as const }
        const connection = await ctx.db
            .query("gameDataConnections")
            .withIndex("sourceRef", (q) => q.eq("sourceRef", row.ref))
            .unique()
        if (connection?.enabled && connection.guildId === args.guildId)
            await applyConnectionSource(ctx, {
                guildId: args.guildId,
                sourceRef: row.ref,
                enabled: false,
            })
        await ctx.db.delete(row._id)
        return { ok: true as const }
    },
})
