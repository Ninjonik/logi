import type { WarconServed } from "../application/game-data/read-warcon"
import type { WarconQuery } from "../domain/game-data/warcon-query"
import type { DashboardActor } from "../../convex/dashboardActor"
import { makeFunctionReference } from "convex/server"
import { getInternalAuthSecret } from "./env"
import { fetchAction } from "convex/nextjs"
import { hashApiKey } from "./public-api"

type Args = {
    secret: string
    guildId: string
    connectionId: string
    queryJson: string
    keyHash?: string
    actor?: DashboardActor
}
export function getWarconData(
    guildId: string,
    connectionId: string,
    query: WarconQuery,
    credential: string | DashboardActor
): Promise<WarconServed> {
    return fetchAction(
        makeFunctionReference<"action", Args, WarconServed>("warconData:read"),
        {
            secret: getInternalAuthSecret(),
            guildId,
            connectionId,
            queryJson: JSON.stringify(query),
            ...(typeof credential === "string"
                ? { keyHash: hashApiKey(credential) }
                : { actor: credential }),
        }
    )
}
