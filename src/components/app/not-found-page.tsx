import { BookOpen, Compass, SearchX } from "lucide-react"
import { getLocale } from "next-intl/server"
import Link from "next/link"

import {
    PublicPage,
    PublicSiteShell,
} from "@/components/public/public-site-shell"
import { CLAN_LIST_QUERY } from "@/domain/workspaces/dashboard-landing"
import { defaultLocale, isLocale, type Locale } from "@/i18n/config"
import { EmptyState } from "@/components/app/empty-state"
import { getDictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"

/** The request's locale; unmatched URLs still carry it from the i18n proxy. */
async function requestLocale(): Promise<Locale> {
    const locale = await getLocale().catch(() => defaultLocale)
    return isLocale(locale) ? locale : defaultLocale
}

/** 404 for public pages and unknown addresses, inside the public site shell. */
export async function PublicNotFoundPage({
    locale: fixedLocale,
}: {
    /** Set above the `[locale]` layout, where reading the request would make every page dynamic. */
    locale?: Locale
} = {}) {
    const locale = fixedLocale ?? (await requestLocale())
    const dictionary = getDictionary(locale)
    const t = dictionary.appStates
    return (
        <PublicSiteShell locale={locale}>
            <PublicPage className="max-w-2xl">
                <p className="text-muted-foreground mb-3 font-mono text-sm">
                    404
                </p>
                <EmptyState
                    headingLevel="h1"
                    icon={Compass}
                    title={t.notFoundTitle}
                    description={t.notFoundDescription}
                    actions={
                        <>
                            <Button asChild className="rounded-lg">
                                <Link href={`/${locale}`}>{t.goHome}</Link>
                            </Button>
                            <Button
                                asChild
                                variant="outline"
                                className="rounded-lg"
                            >
                                <Link href={`/${locale}/dashboard`}>
                                    {dictionary.home.openApp}
                                </Link>
                            </Button>
                            <Button
                                asChild
                                variant="ghost"
                                className="rounded-lg"
                            >
                                <Link href="/wiki">
                                    <BookOpen className="size-4" />
                                    {dictionary.publicNavigation.wiki}
                                </Link>
                            </Button>
                        </>
                    }
                />
            </PublicPage>
        </PublicSiteShell>
    )
}

/** 404 inside the dashboard: the sidebar stays, the way back is the clan list. */
export async function DashboardNotFoundPage() {
    const locale = await requestLocale()
    const t = getDictionary(locale).appStates
    return (
        <div className="px-4 py-2 lg:px-6">
            <EmptyState
                headingLevel="h1"
                icon={SearchX}
                className="mx-auto max-w-2xl"
                title={t.notFoundTitle}
                description={t.notFoundDashboardDescription}
                actions={
                    <Button asChild className="rounded-lg">
                        <Link
                            href={`/${locale}/dashboard?${CLAN_LIST_QUERY.key}=${CLAN_LIST_QUERY.value}`}
                        >
                            {t.backToClans}
                        </Link>
                    </Button>
                }
            />
        </div>
    )
}
