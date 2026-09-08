import { Github } from "lucide-react"
import Link from "next/link"

import { LocaleSwitcher } from "@/components/app/locale-switcher"
import { ThemeSwitcher } from "@/components/app/theme-switcher"
import { getDictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import type { Locale } from "@/i18n/config"
import { Logo } from "@/components/logo"

const githubHref = "https://github.com/ninjonik/logi"

export function PublicSiteShell({
    children,
    locale,
}: {
    children: React.ReactNode
    locale: Locale
}) {
    const dictionary = getDictionary(locale)

    return (
        <div className="bg-background text-foreground flex min-h-dvh flex-col">
            <header className="bg-background/90 sticky top-0 z-30 border-b backdrop-blur">
                <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
                    <Link
                        href={`/${locale}`}
                        className="inline-flex items-center gap-2.5 text-sm font-semibold tracking-wide"
                    >
                        <span className="bg-card flex size-9 items-center justify-center rounded-lg border">
                            <Logo size={19} />
                        </span>
                        {dictionary.app.name}
                    </Link>
                    <nav
                        aria-label="Main navigation"
                        className="text-muted-foreground hidden items-center gap-5 text-sm md:flex"
                    >
                        <Link
                            href={`/${locale}/community`}
                            className="hover:text-foreground transition-colors"
                        >
                            {dictionary.home.community}
                        </Link>
                        <Link
                            href={`/${locale}/competitions`}
                            className="hover:text-foreground transition-colors"
                        >
                            {dictionary.home.competitions}
                        </Link>
                    </nav>
                    <div className="flex items-center gap-2">
                        <ThemeSwitcher />
                        <LocaleSwitcher
                            locale={locale}
                            dictionary={dictionary}
                            compact
                        />
                        <Button asChild size="sm">
                            <Link href={`/${locale}/dashboard`}>
                                {dictionary.home.openApp}
                            </Link>
                        </Button>
                    </div>
                </div>
            </header>
            {children}
            <footer className="bg-background border-t">
                <div className="text-muted-foreground mx-auto flex min-h-14 w-full max-w-6xl flex-wrap items-center justify-between gap-x-5 gap-y-2 px-4 py-3 text-xs sm:px-6 lg:px-8">
                    <span>
                        &copy; {new Date().getFullYear()} {dictionary.app.name}
                    </span>
                    <div className="flex items-center gap-4">
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
    className = "max-w-6xl",
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
