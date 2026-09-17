import { redirect } from "next/navigation"
import type { Metadata } from "next"

import {
    PublicPage,
    PublicSiteShell,
} from "@/components/public/public-site-shell"
import { DiscordSignInButton } from "@/components/auth/discord-sign-in-button"
import { sanitizeLocalRedirect } from "@/lib/local-redirect"
import { Card, CardContent } from "@/components/ui/card"
import { getDictionary } from "@/i18n/dictionaries"
import { getCurrentPlayer } from "@/lib/auth"
import { Logo } from "@/components/logo"
import { isLocale } from "@/i18n/config"

export const metadata: Metadata = {
    title: "Sign in | Logi",
    description: "Sign in to continue to Logi.",
}

export default async function LoginPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string }>
    searchParams: Promise<{ redirectTo?: string }>
}) {
    const { locale } = await params
    const safeLocale = isLocale(locale) ? locale : "en"
    const { redirectTo: requestedRedirect } = await searchParams
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
                <Card className="w-full max-w-sm rounded-2xl border-white/10 bg-white/6 text-white shadow-2xl shadow-black/30 backdrop-blur-xl">
                    <CardContent className="flex flex-col items-center gap-7 p-8 text-center">
                        <div className="flex size-28 items-center justify-center rounded-2xl border border-white/10 bg-black/20">
                            <Logo size={64} />
                        </div>
                        <div className="w-full space-y-3">
                            <h1 className="text-2xl font-semibold">
                                {dictionary.app.name}
                            </h1>
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
