import { Bot, BookOpen } from "lucide-react"
import { redirect } from "next/navigation"
import type { Metadata } from "next"
import Link from "next/link"

import {
    getCurrentPlayer,
    getVisibleGuildsForLoggedInUser,
    isCurrentUserSuperadmin,
    resolveDefaultWorkspaceForCurrentPlayer,
} from "@/lib/auth"
import {
    CLAN_LIST_QUERY,
    chooseDashboardLanding,
} from "@/domain/workspaces/dashboard-landing"
import { RefreshBotStatusButton } from "@/components/app/refresh-bot-status-button"
import { BotInviteButton } from "@/components/app/bot-invite-button"
import { ServerCard } from "@/components/app/server-card"
import { PageHeader } from "@/components/app/page-header"
import { EmptyState } from "@/components/app/empty-state"
import { buildDiscordBotInviteUrl } from "@/lib/discord"
import { getServerContext } from "@/lib/server-context"
import { getDictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
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
    searchParams,
}: {
    params: Promise<{ locale: string }>
    searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
    const { locale } = await params
    const safeLocale = isLocale(locale) ? locale : "en"
    const dictionary = getDictionary(safeLocale)
    const user = await getCurrentPlayer()

    if (!user) {
        return null
    }

    const showClanList =
        (await searchParams)[CLAN_LIST_QUERY.key] === CLAN_LIST_QUERY.value
    const [superadmin, visibleGuilds] = await Promise.all([
        isCurrentUserSuperadmin(),
        getVisibleGuildsForLoggedInUser(),
    ])
    // Redirect only into a clan the person can still see; a stale stored
    // default falls back to the resolved one, then to this clan list.
    const visibleWorkspaceIds = new Set(visibleGuilds.map((guild) => guild.id))
    let landing = chooseDashboardLanding({
        showClanList,
        visibleWorkspaceIds,
        candidates: [user.defaultWorkspaceRecordId],
    })
    if (landing.kind === "clanList" && !showClanList) {
        landing = chooseDashboardLanding({
            showClanList,
            visibleWorkspaceIds,
            candidates: [
                await resolveDefaultWorkspaceForCurrentPlayer(user.id),
            ],
        })
    }
    if (landing.kind === "workspace") {
        redirect(`/${safeLocale}/dashboard/servers/${landing.workspaceId}`)
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
    const managedIds = new Set(managedServers.map((guild) => guild.id))
    const mercenaryServers = visibleGuilds.filter(
        (guild) =>
            !managedIds.has(guild.id) &&
            user.mercenaryGuildIds.includes(guild.discordId)
    )
    const mercenaryIds = new Set(mercenaryServers.map((guild) => guild.id))
    // Clans the person belongs to without managing them (primary clan, bot-
    // granted dashboard access); only clans the bot is in can be opened.
    const memberServers = visibleGuilds.filter(
        (guild) =>
            guild.botInside &&
            guild.name &&
            !managedIds.has(guild.id) &&
            !mercenaryIds.has(guild.id)
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
                {!managedServers.length &&
                !memberServers.length &&
                !mercenaryServers.length ? (
                    <EmptyState
                        title={dictionary.dashboard.noServerTitle}
                        description={dictionary.dashboard.noServerDescription}
                        actions={
                            <Button
                                asChild
                                variant="outline"
                                className="rounded-xl"
                            >
                                <Link href="/wiki/discord-bot-setup">
                                    <BookOpen className="size-4" />
                                    {dictionary.dashboard.noServerSetupGuide}
                                </Link>
                            </Button>
                        }
                    />
                ) : null}
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
                                        canInviteBot
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
                {memberServers.length ? (
                    <section className="space-y-4">
                        <h2 className="text-muted-foreground text-sm font-semibold tracking-[0.24em] uppercase">
                            {dictionary.dashboard.memberServers}
                        </h2>
                        <div className="grid gap-4 xl:grid-cols-2">
                            {memberServers.map((guild) => (
                                <ServerCard
                                    key={guild.id}
                                    locale={safeLocale}
                                    guild={guild}
                                    label={dictionary.dashboard.memberServers}
                                    dictionary={dictionary}
                                    canInviteBot={false}
                                />
                            ))}
                        </div>
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
                                    canInviteBot={false}
                                />
                            ))}
                        </div>
                    </section>
                ) : null}
            </div>
        </>
    )
}
