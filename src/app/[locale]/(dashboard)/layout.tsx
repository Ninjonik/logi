import { DashboardPageLoading } from "@/components/app/dashboard-page-loading"
import { DashboardShell } from "@/components/app/dashboard-shell"
import { isLocale, type Locale } from "@/i18n/config"
import { getDictionary } from "@/i18n/dictionaries"
import { getCurrentPlayer } from "@/lib/auth"
import { redirect } from "next/navigation"
import { connection } from "next/server"
import { Suspense } from "react"

export default async function DashboardLayout({
    children,
    params,
}: {
    children: React.ReactNode
    params: Promise<{ locale: string }>
}) {
    await connection()

    const { locale } = await params
    const safeLocale = (isLocale(locale) ? locale : "en") as Locale
    const dictionary = getDictionary(safeLocale)
    const user = await getCurrentPlayer()
    if (!user) {
        redirect(`/${safeLocale}/login`)
    }
    return (
        <Suspense fallback={<DashboardPageLoading />}>
            <DashboardShell
                dictionary={dictionary}
                locale={safeLocale}
                user={user}
            >
                {children}
            </DashboardShell>
        </Suspense>
    )
}
