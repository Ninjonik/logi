"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import { RefreshPerformanceHistoryButton } from "@/components/app/refresh-performance-history-button"
import { MigrateMembershipStatusButton } from "@/components/app/migrate-membership-status-button"
import { LinkMissingDiscordIdsButton } from "@/components/app/link-missing-discord-ids-button"
import { ImportDiscordMembersButton } from "@/components/app/import-discord-members-button"
import { AutoLinkPlatformIdsButton } from "@/components/app/auto-link-platform-ids-button"
import { DedupePlayerStatsButton } from "@/components/app/dedupe-player-stats-button"
import { WardogsLeaguePreview } from "@/components/app/wardogs-league-preview"
import { LeagueTrackingForm } from "@/components/app/league-tracking-form"
import { ImportEventsButton } from "@/components/app/import-events-button"
import { HelperDataActions } from "@/components/app/helper-data-actions"
import { DEFAULT_GAME_ID, type GameId } from "@/domain/games/game"
import { WebhookManager } from "@/components/app/webhook-manager"
import type { Dictionary } from "@/i18n/dictionaries"
import type { ReactNode } from "react"

const sectionIds = ["imports", "helper-data", "webhooks"] as const

export function SystemMaintenanceSections({
    serverId,
    gameId,
    enabledGames,
    defaultRoleId,
    dictionary,
    additionalSections = [],
}: {
    serverId: string
    gameId: GameId
    enabledGames?: GameId[]
    defaultRoleId?: string
    dictionary: Dictionary
    additionalSections?: Array<{
        id: string
        title: string
        description: string
        content: ReactNode
    }>
}) {
    const [openSections, setOpenSections] = useState<string[]>([])
    const isHellLetLoose = gameId === DEFAULT_GAME_ID

    useEffect(() => {
        const openLinkedSection = () => {
            const sectionId = window.location.hash.slice(1)
            if (sectionIds.includes(sectionId as (typeof sectionIds)[number])) {
                setOpenSections([sectionId])
                document.getElementById(sectionId)?.scrollIntoView({
                    block: "start",
                })
            }
        }

        openLinkedSection()
        window.addEventListener("hashchange", openLinkedSection)
        return () => window.removeEventListener("hashchange", openLinkedSection)
    }, [])

    return (
        <Accordion
            type="multiple"
            value={openSections}
            onValueChange={setOpenSections}
            className="space-y-4"
        >
            <AccordionItem
                id="imports"
                value="imports"
                className="border-border/60 scroll-mt-6 rounded-2xl border px-5"
            >
                <AccordionTrigger className="hover:no-underline">
                    <span>
                        <span className="block text-base font-semibold">
                            {dictionary.clan.importsTitle}
                        </span>
                        <span className="text-muted-foreground mt-1 block text-sm font-normal">
                            {dictionary.clan.importsBody}
                        </span>
                    </span>
                </AccordionTrigger>
                <AccordionContent className="pt-3">
                    <div className="flex flex-wrap gap-3">
                        {isHellLetLoose ? (
                            <ImportEventsButton
                                serverId={serverId}
                                dictionary={dictionary}
                                gameId={gameId}
                            />
                        ) : null}
                        <ImportDiscordMembersButton
                            serverId={serverId}
                            dictionary={dictionary}
                            defaultRoleId={defaultRoleId}
                            gameId={gameId}
                            enabledGames={enabledGames}
                        />
                        {isHellLetLoose ? (
                            <AutoLinkPlatformIdsButton
                                serverId={serverId}
                                dictionary={dictionary}
                                gameId={gameId}
                            />
                        ) : null}
                        <LinkMissingDiscordIdsButton
                            serverId={serverId}
                            dictionary={dictionary}
                            defaultRoleId={defaultRoleId}
                            gameId={gameId}
                        />
                        <MigrateMembershipStatusButton
                            serverId={serverId}
                            dictionary={dictionary}
                            defaultRoleId={defaultRoleId}
                            gameId={gameId}
                        />
                        {isHellLetLoose ? (
                            <DedupePlayerStatsButton
                                serverId={serverId}
                                dictionary={dictionary}
                                gameId={gameId}
                            />
                        ) : null}
                        <RefreshPerformanceHistoryButton
                            serverId={serverId}
                            dictionary={dictionary}
                            gameId={gameId}
                        />
                    </div>
                    {gameId === "wardogs" && (
                        <>
                            <LeagueTrackingForm serverId={serverId} />
                            <WardogsLeaguePreview serverId={serverId} />
                        </>
                    )}
                </AccordionContent>
            </AccordionItem>

            <AccordionItem
                id="helper-data"
                value="helper-data"
                className="border-border/60 scroll-mt-6 rounded-2xl border px-5"
            >
                <AccordionTrigger className="hover:no-underline">
                    <span>
                        <span className="block text-base font-semibold">
                            {dictionary.clan.helperDataTitle}
                        </span>
                        <span className="text-muted-foreground mt-1 block text-sm font-normal">
                            {dictionary.clan.helperDataBody}
                        </span>
                    </span>
                </AccordionTrigger>
                <AccordionContent className="pt-3">
                    <HelperDataActions
                        serverId={serverId}
                        dictionary={dictionary}
                    />
                </AccordionContent>
            </AccordionItem>

            <AccordionItem
                id="webhooks"
                value="webhooks"
                className="border-border/60 scroll-mt-6 rounded-2xl border px-5"
            >
                <AccordionTrigger className="hover:no-underline">
                    <span>
                        <span className="block text-base font-semibold">
                            {dictionary.clan.webhooksTitle}
                        </span>
                        <span className="text-muted-foreground mt-1 block text-sm font-normal">
                            {dictionary.clan.webhooksBody}
                        </span>
                    </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-3">
                    <Link
                        href="/wiki/configuration/settings#webhooks"
                        className="border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 inline-flex rounded-lg border px-3 py-2 text-sm font-medium"
                    >
                        {dictionary.clan.webhookDocumentation}
                    </Link>
                    <WebhookManager
                        serverId={serverId}
                        dictionary={dictionary}
                    />
                </AccordionContent>
            </AccordionItem>
            {additionalSections.map((section) => (
                <AccordionItem
                    key={section.id}
                    id={section.id}
                    value={section.id}
                    className="border-border/60 scroll-mt-6 rounded-2xl border px-5"
                >
                    <AccordionTrigger className="hover:no-underline">
                        <span>
                            <span className="block text-base font-semibold">
                                {section.title}
                            </span>
                            <span className="text-muted-foreground mt-1 block text-sm font-normal">
                                {section.description}
                            </span>
                        </span>
                    </AccordionTrigger>
                    <AccordionContent className="pt-3">
                        {section.content}
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
    )
}
