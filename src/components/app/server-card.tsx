import { Bot, ChevronRight, TriangleAlert } from "lucide-react"
import Link from "next/link"

import { RefreshBotStatusButton } from "@/components/app/refresh-bot-status-button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { BotInviteButton } from "@/components/app/bot-invite-button"
import { buildDiscordBotInviteUrl } from "@/lib/discord"
import type { Dictionary } from "@/i18n/dictionaries"
import type { Guild } from "@/types/domain"
import { initialsOf } from "@/lib/initials"
import type { Locale } from "@/i18n/config"

/**
 * One clan on the clan list, as a tile like the settings overview (design
 * A1): picture, name, description and size. A clan with the bot opens on
 * click; one without it says so and offers the invite to its admins.
 */
export function ServerCard({
    locale,
    guild,
    dictionary,
    canInviteBot,
    inviteRoleHierarchyRelevant = false,
}: {
    locale: Locale
    guild: Guild
    dictionary: Dictionary
    /** Only clan admins can add the bot; everyone else is told to ask one. */
    canInviteBot: boolean
    inviteRoleHierarchyRelevant?: boolean
}) {
    const t = dictionary.workspace
    const stats = t.clanStats
        .replace("{members}", String(guild.memberIds.length))
        .replace("{admins}", String(guild.adminIds.length))
    const body = (
        <>
            <Avatar className="size-10 shrink-0 rounded-[10px]">
                <AvatarImage
                    src={guild.avatar}
                    alt=""
                    className="rounded-[10px]"
                />
                <AvatarFallback className="bg-primary text-primary-foreground rounded-[10px] text-sm font-semibold">
                    {initialsOf(guild.name)}
                </AvatarFallback>
            </Avatar>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-start justify-between gap-2">
                    <span className="truncate text-[15px] font-semibold">
                        {guild.name}
                    </span>
                    {guild.botInside ? (
                        <ChevronRight
                            aria-hidden="true"
                            className="text-muted-foreground mt-0.5 size-4 shrink-0"
                        />
                    ) : (
                        <span className="border-status-warning-border bg-status-warning-muted text-status-warning inline-flex h-6 shrink-0 items-center gap-1 rounded-full border px-2 text-xs font-medium">
                            <TriangleAlert
                                aria-hidden="true"
                                className="size-3"
                            />
                            {t.botMissingBadge}
                        </span>
                    )}
                </span>
                {guild.description ? (
                    <span className="text-muted-foreground line-clamp-2 text-[13px] leading-5">
                        {guild.description}
                    </span>
                ) : null}
                <span className="text-muted-foreground text-[13px] leading-5">
                    {stats}
                </span>
            </span>
        </>
    )

    if (guild.botInside)
        return (
            <Link
                href={`/${locale}/dashboard/servers/${guild.id}`}
                prefetch={false}
                aria-label={`${dictionary.dashboard.openServer}: ${guild.name}`}
                className="bg-card hover:bg-muted/50 focus-visible:ring-ring flex gap-3 rounded-[14px] border p-4 transition-colors outline-none focus-visible:ring-2"
            >
                {body}
            </Link>
        )

    return (
        <div className="border-status-warning-border bg-card flex flex-col gap-3 rounded-[14px] border p-4">
            <div className="flex gap-3">{body}</div>
            {canInviteBot ? (
                <div className="flex flex-wrap gap-2 pl-[52px]">
                    <BotInviteButton
                        dictionary={dictionary}
                        inviteUrl={buildDiscordBotInviteUrl(guild.discordId)}
                        roleHierarchyRelevant={inviteRoleHierarchyRelevant}
                        className="h-8 rounded-lg px-3 text-[13px]"
                    >
                        <>
                            <Bot aria-hidden="true" className="size-4" />
                            {dictionary.dashboard.inviteBot}
                        </>
                    </BotInviteButton>
                    <RefreshBotStatusButton dictionary={dictionary} />
                </div>
            ) : (
                <p className="text-foreground/80 pl-[52px] text-[13px] leading-5">
                    {dictionary.dashboard.askAdminForBot}
                </p>
            )}
        </div>
    )
}
