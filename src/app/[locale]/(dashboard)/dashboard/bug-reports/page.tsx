import { bugReportAccess, listBugReports } from "@/lib/gateways/bug-reports"
import { BugReportInbox } from "@/components/app/bug-report-inbox"
import { getBugReportMessages } from "@/i18n/messages/bug-reports"
import { PageHeader } from "@/components/app/page-header"
import { redirect } from "next/navigation"
import { isLocale } from "@/i18n/config"

export default async function BugReportsPage({
    params,
}: {
    params: Promise<{ locale: string }>
}) {
    const { locale: raw } = await params
    const locale = isLocale(raw) ? raw : "en"
    if (!(await bugReportAccess(true))) redirect(`/${locale}/dashboard`)
    const t = getBugReportMessages(locale)
    const initial = await listBugReports()
    return (
        <>
            <PageHeader title={t.inbox} description={t.inboxIntro} />
            <div className="px-4 pb-8 lg:px-6">
                <BugReportInbox locale={locale} initial={initial} />
            </div>
        </>
    )
}
