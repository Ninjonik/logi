import {
    PublicPage,
    PublicSiteShell,
} from "@/components/public/public-site-shell"
import { DiscordSignInButton } from "@/components/auth/discord-sign-in-button"
import type { PublicCompetition } from "@/domain/competitions/competition"
import { readLeagueAccount } from "@/lib/gateways/league-portal"
import { getLeagueMessages } from "@/i18n/messages/leagues"
import { LeagueAccount } from "./league-account"
import { Button } from "@/components/ui/button"
import type { Locale } from "@/i18n/config"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
export async function LeagueJoinPage({
    locale,
    competition,
    invite,
}: {
    locale: Locale
    competition: PublicCompetition | null
    invite?: string
}) {
    const t = getLeagueMessages(locale),
        view = await readLeagueAccount(competition?.id ?? null)
    const returnTo = competition
        ? `/${locale}/leagues/${competition.slug}/join`
        : `/${locale}/league-teams${invite ? `?invite=${encodeURIComponent(invite)}` : ""}`
    return (
        <PublicSiteShell locale={locale} current="leagues">
            <PublicPage>
                <div className="space-y-8">
                    <Link
                        href={
                            competition
                                ? `/${locale}/leagues/${competition.slug}`
                                : `/${locale}/leagues`
                        }
                        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm"
                    >
                        <ArrowLeft className="size-4" />
                        {competition ? t.back : t.browse}
                    </Link>
                    <header className="max-w-3xl">
                        <h1 className="text-3xl font-semibold tracking-tight">
                            {competition ? t.joinTitle : t.accountTitle}
                        </h1>
                        <p className="text-muted-foreground mt-3 leading-7">
                            {t.setupDescription}
                        </p>
                    </header>
                    {view?.organiser && competition && (
                        <Button asChild variant="outline">
                            <Link
                                href={`/${locale}/dashboard/competitions/${competition.id}`}
                            >
                                {t.registrations}
                            </Link>
                        </Button>
                    )}
                    {view ? (
                        <LeagueAccount
                            view={view}
                            competition={competition}
                            locale={locale}
                            invite={invite}
                        />
                    ) : (
                        <section className="bg-muted/20 max-w-xl rounded-2xl border p-6 sm:p-8">
                            <h2 className="text-xl font-semibold">
                                {t.setupOne}
                            </h2>
                            <p className="text-muted-foreground mt-3 mb-6 text-sm leading-6">
                                {t.signInHint}
                            </p>
                            <DiscordSignInButton
                                redirectTo={returnTo}
                                label={t.signIn}
                            />
                        </section>
                    )}
                </div>
            </PublicPage>
        </PublicSiteShell>
    )
}
