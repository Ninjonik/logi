import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { Bot } from "lucide-react"

import {
    getCurrentPlayer,
    getVisibleGuildsForLoggedInUser,
    isCurrentUserSuperadmin,
} from "@/lib/auth"
import { RefreshBotStatusButton } from "@/components/app/refresh-bot-status-button"
import { BotInviteButton } from "@/components/app/bot-invite-button"
import { getGuildMetadataByDiscordId } from "@/lib/server-metadata"
import { ServerCard } from "@/components/app/server-card"
import { PageHeader } from "@/components/app/page-header"
import { buildDiscordBotInviteUrl } from "@/lib/discord"
import { getServerContext } from "@/lib/server-context"
import { getDictionary } from "@/i18n/dictionaries"
import { isLocale } from "@/i18n/config"

function requiresBotRoleHierarchySetup(
    context: Awaited<ReturnType<typeof getServerContext>>
) {
    if (!context) {
        return false
    }

    const hasGroupRoleSync = context.groups.some((group) =>
        Boolean(group.discordRoleId)
    )
    const hasMembershipRoleSync =
        Boolean(context.discordConfig?.clanRoleId) ||
        Boolean(
            context.discordConfig?.membershipSettings?.categories.some(
                (category) =>
                    category.recruitRoleIds.length > 0 ||
                    category.finalRoleIds.length > 0
            )
        )

    return hasGroupRoleSync || hasMembershipRoleSync
}

export const metadata: Metadata = {
    title: "Dashboard | Logi",
    description: "Manage your Discord communities.",
}

export default async function DashboardHomePage({
    params,
}: {
    params: Promise<{ locale: string }>
}) {
    const { locale } = await params
    const safeLocale = isLocale(locale) ? locale : "en"
    const dictionary = getDictionary(safeLocale)
    const [user, superadmin, visibleGuilds] = await Promise.all([
        getCurrentPlayer(),
        isCurrentUserSuperadmin(),
        getVisibleGuildsForLoggedInUser(),
    ])

    if (!user) {
        return null
    }

    const mainServer = user.guildId
        ? visibleGuilds.find((guild) => guild.discordId === user.guildId)
        : undefined
    if (mainServer) {
        const persistedMainServer = await getGuildMetadataByDiscordId(
            mainServer.discordId
        )
        if (persistedMainServer) {
            redirect(
                `/${safeLocale}/dashboard/servers/${persistedMainServer.id}`
            )
        }
    }
    const managedServers = superadmin
        ? visibleGuilds
        : visibleGuilds.filter((guild) =>
              user.managedGuildIds.includes(guild.discordId)
          )
    const readyManagedServers = managedServers.filter(
        (guild) => guild.botInside
    )
    const managedServersMissingBot = managedServers.filter(
        (guild) => !guild.botInside
    )
    const mercenaryServers = visibleGuilds.filter((guild) =>
        user.mercenaryGuildIds.includes(guild.discordId)
    )
    const inviteRoleHierarchyByGuildId = new Map<string, boolean>(
        await Promise.all(
            managedServersMissingBot.map(
                async (guild) =>
                    [
                        guild.id,
                        requiresBotRoleHierarchySetup(
                            await getServerContext(guild.id)
                        ),
                    ] as const
            )
        )
    )

    return (
        <>
            <PageHeader
                title={dictionary.dashboard.title}
                description={dictionary.dashboard.description}
            />
            <div className="space-y-8 px-4 lg:px-6">
                {managedServers.length ? (
                    <section className="space-y-4">
                        <div className="border-border/60 bg-card/50 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-muted-foreground text-sm font-semibold tracking-[0.24em] uppercase">
                                    {dictionary.dashboard.managedServers}
                                </h2>
                                {managedServersMissingBot.length ? (
                                    <p className="text-muted-foreground mt-2 text-sm">
                                        {dictionary.dashboard.inviteBotHint}
                                    </p>
                                ) : null}
                            </div>
                            {managedServersMissingBot.length ? (
                                <div className="flex flex-wrap gap-2">
                                    <RefreshBotStatusButton
                                        dictionary={dictionary}
                                    />
                                    {managedServersMissingBot.map((guild) => (
                                        <BotInviteButton
                                            key={guild.id}
                                            dictionary={dictionary}
                                            inviteUrl={buildDiscordBotInviteUrl(
                                                guild.discordId
                                            )}
                                            roleHierarchyRelevant={
                                                inviteRoleHierarchyByGuildId.get(
                                                    guild.id
                                                ) ?? false
                                            }
                                            variant="outline"
                                            className="rounded-full"
                                        >
                                            <>
                                                <Bot className="size-4" />
                                                {guild.name}
                                            </>
                                        </BotInviteButton>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                        {readyManagedServers.length ? (
                            <div className="grid gap-4 xl:grid-cols-2">
                                {readyManagedServers.map((guild) => (
                                    <ServerCard
                                        key={guild.id}
                                        locale={safeLocale}
                                        guild={guild}
                                        label={
                                            dictionary.dashboard.managedServers
                                        }
                                        dictionary={dictionary}
                                        inviteRoleHierarchyRelevant={
                                            inviteRoleHierarchyByGuildId.get(
                                                guild.id
                                            ) ?? false
                                        }
                                    />
                                ))}
                            </div>
                        ) : null}
                    </section>
                ) : null}
                {mercenaryServers.length ? (
                    <section className="space-y-4">
                        <h2 className="text-muted-foreground text-sm font-semibold tracking-[0.24em] uppercase">
                            {dictionary.dashboard.mercenaryServers}
                        </h2>
                        <div className="grid gap-4 xl:grid-cols-2">
                            {mercenaryServers.map((guild) => (
                                <ServerCard
                                    key={guild.id}
                                    locale={safeLocale}
                                    guild={guild}
                                    label={
                                        dictionary.dashboard.mercenaryServers
                                    }
                                    dictionary={dictionary}
                                />
                            ))}
                        </div>
                    </section>
                ) : null}
            </div>
        </>
    )
}
