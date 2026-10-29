import { PublicSiteShell } from "@/components/public/public-site-shell"
import { getLatestLogiCommsWindowsDownload } from "@/lib/logicomms"
import { LandingPage } from "@/components/landing/landing-page"
import { defaultLocale, isLocale } from "@/i18n/config"
import { getDictionary } from "@/i18n/dictionaries"
import { getLocalizedCanonical } from "@/lib/seo"
import { getCurrentPlayer } from "@/lib/auth"
import "@/components/landing/landing.css"
import type { Metadata } from "next"

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>
}): Promise<Metadata> {
    const { locale } = (await params) ?? { locale: defaultLocale }
    const safeLocale = isLocale(locale) ? locale : defaultLocale
    const copy = getDictionary(safeLocale).home.landing
    return {
        title: { absolute: copy.metaTitle },
        description: copy.metaDescription,
        openGraph: { title: copy.metaTitle, description: copy.metaDescription },
        twitter: { title: copy.metaTitle, description: copy.metaDescription },
        alternates: getLocalizedCanonical(safeLocale, ""),
    }
}

export default async function LocaleHomePage({
    params,
}: {
    params: Promise<{ locale: string }>
}) {
    const { locale } = await params
    const resolvedLocale = isLocale(locale) ? locale : defaultLocale
    const dictionary = getDictionary(resolvedLocale)
    const [user, logicommsDownloadUrl] = await Promise.all([
        getCurrentPlayer(),
        getLatestLogiCommsWindowsDownload(),
    ])
    const dashboardHref = user?.defaultWorkspaceRecordId
        ? `/${resolvedLocale}/dashboard/servers/${user.defaultWorkspaceRecordId}`
        : undefined

    return (
        <PublicSiteShell locale={resolvedLocale} dashboardHref={dashboardHref}>
            <LandingPage
                dictionary={dictionary}
                locale={resolvedLocale}
                signedIn={Boolean(user)}
                userName={user?.name}
                dashboardHref={dashboardHref}
                logicommsDownloadUrl={logicommsDownloadUrl}
            />
        </PublicSiteShell>
    )
}
