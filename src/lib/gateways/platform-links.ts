import {
    createSteamVerifier,
    steamRedirect,
} from "../../infrastructure/steam/openid-verifier"
import type { PlatformLinkPorts } from "../../application/identity/verify-platform-link"
import { verifiedPlatformLinkSchema } from "../../domain/identity/platform-link"
import { platformLinksHandlers } from "../api/platform-links-route"
import { getInternalAuthSecret, getSiteUrl } from "../env"
import { fetchMutation, fetchQuery } from "convex/nextjs"
import { makeFunctionReference } from "convex/server"
import { createHash, randomBytes } from "node:crypto"
import { verifySessionToken } from "../auth"
import { cookies } from "next/headers"
import { z } from "zod"

const hash = (value: string) => createHash("sha256").update(value).digest("hex")
const mutate = (name: string, args: Record<string, unknown>) =>
    fetchMutation(
        makeFunctionReference<"mutation">(`platformIdentityLinks:${name}`),
        { secret: getInternalAuthSecret(), ...args }
    )
async function actor() {
    const token = (await cookies()).get("token")?.value
    if (!token) return null
    const session = await verifySessionToken(token)
    return session
        ? { discordUserId: session.sub, sessionHash: hash(token) }
        : null
}
const challengeSchema = z
    .object({
        id: z.string(),
        discordUserId: z.string(),
        sessionHash: z.string(),
        returnOrigin: z.string(),
        locale: z.enum(["en", "cs", "de"]),
        expiresAt: z.number(),
        status: z.literal("verifying"),
    })
    .strict()
const links: PlatformLinkPorts = {
    now: Date.now,
    randomState: () => randomBytes(32).toString("base64url"),
    hash,
    create: async (args) => {
        await mutate("begin", args)
    },
    claim: async (args) => challengeSchema.parse(await mutate("claim", args)),
    verify: createSteamVerifier(),
    redirect: steamRedirect,
    complete: async (args) => {
        const current = await actor()
        if (
            current?.discordUserId !== args.discordUserId ||
            current?.sessionHash !== args.sessionHash
        )
            throw new Error("Session changed.")
        return verifiedPlatformLinkSchema.parse(await mutate("complete", args))
    },
    fail: async (args) => {
        await mutate("fail", args)
    },
}
export function steamLinkHandlers() {
    return platformLinksHandlers({
        origin: getSiteUrl().replace(/\/$/, ""),
        actor,
        links,
        list: (discordUserId) =>
            fetchQuery(
                makeFunctionReference<"query">("platformIdentityLinks:list"),
                { secret: getInternalAuthSecret(), discordUserId }
            ),
        unlink: async (discordUserId) => {
            await mutate("unlink", { discordUserId })
        },
    })
}
export async function cancelSteamSession(token: string, discordUserId: string) {
    await mutate("cancelSession", { discordUserId, sessionHash: hash(token) })
}
