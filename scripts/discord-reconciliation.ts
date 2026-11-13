/** Operator-only inspection and evidence recording. This script never calls Discord. */
import { makeFunctionReference } from "convex/server"
import { ConvexHttpClient } from "convex/browser"
import dotenv from "dotenv"

async function main() {
    const [command, ...values] = process.argv.slice(2)
    if (command === "--help") {
        console.log(
            "Commands: list, effects, audit, legacy, requests, delivery, automatic, resolve, resume. See discord-bot/README.md for arguments and evidence requirements."
        )
        process.exit(0)
    }
    dotenv.config({ path: ".env.local", quiet: true })
    dotenv.config({ quiet: true })
    const url =
        process.env.NEXT_PUBLIC_CONVEX_URL ??
        process.env.CONVEX_SELF_HOSTED_URL ??
        process.env.CONVEX_URL
    const secret = process.env.INTERNAL_AUTH_SECRET
    if (!url || !secret)
        throw new Error(
            "Configured Convex URL and INTERNAL_AUTH_SECRET are required"
        )
    const client = new ConvexHttpClient(url)
    const query = (name: string, args: Record<string, unknown>) =>
        client.query(makeFunctionReference<"query">(name), { secret, ...args })
    let result: unknown
    if (command === "list") {
        const [guildId, state = "review", cursor] = values
        if (!guildId || !["pending", "review", "complete"].includes(state))
            throw new Error(
                "Usage: list <guildId> [pending|review|complete] [cursor]"
            )
        result = await query("discordMembershipEffects:inspect", {
            guildId,
            state,
            cursor: cursor ?? null,
        })
    } else if (command === "effects" || command === "audit") {
        const [operationId, cursor] = values
        if (!operationId)
            throw new Error("Usage: effects <operationId> [cursor]")
        result = await query(`discordMembershipEffects:${command}`, {
            operationId,
            cursor: cursor ?? null,
        })
    } else if (command === "legacy") {
        const [guildId, kind, cursor] = values
        if (!guildId || !["ticket", "application"].includes(kind))
            throw new Error(
                "Usage: legacy <guildId> <ticket|application> [cursor]"
            )
        result = await query("discordMembershipEffects:legacy", {
            guildId,
            kind,
            cursor: cursor ?? null,
        })
    } else if (command === "delivery") {
        const [guildId, kind, requestId, cursor] = values
        if (!guildId || !requestId || !["reminder", "roster"].includes(kind))
            throw new Error(
                "Usage: delivery <guildId> <reminder|roster> <requestId> [cursor]"
            )
        result = await query("discordDelivery:inspect", {
            guildId,
            kind,
            requestId,
            cursor: cursor ?? null,
        })
    } else if (command === "requests") {
        const [guildId, kind, status = "failed", cursor] = values
        if (
            !guildId ||
            !["reminder", "roster"].includes(kind) ||
            !["pending", "processing", "sent", "failed"].includes(status)
        )
            throw new Error(
                "Usage: requests <guildId> <reminder|roster> [status] [cursor]"
            )
        result = await query("discordDelivery:requests", {
            guildId,
            kind,
            status,
            cursor: cursor ?? null,
        })
    } else if (command === "automatic") {
        const [guildId, eventId, phase, cursor] = values
        if (!guildId || !eventId || !phase)
            throw new Error(
                "Usage: automatic <guildId> <eventId> <phase> [cursor]"
            )
        result = await query("discordDelivery:inspectAutomatic", {
            guildId,
            eventId,
            phase,
            cursor: cursor ?? null,
        })
    } else if (command === "resume") {
        const [operationId, operator, evidence] = values
        if (!operationId || !operator || !evidence)
            throw new Error("Usage: resume <operationId> <operator> <evidence>")
        result = await client.mutation(
            makeFunctionReference<"mutation">(
                "discordMembershipEffects:resume"
            ),
            { secret, operationId, operator, evidence }
        )
    } else if (command === "resolve") {
        const [operationId, effectId, action, operator, evidence, resourceId] =
            values
        if (
            !operationId ||
            !effectId ||
            !operator ||
            !evidence ||
            !["confirm", "proven_not_sent"].includes(action)
        )
            throw new Error(
                "Usage: resolve <operationId> <effectId> <confirm|proven_not_sent> <operator> <evidence> [resourceId]"
            )
        result = await client.mutation(
            makeFunctionReference<"mutation">(
                "discordMembershipEffects:reconcile"
            ),
            {
                secret,
                operationId,
                effectId,
                action,
                operator,
                evidence,
                ...(resourceId ? { resourceId } : {}),
            }
        )
    } else
        throw new Error(
            "Commands: list, effects, audit, legacy, requests, delivery, automatic, resolve, resume. See discord-bot/README.md for evidence and repair policy."
        )
    console.log(JSON.stringify(result, null, 2))
}

void main().catch(() => {
    console.error(
        "Reconciliation command failed. Check arguments, configured backend access, and the documented evidence policy."
    )
    process.exitCode = 1
})
