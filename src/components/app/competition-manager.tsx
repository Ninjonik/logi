"use client"

import {
    sendCompetitionCommand,
    type CompetitionCommandResult,
} from "@/lib/competitions/competition-client"
import { CompetitionRegistrations } from "@/components/app/competition-registrations"
import { CompetitionDetailsForm } from "@/components/app/competition-details-form"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CompetitionDivisions } from "@/components/app/competition-divisions"
import type { CompetitionAdminView } from "@/domain/competitions/admin-view"
import { CompetitionFixtures } from "@/components/app/competition-fixtures"
import type { CompetitionCommand } from "@/lib/api/competition-admin-route"
import { ConfigNotice } from "@/components/app/config-notice"
import { useCallback, useState, useTransition } from "react"
import type { Dictionary } from "@/i18n/dictionaries"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

const SECTIONS = ["details", "divisions", "teams", "fixtures"] as const
type Section = (typeof SECTIONS)[number]
const isSection = (value: string): value is Section =>
    (SECTIONS as readonly string[]).includes(value)

/** Runs one command, reports failures, and re-reads the page on success. */
export type RunCompetitionCommand = (
    command: CompetitionCommand,
    success?: string
) => Promise<CompetitionCommandResult>

/**
 * Global-administrator management of one competition: details and
 * visibility, divisions, team registrations and fixtures.
 */
export function CompetitionManager({
    view,
    dictionary,
    locale,
}: {
    view: CompetitionAdminView
    dictionary: Dictionary
    locale: string
}) {
    const t = dictionary.competitionAdmin
    const router = useRouter()
    const [busy, setBusy] = useState(false)
    const [refreshing, startRefresh] = useTransition()
    const run = useCallback<RunCompetitionCommand>(
        async (command, success) => {
            setBusy(true)
            try {
                const result = await sendCompetitionCommand(command)
                if (!result.ok) toast.error(t.errors[result.code])
                else {
                    if (success) toast.success(success)
                    startRefresh(() => router.refresh())
                }
                return result
            } finally {
                setBusy(false)
            }
        },
        [router, t]
    )
    const pending = busy || refreshing
    // A new competition starts with its divisions; a running one with fixtures.
    const [section, setSection] = useState<Section>(
        view.divisions.length === 0
            ? "divisions"
            : view.registrations.length === 0
              ? "teams"
              : "fixtures"
    )
    const shared = { view, dictionary, run, pending }

    return (
        <div className="space-y-6">
            {view.legacyRows ? (
                <ConfigNotice title={t.legacyTitle}>
                    {t.legacyDescription.replace(
                        "{count}",
                        String(view.legacyRows)
                    )}
                </ConfigNotice>
            ) : null}
            <Tabs
                value={section}
                onValueChange={(value) => {
                    if (isSection(value)) setSection(value)
                }}
                className="gap-4"
            >
                <TabsList aria-label={t.sectionsLabel} className="max-w-full">
                    <TabsTrigger value="details">{t.detailsTitle}</TabsTrigger>
                    <TabsTrigger value="divisions">
                        {t.divisionsTitle}
                    </TabsTrigger>
                    <TabsTrigger value="teams">{t.teamsTitle}</TabsTrigger>
                    <TabsTrigger value="fixtures">
                        {t.fixturesTitle}
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="details">
                    <CompetitionDetailsForm {...shared} locale={locale} />
                </TabsContent>
                <TabsContent value="divisions">
                    <CompetitionDivisions {...shared} />
                </TabsContent>
                <TabsContent value="teams">
                    <CompetitionRegistrations {...shared} />
                </TabsContent>
                <TabsContent value="fixtures">
                    <CompetitionFixtures {...shared} locale={locale} />
                </TabsContent>
            </Tabs>
        </div>
    )
}

/** Props every management section receives. */
export type CompetitionSectionProps = {
    view: CompetitionAdminView
    dictionary: Dictionary
    run: RunCompetitionCommand
    pending: boolean
}
