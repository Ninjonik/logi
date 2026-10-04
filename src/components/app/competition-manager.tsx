"use client"

import {
    sendCompetitionCommand,
    type CompetitionCommandResult,
} from "@/lib/competitions/competition-client"
import { CompetitionRegistrations } from "@/components/app/competition-registrations"
import { CompetitionDetailsForm } from "@/components/app/competition-details-form"
import { CompetitionDivisions } from "@/components/app/competition-divisions"
import type { CompetitionAdminView } from "@/domain/competitions/admin-view"
import { CompetitionFixtures } from "@/components/app/competition-fixtures"
import type { CompetitionCommand } from "@/lib/api/competition-admin-route"
import { ConfigNotice } from "@/components/app/config-notice"
import { useCallback, useState, useTransition } from "react"
import type { Dictionary } from "@/i18n/dictionaries"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

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
            <CompetitionDetailsForm {...shared} locale={locale} />
            <CompetitionDivisions {...shared} />
            <CompetitionRegistrations {...shared} />
            <CompetitionFixtures {...shared} locale={locale} />
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
