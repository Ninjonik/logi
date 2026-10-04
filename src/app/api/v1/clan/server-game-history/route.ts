import {
    authenticateClanRequest,
    isAuthError,
} from "@/lib/api/authenticated-clan-route"
import { handleGameHistoryRead } from "@/lib/api/game-history-route"
import { makeFunctionReference } from "convex/server"
import { getInternalAuthSecret } from "@/lib/env"
import { hashApiKey } from "@/lib/public-api"
import { fetchQuery } from "convex/nextjs"

export const runtime = "nodejs"
export async function GET(request: Request) {
    const auth = await authenticateClanRequest(request)
    if (isAuthError(auth)) {
        auth.headers.set("Cache-Control", "no-store")
        return auth
    }
    const keyHash = hashApiKey(auth.key),
        secret = getInternalAuthSecret()
    return handleGameHistoryRead(request, {
        guildId: auth.guildId,
        binding: `key:${keyHash}`,
        secret,
        headers: auth.headers,
        read: (input) =>
            fetchQuery(
                makeFunctionReference<"query">("gameHistoryReads:read"),
                { ...input, secret, guildId: auth.guildId, keyHash }
            ),
    })
}
