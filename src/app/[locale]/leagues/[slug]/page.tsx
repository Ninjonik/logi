import {
    PublicPage,
    PublicSiteShell,
} from "@/components/public/public-site-shell"
import { PublicCompetitionView } from "@/components/public/public-competition-view"
import { getCompetitionClanLinks } from "@/lib/read-models/public-clan-page"
import { selectCompetitionView } from "@/domain/competitions/public-rounds"
import { getPublicCompetition } from "@/lib/read-models/competitions"
import { ArrowLeft, ArrowRight, Server } from "lucide-react"
import { getLeagueMessages } from "@/i18n/messages/leagues"
import { getDictionary } from "@/i18n/dictionaries"
import { getLocalizedCanonical } from "@/lib/seo"
import { requestTime } from "@/lib/request-time"
import { Button } from "@/components/ui/button"
import { notFound } from "next/navigation"
import { isLocale } from "@/i18n/config"
import type { Metadata } from "next"
import Link from "next/link"
type Props = {
    params: Promise<{ locale: string; slug: string }>
    searchParams: Promise<{ division?: string }>
}
export async function generateMetadata({
    params,
}: Pick<Props, "params">): Promise<Metadata> {
    const { locale, slug } = await params
    const safe = isLocale(locale) ? locale : "en"
    const competition = await getPublicCompetition(slug)
    return {
        title: competition
            ? `${competition.name} ${competition.season}`
            : getLeagueMessages(safe).title,
        alternates: getLocalizedCanonical(safe, `/leagues/${slug}`),
    }
}
export default async function LeaguePage({ params, searchParams }: Props) {
    const [{ locale, slug }, { division }] = await Promise.all([
        params,
        searchParams,
    ])
    const safe = isLocale(locale) ? locale : "en",
        t = getLeagueMessages(safe)
    const competition = await getPublicCompetition(slug)
    if (!competition) notFound()
    const policy = competition.registrationMode ?? "closed"
    return (
        <PublicSiteShell locale={safe} current="leagues">
            <PublicPage>
                <div className="space-y-8">
                    <Link
                        href={`/${safe}/leagues`}
                        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm"
                    >
                        <ArrowLeft className="size-4" />
                        {t.browse}
                    </Link>
                    <div className="bg-muted/20 flex flex-wrap items-center justify-between gap-4 rounded-xl border p-5">
                        <div>
                            <p className="font-semibold">{t[policy]}</p>
                            <p className="text-muted-foreground mt-1 text-sm">
                                {competition.minimumLinkedPlayers
                                    ? t.minimum.replace(
                                          "{count}",
                                          String(
                                              competition.minimumLinkedPlayers
                                          )
                                      )
                                    : t.noMinimum}
                            </p>
                        </div>
                        <Button
                            asChild
                            variant={
                                policy === "closed" ? "outline" : "default"
                            }
                        >
                            <Link href={`/${safe}/leagues/${slug}/join`}>
                                {policy === "closed" ? t.manage : t.register}
                                <ArrowRight className="size-4" />
                            </Link>
                        </Button>
                    </div>
                    <PublicCompetitionView
                        competition={competition}
                        view={selectCompetitionView(
                            competition.divisions,
                            typeof division === "string" ? division : undefined
                        )}
                        clanLinks={await getCompetitionClanLinks(slug)}
                        now={requestTime()}
                        locale={safe}
                        dictionary={getDictionary(safe)}
                        sectionPath="leagues"
                    />
                    <div className="rounded-xl border p-6">
                        <h2 className="flex items-center gap-2 font-semibold">
                            <Server className="size-4" />
                            {t.hostingTitle}
                        </h2>
                        <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-6">
                            {t.hostingText}
                        </p>
                    </div>
                </div>
            </PublicPage>
        </PublicSiteShell>
    )
}
