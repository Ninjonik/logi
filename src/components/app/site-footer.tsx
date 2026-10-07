import { RestartTourButton } from "@/components/app/restart-tour-button"
import { LogiStatusLink } from "@/components/app/logi-status-link"
import type { Dictionary } from "@/i18n/dictionaries"
import type { LogiStatus } from "@/lib/logi-status"
import { getDiscordSupportUrl } from "@/lib/env"
import type { Locale } from "@/i18n/config"
import { SiDiscord } from "react-icons/si"
import Link from "next/link"

/**
 * The dashboard footer: service status, help and the desktop app. The tour
 * and the wiki live here since the title bar only carries navigation.
 */
export function SiteFooter({
    dictionary,
    status,
    locale,
}: {
    dictionary: Dictionary
    status: LogiStatus
    locale: Locale
}) {
    return (
        <footer className="bg-background min-h-(--footer-height) border-t">
            <div className="text-muted-foreground flex min-h-(--footer-height) flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-4 py-2 text-xs lg:px-6">
                <div>
                    &copy; {dictionary.app.name} {new Date().getFullYear()}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <LogiStatusLink status={status} />
                    <RestartTourButton className="hover:text-foreground cursor-pointer transition-colors">
                        {dictionary.publicNavigation.restartTour}
                    </RestartTourButton>
                    <Link
                        href={`/${locale}/dashboard/logicomms`}
                        className="hover:text-foreground transition-colors"
                    >
                        {dictionary.sidebar.logiComms}
                    </Link>
                    <a
                        href={getDiscordSupportUrl()}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-foreground inline-flex items-center gap-1"
                    >
                        <SiDiscord aria-hidden="true" className="size-3" />
                        {dictionary.publicNavigation.discordSupport}
                    </a>
                    <Link
                        href="/wiki"
                        className="hover:text-foreground transition-colors"
                    >
                        {dictionary.publicNavigation.wiki}
                    </Link>
                    <span>
                        {process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0"}
                    </span>
                    <a
                        href="https://github.com/ninjonik/logi"
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-foreground transition-colors"
                        aria-label="GitHub Repository"
                    >
                        <svg
                            role="img"
                            viewBox="0 0 24 24"
                            className="h-4 w-4 fill-current"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <title>GitHub</title>
                            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                        </svg>
                    </a>
                </div>
            </div>
        </footer>
    )
}
