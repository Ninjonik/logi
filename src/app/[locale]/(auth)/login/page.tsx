import { AlertTriangle } from "lucide-react"
import { redirect } from "next/navigation"
import type { Metadata } from "next"

import {
    PublicPage,
    PublicSiteShell,
} from "@/components/public/public-site-shell"
import { DiscordSignInButton } from "@/components/auth/discord-sign-in-button"
import { sanitizeLocalRedirect } from "@/lib/local-redirect"
import { Card, CardContent } from "@/components/ui/card"
import { parseLoginError } from "@/lib/login-redirect"
import { getDictionary } from "@/i18n/dictionaries"
import { getCurrentPlayer } from "@/lib/auth"
import { Logo } from "@/components/logo"
import { isLocale } from "@/i18n/config"

export const metadata: Metadata = {
    title: "Sign in",
    description: "Sign in to continue to Logi.",
    robots: { index: false, follow: false },
}

export default async function LoginPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string }>
    searchParams: Promise<{ redirectTo?: string; error?: string | string[] }>
}) {
    const { locale } = await params
    const safeLocale = isLocale(locale) ? locale : "en"
    const { redirectTo: requestedRedirect, error } = await searchParams
    const loginError = parseLoginError(error)
    const redirectTo = sanitizeLocalRedirect(
        requestedRedirect,
        `/${safeLocale}/dashboard`
    )
    const dictionary = getDictionary(safeLocale)
    if (await getCurrentPlayer()) {
        redirect(redirectTo)
    }

    return (
        <PublicSiteShell locale={safeLocale}>
            <PublicPage className="flex max-w-sm items-center">
                <Card className="border-border/60 bg-card text-card-foreground w-full max-w-sm rounded-2xl shadow-2xl shadow-black/10">
                    <CardContent className="flex flex-col items-center gap-7 p-8 text-center">
                        <div className="bg-muted flex size-28 items-center justify-center rounded-2xl border">
                            <Logo size={64} />
                        </div>
                        <div className="w-full space-y-3">
                            <h1 className="text-2xl font-semibold">
                                {dictionary.app.name}
                            </h1>
                            {loginError ? (
                                <div
                                    role="alert"
                                    className="border-destructive/40 bg-destructive/5 flex items-start gap-2 rounded-xl border p-3 text-left text-sm"
                                >
                                    <AlertTriangle
                                        className="text-destructive mt-0.5 size-4 shrink-0"
                                        aria-hidden
                                    />
                                    <span>
                                        <span className="block font-medium">
                                            {
                                                dictionary.publicSite.login
                                                    .errorTitle
                                            }
                                        </span>
                                        <span className="text-muted-foreground">
                                            {
                                                dictionary.publicSite.login
                                                    .errors[loginError]
                                            }
                                        </span>
                                    </span>
                                </div>
                            ) : null}
                            <DiscordSignInButton
                                redirectTo={redirectTo}
                                label={dictionary.auth.loginButton}
                            />
                        </div>
                    </CardContent>
                </Card>
            </PublicPage>
        </PublicSiteShell>
    )
}
