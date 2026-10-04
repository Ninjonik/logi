import {
    sourceSchema,
    type DataSource,
} from "../src/domain/game-data/contracts"
import { parseSources } from "../src/domain/game-data/policy"
import type { QueryCtx } from "./_generated/server"
import type { Doc } from "./_generated/dataModel"

/** Shape a registration row exactly like an operator catalog entry. */
export function registeredSource(row: Doc<"gameDataSources">): DataSource {
    return sourceSchema.parse({
        ref: row.ref,
        guildId: row.guildId,
        gameId: row.gameId,
        provider: row.provider,
        providerServerId: row.providerServerId,
        origin: row.origin,
        secretRef: row.secretRef,
        allowedAddresses: row.allowedAddresses,
    })
}

/** Operator environment catalog first, then workspace registrations; an environment
 * reference always wins so a registration can never shadow operator configuration. */
export async function catalogSources(
    ctx: Pick<QueryCtx, "db">
): Promise<DataSource[]> {
    const environment = parseSources(process.env.LOGI_GAME_DATA_SOURCES)
    const refs = new Set(environment.map((source) => source.ref))
    const rows = await ctx.db.query("gameDataSources").take(200)
    const registered: DataSource[] = []
    for (const row of rows) {
        const parsed = sourceSchema.safeParse(registeredSource(row))
        if (parsed.success && !refs.has(parsed.data.ref)) {
            refs.add(parsed.data.ref)
            registered.push(parsed.data)
        }
    }
    return [...environment, ...registered]
}
