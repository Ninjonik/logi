import { redirect } from "next/navigation"
import type { Metadata } from "next"

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
import { getServerContext } from "@/lib/server-context"
import { ClanList } from "@/components/app/clan-list"
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

export async function generateMetadata(props: {
    params?: Promise<{ locale: string }>
}): Promise<Metadata> {
    // The build also evaluates this while collecting page data, without params.
    const locale = (await props?.params)?.locale
    const dictionary = getDictionary(locale && isLocale(locale) ? locale : "en")
    return {
        title: dictionary.dashboard.title,
        description: dictionary.dashboard.description,
    }
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
        <ClanList
            locale={safeLocale}
            dictionary={dictionary}
            inviteRoleHierarchyByGuildId={inviteRoleHierarchyByGuildId}
            sections={[
                {
                    id: "managed",
                    guilds: [
                        ...managedServers.filter((guild) => guild.botInside),
                        ...managedServersMissingBot,
                    ],
                },
                { id: "member", guilds: memberServers },
                { id: "mercenary", guilds: mercenaryServers },
            ]}
        />
    )
}
