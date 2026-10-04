import {
    beginSteamLink,
    verifySteamLink,
    type PlatformLinkPorts,
} from "../../application/identity/verify-platform-link"
import {
    verifiedPlatformLinkSchema,
    type LinkActorSession,
} from "../../domain/identity/platform-link"
import { z } from "zod"

type Ports = {
    origin: string
    actor(): Promise<LinkActorSession | null>
    links: PlatformLinkPorts
    list(discordUserId: string): Promise<unknown>
    unlink(discordUserId: string): Promise<void>
}
const json = (body: unknown, status = 200) =>
    Response.json(body, {
        status,
        headers: {
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer",
        },
    })
export function platformLinksHandlers(ports: Ports) {
    return {
        status: async () => {
            try {
                const actor = await ports.actor()
                if (!actor)
                    return json({ error: "Authentication required." }, 401)
                return json(
                    z
                        .array(verifiedPlatformLinkSchema)
                        .max(20)
                        .parse(await ports.list(actor.discordUserId))
                )
            } catch {
                return json({ error: "Steam links unavailable." }, 503)
            }
        },
        start: async (request: Request) => {
            try {
                const actor = await ports.actor()
                if (!actor)
                    return json({ error: "Authentication required." }, 401)
                if (request.headers.get("origin") !== ports.origin)
                    return json({ error: "Forbidden." }, 403)
                const { locale } = z
                    .object({
                        locale: z.enum(["en", "cs", "de"]).default("en"),
                    })
                    .strict()
                    .parse(await request.json())
                return json(
                    await beginSteamLink(
                        actor,
                        ports.origin,
                        ports.links,
                        locale
                    )
                )
            } catch {
                return json(
                    {
                        error: "Unable to start Steam linking. Wait briefly and retry.",
                    },
                    400
                )
            }
        },
        callback: async (request: Request) => {
            let target = `${ports.origin}/en/dashboard/settings/user?steam=failed`
            try {
                const actor = await ports.actor()
                if (!actor)
                    return json({ error: "Authentication required." }, 401)
                const url = new URL(request.url)
                if (url.origin !== ports.origin)
                    throw new Error("Invalid callback origin.")
                const { locale } = await verifySteamLink(
                    url.searchParams,
                    actor,
                    ports.links
                )
                target = `${ports.origin}/${locale}/dashboard/settings/user?steam=linked`
            } catch {
                /* Never reflect provider assertions or internal errors. */
            }
            return new Response(null, {
                status: 303,
                headers: {
                    Location: target,
                    "Cache-Control": "no-store",
                    "Referrer-Policy": "no-referrer",
                },
            })
        },
        unlink: async (request: Request) => {
            try {
                const actor = await ports.actor()
                if (!actor)
                    return json({ error: "Authentication required." }, 401)
                if (request.headers.get("origin") !== ports.origin)
                    return json({ error: "Forbidden." }, 403)
                await ports.unlink(actor.discordUserId)
                return json({ ok: true })
            } catch {
                return json({ error: "Unable to unlink Steam." }, 503)
            }
        },
    }
}
