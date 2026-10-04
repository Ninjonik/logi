import type { HllServed } from "../application/game-data/read-hll-live"
import { makeFunctionReference } from "convex/server"
import { getInternalAuthSecret } from "./env"
import { fetchAction } from "convex/nextjs"
import { hashApiKey } from "./public-api"
export function getHllLive(
    guildId: string,
    connectionId: string,
    key: string
): Promise<HllServed> {
    const args = {
        secret: getInternalAuthSecret(),
        guildId,
        connectionId,
        keyHash: hashApiKey(key),
    }
    return fetchAction(
        makeFunctionReference<"action", typeof args, HllServed>(
            "hllLiveData:read"
        ),
        args
    )
}
