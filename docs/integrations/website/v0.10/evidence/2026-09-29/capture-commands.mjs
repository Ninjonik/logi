// Reproduce command metadata without logging in, registering commands or sending messages.
import { pathToFileURL } from "node:url"
import assert from "node:assert/strict"
import { writeFileSync } from "node:fs"
import path from "node:path"

const repo = path.resolve(import.meta.dirname, "../../../../../..")
Object.assign(process.env, {
    NEXT_PUBLIC_CONVEX_URL: "http://127.0.0.1:32199",
    CONVEX_SELF_HOSTED_URL: "http://127.0.0.1:32199",
    INTERNAL_AUTH_SECRET: "dev-internal-auth-secret",
    DISCORD_BOT_TOKEN: "offline-synthetic-bot-token",
    SITE_URL: "https://logi.example.test",
})
globalThis.fetch = async () => {
    throw new Error("Network disabled during command metadata capture")
}
const handlersModule = await import(
    pathToFileURL(path.join(repo, "discord-bot/src/interactions.ts")).href
)
const convexModule = await import(
    pathToFileURL(path.join(repo, "discord-bot/src/convex.ts")).href
)
const { createInteractionHandler } = handlersModule.default ?? handlersModule
const { closeConvexClient } = convexModule.default ?? convexModule
const locales = {}
try {
    for (const locale of ["en-US", "cs", "de"]) {
        await createInteractionHandler({
            enqueueEventSync() {},
            triggerPollSoon() {},
        }).registerGuildCommands({
            preferredLocale: locale,
            commands: {
                set: async (payload) => {
                    locales[locale] = payload
                },
            },
        })
        assert.deepEqual(
            locales[locale].map((command) => command.name),
            [
                "server-status",
                "close_ticket",
                "close_application",
                "notice",
                "link",
                "player",
            ]
        )
        assert.ok(
            locales[locale].every((command) => command.dm_permission === false)
        )
    }
    writeFileSync(
        path.join(import.meta.dirname, "discord-commands.json"),
        JSON.stringify(
            {
                kind: "synthetic-registration-payload",
                note: "Actual registerGuildCommands serialization; fake guild.commands.set; no Discord registration or message.",
                locales,
            },
            null,
            2
        ) + "\n"
    )
    console.log(
        "Captured six command definitions in each of en-US, cs and de; no network."
    )
} finally {
    closeConvexClient()
}
