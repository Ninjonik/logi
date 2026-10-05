import {
    isCurrentUserSuperadmin,
    getVisibleGuildsForLoggedInUser,
} from "@/lib/auth"
import { platformSettingsInputSchema } from "@/lib/validation/platform-settings"
import { isSameOrigin, noStore } from "@/lib/api/superadmin-route"
import { savePlatformSettings } from "@/lib/platform-settings"
import { getSiteUrl } from "@/lib/env"

export async function POST(request: Request) {
    if (!isSameOrigin(request, new URL(getSiteUrl()).origin)) {
        return noStore({ error: "Forbidden." }, 403)
    }
    if (!(await isCurrentUserSuperadmin())) {
        return noStore({ error: "Forbidden." }, 403)
    }
    const parsed = platformSettingsInputSchema.safeParse(
        await request.json().catch(() => null)
    )
    if (!parsed.success) {
        return noStore({ error: "Choose a workspace." }, 400)
    }
    const { workspaceGuildId, statusChannelId } = parsed.data
    const workspaces = await getVisibleGuildsForLoggedInUser()
    const workspace = workspaces.find(
        (item) => item.discordId === workspaceGuildId
    )
    if (!workspace?.botInside) {
        return noStore(
            { error: "Choose a workspace with the Logi bot installed." },
            400
        )
    }
    await savePlatformSettings({
        workspaceGuildId,
        statusChannelId: statusChannelId || undefined,
    })
    return noStore({ ok: true })
}
