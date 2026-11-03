import { NextResponse } from "next/server"

import {
    invalidateAppData,
    type CacheRevalidationPayload,
} from "@/lib/gateways/cache-revalidation"
import { logRouteError } from "@/lib/server-route-errors"
import { revalidateCacheEntries } from "@/lib/cache-tags"
import { makeFunctionReference } from "convex/server"
import { getInternalAuthSecret } from "@/lib/env"
import { getLoggedInUser } from "@/lib/auth"
import { fetchQuery } from "convex/nextjs"

function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0
}

function parsePayload(body: unknown): CacheRevalidationPayload | null {
    if (!body || typeof body !== "object") {
        return null
    }

    const payload = body as Record<string, unknown>
    if (
        !isNonEmptyString(payload.type) ||
        !isNonEmptyString(payload.serverId)
    ) {
        return null
    }

    switch (payload.type) {
        case "assignment-changed":
            if (!isNonEmptyString(payload.userId)) {
                return null
            }
            return {
                type: "assignment-changed",
                serverId: payload.serverId,
                userId: payload.userId,
                assignmentId: isNonEmptyString(payload.assignmentId)
                    ? payload.assignmentId
                    : undefined,
            }
        case "roster-changed":
            if (!isNonEmptyString(payload.rosterId)) {
                return null
            }
            return {
                type: "roster-changed",
                serverId: payload.serverId,
                rosterId: payload.rosterId,
                eventId: isNonEmptyString(payload.eventId)
                    ? payload.eventId
                    : undefined,
            }
        case "event-changed":
            if (!isNonEmptyString(payload.eventId)) {
                return null
            }
            return {
                type: "event-changed",
                serverId: payload.serverId,
                eventId: payload.eventId,
            }
        case "discord-config-changed":
            return {
                type: "discord-config-changed",
                serverId: payload.serverId,
            }
        case "server-context-changed":
            return {
                type: "server-context-changed",
                serverId: payload.serverId,
            }
        default:
            return null
    }
}

export async function POST(request: Request) {
    const body = (await request.json().catch(() => null)) as
        | ({ secret?: string; payload?: unknown } & Record<string, unknown>)
        | null

    const user = await getLoggedInUser()
    const authorized = Boolean(user) || body?.secret === getInternalAuthSecret()
    const payload = parsePayload(body?.payload ?? body)

    if (!authorized || !payload) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    }

    try {
        await invalidateAppData(payload, {
            resolve: (serverId) => {
                const discordId = /^\d{17,20}$/.test(serverId)
                return fetchQuery(
                    makeFunctionReference<"query">(
                        discordId ? "guilds:getByDiscordId" : "guilds:getById"
                    ),
                    {
                        secret: getInternalAuthSecret(),
                        ...(discordId
                            ? { discordId: serverId }
                            : { guildId: serverId }),
                    }
                )
            },
            invalidate: revalidateCacheEntries,
        })
        return NextResponse.json({ ok: true })
    } catch (error) {
        logRouteError("cache-revalidation", error)
        return NextResponse.json(
            { error: "Cache refresh failed." },
            { status: 503 }
        )
    }
}
