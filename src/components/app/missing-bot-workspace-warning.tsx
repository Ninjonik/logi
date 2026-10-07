"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { AlertTriangle, Bot } from "lucide-react"

import { RefreshBotStatusButton } from "@/components/app/refresh-bot-status-button"
import { BotInviteButton } from "@/components/app/bot-invite-button"
import { canAdminWorkspace } from "@/lib/workspace-admin"
import type { Dictionary } from "@/i18n/dictionaries"
import type { Guild } from "@/types/domain"

export function MissingBotWorkspaceWarning({
    dictionary,
    inviteUrlByGuildId,
    servers,
    userDiscordId,
}: {
    dictionary: Dictionary
    inviteUrlByGuildId: Record<string, string>
    servers: Guild[]
    userDiscordId: string
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

    // Only clan admins can add the bot; members are told to ask one.
    const canInvite = canAdminWorkspace(server, userDiscordId)
    const inviteUrl = canInvite ? inviteUrlByGuildId[server.id] : undefined

    return (
        <section
            className="border-status-warning-border bg-status-warning-muted mx-4 rounded-[14px] border p-4 sm:p-5 lg:mx-6"
            role="alert"
        >
            <div className="flex gap-3">
                <AlertTriangle
                    aria-hidden="true"
                    className="text-status-warning mt-0.5 size-5 shrink-0"
                />
                <div className="min-w-0 flex-1">
                    <h2 className="text-base font-semibold">
                        {dictionary.dashboard.botMissingWorkspaceTitle.replace(
                            "{workspace}",
                            server.name
                        )}
                    </h2>
                    <p className="mt-1 max-w-3xl text-sm leading-5">
                        {canInvite
                            ? dictionary.dashboard
                                  .botMissingWorkspaceDescription
                            : dictionary.dashboard.botMissingMemberDescription}
                    </p>
                    <p className="mt-2 text-sm font-medium">
                        {canInvite
                            ? dictionary.dashboard
                                  .botMissingWorkspacePermissions
                            : dictionary.dashboard.askAdminForBot}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {inviteUrl ? (
                            <BotInviteButton
                                dictionary={dictionary}
                                inviteUrl={inviteUrl}
                                roleHierarchyRelevant
                                className="h-8 rounded-lg px-3 text-[13px]"
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
