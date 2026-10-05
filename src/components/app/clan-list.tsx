import { BookOpen, TriangleAlert, Users } from "lucide-react"
import Link from "next/link"

import { ServerCard } from "@/components/app/server-card"
import { PageHeader } from "@/components/app/page-header"
import { EmptyState } from "@/components/app/empty-state"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import type { Guild } from "@/types/domain"
import type { Locale } from "@/i18n/config"

export type ClanListSection = {
    id: "managed" | "member" | "mercenary"
    guilds: Guild[]
}

/**
 * "Your clans" (dashboard landing): the clans the person manages, belongs to
 * or plays for as a mercenary, as tiles in the style of the settings
 * overview. Managed clans without the bot are listed last with the invite.
 */
export function ClanList({
    locale,
    dictionary,
    sections,
    inviteRoleHierarchyByGuildId,
}: {
    locale: Locale
    dictionary: Dictionary
    sections: ClanListSection[]
    /** Managed clans whose bot invite should mention the role order. */
    inviteRoleHierarchyByGuildId: ReadonlyMap<string, boolean>
}) {
    const titles = {
        managed: dictionary.dashboard.managedServers,
        member: dictionary.dashboard.memberServers,
        mercenary: dictionary.dashboard.mercenaryServers,
    }
    const visible = sections.filter((section) => section.guilds.length > 0)
    const missingBot = sections.some(
        (section) =>
            section.id === "managed" &&
            section.guilds.some((guild) => !guild.botInside)
    )

    return (
        <>
            <PageHeader
                title={dictionary.dashboard.title}
                description={dictionary.dashboard.description}
            />
            <div className="flex flex-col gap-7 px-4 lg:px-6">
                {visible.length === 0 ? (
                    <EmptyState
                        icon={Users}
                        title={dictionary.dashboard.noServerTitle}
                        description={dictionary.dashboard.noServerDescription}
                        actions={
                            <Button
                                asChild
                                variant="outline"
                                className="rounded-lg"
                            >
                                <Link href="/wiki/discord-bot-setup">
                                    <BookOpen className="size-4" />
                                    {dictionary.dashboard.noServerSetupGuide}
                                </Link>
                            </Button>
                        }
                    />
                ) : null}
                {missingBot ? (
                    <p
                        role="status"
                        className="border-status-warning-border bg-status-warning-muted flex items-start gap-2 rounded-[10px] border px-3 py-2.5 text-[13px] leading-[18px]"
                    >
                        <TriangleAlert
                            aria-hidden="true"
                            className="text-status-warning mt-px size-4 shrink-0"
                        />
                        {dictionary.dashboard.inviteBotHint}
                    </p>
                ) : null}
                {visible.map((section) => (
                    <section
                        key={section.id}
                        aria-labelledby={`clans-${section.id}`}
                        className="flex flex-col gap-3"
                    >
                        <h2
                            id={`clans-${section.id}`}
                            className="text-base font-semibold"
                        >
                            {titles[section.id]}
                            <span className="text-muted-foreground ml-2 text-[13px] font-normal">
                                {section.guilds.length}
                            </span>
                        </h2>
                        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {section.guilds.map((guild) => (
                                <li key={guild.id} className="grid">
                                    <ServerCard
                                        locale={locale}
                                        guild={guild}
                                        dictionary={dictionary}
                                        canInviteBot={section.id === "managed"}
                                        inviteRoleHierarchyRelevant={
                                            inviteRoleHierarchyByGuildId.get(
                                                guild.id
                                            ) ?? false
                                        }
                                    />
                                </li>
                            ))}
                        </ul>
                    </section>
                ))}
            </div>
        </>
    )
}
