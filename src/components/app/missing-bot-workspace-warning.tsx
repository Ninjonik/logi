"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { AlertTriangle, Bot } from "lucide-react"

import { RefreshBotStatusButton } from "@/components/app/refresh-bot-status-button"
import { BotInviteButton } from "@/components/app/bot-invite-button"
import type { Dictionary } from "@/i18n/dictionaries"
import type { Guild } from "@/types/domain"

export function MissingBotWorkspaceWarning({
    dictionary,
    inviteUrlByGuildId,
    servers,
}: {
    dictionary: Dictionary
    inviteUrlByGuildId: Record<string, string>
    servers: Guild[]
}) {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const pathServerId = pathname?.match(/\/servers\/([^/]+)/)?.[1]
    const selectedServerId = pathServerId ?? searchParams.get("workspace")
    const server = selectedServerId
        ? servers.find((candidate) => candidate.id === selectedServerId)
        : undefined

    if (!server || server.botInside) {
        return null
    }

    const inviteUrl = inviteUrlByGuildId[server.id]

    return (
        <section
            className="mx-4 rounded-2xl border-2 border-amber-500/60 bg-amber-500/15 p-5 shadow-lg sm:mx-6 sm:p-6"
            role="alert"
        >
            <div className="flex gap-4">
                <AlertTriangle className="mt-0.5 size-7 shrink-0 text-amber-700 dark:text-amber-300" />
                <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-bold sm:text-xl">
                        {dictionary.dashboard.botMissingWorkspaceTitle.replace(
                            "{workspace}",
                            server.name
                        )}
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 sm:text-base">
                        {dictionary.dashboard.botMissingWorkspaceDescription}
                    </p>
                    <p className="mt-2 text-sm font-medium">
                        {dictionary.dashboard.botMissingWorkspacePermissions}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                        {inviteUrl ? (
                            <BotInviteButton
                                dictionary={dictionary}
                                inviteUrl={inviteUrl}
                                roleHierarchyRelevant
                                className="rounded-xl"
                            >
                                <>
                                    <Bot className="size-4" />
                                    {dictionary.dashboard.inviteBot}
                                </>
                            </BotInviteButton>
                        ) : null}
                        <RefreshBotStatusButton dictionary={dictionary} />
                    </div>
                </div>
            </div>
        </section>
    )
}
