import { getCurrentPlayer, getVisibleGuildsForLoggedInUser } from "@/lib/auth"
import { getBugReportMessages } from "@/i18n/messages/bug-reports"
import { BugReportForm } from "@/components/app/bug-report-form"
import { redirectToPageLogin } from "@/lib/require-page-login"
import { PageHeader } from "@/components/app/page-header"
import { isLocale } from "@/i18n/config"

export default async function ReportBugPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string }>
    searchParams: Promise<{ workspace?: string }>
}) {
    const { locale: raw } = await params
    const locale = isLocale(raw) ? raw : "en"
    if (!(await getCurrentPlayer()))
        return await redirectToPageLogin(`/${locale}/dashboard/report-bug`)
    const t = getBugReportMessages(locale)
    const servers = await getVisibleGuildsForLoggedInUser()
    const { workspace } = await searchParams
    const selected = servers.find(
        (server) => server.id === workspace || server.discordId === workspace
    )
    return (
        <>
            <PageHeader title={t.report} description={t.intro} />
            <div className="px-4 pb-8 lg:px-6">
                <BugReportForm
                    locale={locale}
                    servers={servers.map((server) => ({
                        id: server.discordId,
                        name: server.name,
                    }))}
                    initialServer={
                        selected
                            ? `${selected.name} (${selected.discordId})`
                            : ""
                    }
                />
            </div>
        </>
    )
}
