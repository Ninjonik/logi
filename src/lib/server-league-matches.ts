import type { Served } from "../application/wardogs-league/read-match"
import { makeFunctionReference } from "convex/server"
import { getInternalAuthSecret } from "./env"
import { fetchAction } from "convex/nextjs"
import { hashApiKey } from "./public-api"
type Args = {
    secret: string
    guildId: string
    sourceUrl: string
    keyHash?: string
}
export function getLeagueMatch(
    guildId: string,
    sourceUrl: string,
    key?: string
): Promise<Served> {
    return fetchAction(
        makeFunctionReference<"action", Args, Served>("leagueMatchData:read"),
        {
            secret: getInternalAuthSecret(),
            guildId,
            sourceUrl,
            ...(key === undefined ? {} : { keyHash: hashApiKey(key) }),
        }
    )
}
