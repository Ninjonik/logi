import { provisionEmoji } from "../src/application/discord-publications/provision-emoji"
import { factionAssets } from "../discord-bot/src/public-panels/assets"
import { REST, Routes } from "discord.js"

async function main() {
    const applicationId = process.argv[2]
    if (
        !/^\d{17,20}$/.test(applicationId ?? "") ||
        !process.env.DISCORD_BOT_TOKEN
    )
        throw new Error(
            "Usage: DISCORD_BOT_TOKEN=<operator-supplied token> npx tsx scripts/provision-discord-panel-emoji.ts <expected-application-id>"
        )
    // Intentionally do not load .env: the operator must select the application.
    const rest = new REST({ timeout: 15_000, retries: 0 }).setToken(
        process.env.DISCORD_BOT_TOKEN
    )
    const app = (await rest.get(Routes.oauth2CurrentApplication())) as {
        id: string
    }
    if (app.id !== applicationId)
        throw new Error("Selected token belongs to a different application.")
    const result = await provisionEmoji(await factionAssets(), {
        list: async () =>
            (
                (await rest.get(Routes.applicationEmojis(applicationId))) as {
                    items: { id: string; name: string }[]
                }
            ).items,
        create: async (asset) =>
            (await rest.post(Routes.applicationEmojis(applicationId), {
                body: asset,
            })) as { id: string; name: string },
    })
    console.log(JSON.stringify({ applicationId, emoji: result }, null, 2))
}
void main().catch(() => {
    console.error(
        "Emoji provisioning failed. Verify the selected application and operator credentials; no existing emoji was deleted."
    )
    process.exitCode = 1
})
