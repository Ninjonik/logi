import { PublicSiteShell } from "@/components/public/public-site-shell"
import { LandingPage } from "@/components/landing/landing-page"
import { defaultLocale, isLocale } from "@/i18n/config"
import { getDictionary } from "@/i18n/dictionaries"
import { getCurrentPlayer } from "@/lib/auth"

export default async function LocaleHomePage({
    params,
}: {
    params: Promise<{ locale: string }>
}) {
    const { locale } = await params
    const resolvedLocale = isLocale(locale) ? locale : defaultLocale
    const dictionary = getDictionary(resolvedLocale)
    const user = await getCurrentPlayer()

    return (
        <PublicSiteShell locale={resolvedLocale}>
            <LandingPage
                dictionary={dictionary}
                locale={resolvedLocale}
                signedIn={Boolean(user)}
                userName={user?.name}
            />
        </PublicSiteShell>
    )
}
