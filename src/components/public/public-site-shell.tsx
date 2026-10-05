import { BookOpen, Github } from "lucide-react"
import { SiDiscord } from "react-icons/si"
import Link from "next/link"

import { LogiStatusLink } from "@/components/app/logi-status-link"
import { LocaleSwitcher } from "@/components/app/locale-switcher"
import { ThemeSwitcher } from "@/components/app/theme-switcher"
import { getDictionary } from "@/i18n/dictionaries"
import { getLogiStatus } from "@/lib/logi-status"
import { getDiscordSupportUrl } from "@/lib/env"
import { Button } from "@/components/ui/button"
import type { Locale } from "@/i18n/config"
import { Logo } from "@/components/logo"

const githubHref = "https://github.com/ninjonik/logi"

/** Public sections with their own navigation entry (designs J1, J2). */
export type PublicSection = "community" | "competitions" | "wiki"

type NavigationItem = { href: string; label: string; section: PublicSection }

function NavigationLink({
    item,
    className,
    current,
}: {
    item: NavigationItem
    className: string
    current?: PublicSection
}) {
    return (
        <Link
            href={item.href}
            aria-current={item.section === current ? "page" : undefined}
            className={className}
        >
            {item.label}
        </Link>
    )
}

export async function PublicSiteShell({
    children,
    locale,
    dashboardHref,
    current,
}: {
    children: React.ReactNode
    locale: Locale
    dashboardHref?: string
    /** The section the page belongs to, marked in the navigation. */
    current?: PublicSection
}) {
    const dictionary = getDictionary(locale)
    const status = await getLogiStatus()
    const discordSupportUrl = getDiscordSupportUrl()
    const navigation: NavigationItem[] = [
        {
            href: `/${locale}/community`,
            label: dictionary.publicProfiles.communityTitle,
            section: "community",
        },
        {
            href: `/${locale}/competitions`,
            label: dictionary.competition.title,
            section: "competitions",
        },
        {
            href: "/wiki",
            label: dictionary.publicNavigation.wiki,
            section: "wiki",
        },
    ]
    const navLinkClass =
        "text-muted-foreground hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground rounded-lg px-2.5 py-1.5 whitespace-nowrap transition-colors aria-[current=page]:font-semibold"

    return (
        <div className="bg-background text-foreground flex min-h-dvh flex-col">
            <header className="bg-background/90 sticky top-0 z-30 border-b backdrop-blur">
                <div className="mx-auto flex h-16 w-full max-w-[75rem] items-center gap-4 px-4 sm:px-6 lg:gap-6 lg:px-8">
                    <Link
                        href={`/${locale}`}
                        aria-label={dictionary.app.name}
                        className="inline-flex shrink-0 items-center gap-2 text-base font-bold"
                    >
                        <span className="bg-card flex size-8 items-center justify-center rounded-lg border">
                            <Logo size={18} />
                        </span>
                        <span aria-hidden="true">{dictionary.app.name}</span>
                    </Link>
                    {/* Community, Competitions and Wiki (designs J1, J2); Discord support is in the footer. */}
                    <nav
                        aria-label="Main navigation"
                        className="hidden flex-1 items-center gap-1 text-sm md:flex"
                    >
                        {navigation.map((item) => (
                            <NavigationLink
                                key={item.href}
                                item={item}
                                current={current}
                                className={navLinkClass}
                            />
                        ))}
                    </nav>
                    <div className="ml-auto flex items-center gap-2">
                        <span className="hidden sm:inline-flex">
                            <LogiStatusLink
                                status={status}
                                showLabel={false}
                                locale={locale}
                            />
                        </span>
                        <ThemeSwitcher dictionary={dictionary} />
                        <LocaleSwitcher
                            locale={locale}
                            dictionary={dictionary}
                            compact
                        />
                        <Button asChild size="sm">
                            <Link
                                href={dashboardHref ?? `/${locale}/dashboard`}
                            >
                                {dictionary.home.openApp}
                            </Link>
                        </Button>
                    </div>
                </div>
                {/* The menu stays visible on a phone, as its own row (design J1). */}
                <nav
                    aria-label="Main navigation"
                    className="mx-auto flex w-full max-w-[75rem] items-center gap-1 overflow-x-auto px-4 pb-2 text-sm sm:px-6 md:hidden"
                >
                    {navigation.map((item) => (
                        <NavigationLink
                            key={item.href}
                            item={item}
                            current={current}
                            className={navLinkClass}
                        />
                    ))}
                </nav>
            </header>
            {children}
            <footer className="bg-background border-t">
                <div className="text-muted-foreground mx-auto flex min-h-14 w-full max-w-[75rem] flex-wrap items-center justify-between gap-x-5 gap-y-2 px-4 py-3 text-xs sm:px-6 lg:px-8">
                    <span>
                        &copy; {new Date().getFullYear()} {dictionary.app.name}
                    </span>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <LogiStatusLink status={status} locale={locale} />
                        <a
                            href={discordSupportUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-foreground inline-flex items-center gap-1.5"
                        >
                            <SiDiscord
                                aria-hidden="true"
                                className="size-3.5"
                            />
                            {dictionary.publicNavigation.discordSupport}
                        </a>
                        <Link
                            href={`/${locale}/privacy-policy`}
                            className="hover:text-foreground"
                        >
                            {dictionary.publicNavigation.privacy}
                        </Link>
                        <Link
                            href={`/${locale}/gdpr`}
                            className="hover:text-foreground"
                        >
                            {dictionary.publicNavigation.gdpr}
                        </Link>
                        <Link
                            href={`/${locale}/tos`}
                            className="hover:text-foreground"
                        >
                            {dictionary.publicNavigation.terms}
                        </Link>
                        <Link
                            href="/wiki"
                            className="hover:text-foreground inline-flex items-center gap-1.5"
                        >
                            <BookOpen className="size-3.5" />
                            {dictionary.publicNavigation.wiki}
                        </Link>
                        <a
                            href={githubHref}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-foreground inline-flex items-center gap-1.5"
                        >
                            <Github className="size-3.5" />
                            GitHub
                        </a>
                    </div>
                </div>
            </footer>
        </div>
    )
}

export function PublicPage({
    children,
    className = "max-w-[75rem]",
}: {
    children: React.ReactNode
    className?: string
}) {
    return (
        <main className="flex flex-1">
            <div
                className={`mx-auto w-full ${className} px-4 py-8 sm:px-6 sm:py-10 lg:px-8`}
            >
                {children}
            </div>
        </main>
    )
}
