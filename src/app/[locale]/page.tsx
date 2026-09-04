import Link from "next/link"
import { ArrowRight, BarChart3, CalendarDays, Download, Github, HeartHandshake, Shield, SquareTerminal, Trophy, Users } from "lucide-react"

import { UserAvatar } from "@/components/auth/user-avatar"
import { Logo } from "@/components/logo"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { defaultLocale, isLocale } from "@/i18n/config"
import { getDictionary } from "@/i18n/dictionaries"
import { getCurrentPlayer } from "@/lib/auth"
import { getLatestLogiCommsWindowsDownload } from "@/lib/logicomms"

const githubHref = "https://github.com/ninjonik/logi"

export default async function LocaleHomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const resolvedLocale = isLocale(locale) ? locale : defaultLocale
  const dictionary = getDictionary(resolvedLocale)
  const [user, logiCommsDownload] = await Promise.all([getCurrentPlayer(), getLatestLogiCommsWindowsDownload()])
  const pillars = [[dictionary.home.pillars.operationsTitle, dictionary.home.pillars.operationsDescription, SquareTerminal], [dictionary.home.pillars.communitiesTitle, dictionary.home.pillars.communitiesDescription, Shield], [dictionary.home.pillars.contributorsTitle, dictionary.home.pillars.contributorsDescription, HeartHandshake]] as const
  const features = [dictionary.home.featureEvents, dictionary.home.featureRosters, dictionary.home.featureDiscord, dictionary.home.featureTools]

  return <main className="min-h-screen bg-background text-foreground">
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-6 sm:px-8 lg:px-10">
      <header className="flex items-center justify-between border-b pb-5"><Link href={`/${resolvedLocale}`}
                                                                                className="inline-flex items-center gap-3 text-sm font-medium tracking-[0.18em] uppercase"><span
        className="flex size-11 items-center justify-center rounded-xl border bg-card"><Logo
        size={22} /></span><span>{dictionary.app.name}</span></Link>
        <nav className="hidden items-center gap-5 text-sm text-muted-foreground lg:flex"><Link href={`/${resolvedLocale}/community`} className="hover:text-foreground">{dictionary.home.community}</Link><Link href="#features" className="hover:text-foreground">{dictionary.home.featuresNav}</Link><Link href="#logicomms" className="hover:text-foreground">LogiComms</Link></nav>
        <div className="flex items-center gap-3"><Button asChild variant="ghost"><Link href={githubHref} target="_blank"
                                                                                       rel="noreferrer"><Github />GitHub</Link></Button>{user ?
          <Button asChild variant="outline"><Link href={`/${resolvedLocale}/dashboard`}><UserAvatar
            avatarLink={user.avatar} className="size-5" />{dictionary.home.dashboard}</Link></Button> :
          <Button asChild><Link
            href={`/${resolvedLocale}/login`}>{dictionary.home.openApp}<ArrowRight /></Link></Button>}</div>
      </header>
      {user ? <p
        className="mt-4 text-sm text-muted-foreground">{dictionary.home.loggedInAs.replace("{name}", user.name)}</p> : null}
      <section className="grid flex-1 items-center gap-12 py-14 lg:grid-cols-[1.05fr_.95fr] lg:py-20">
        <div className="space-y-8">
          <div className="space-y-4"><Badge variant="outline"
                                            className="rounded-full px-3 py-1">{dictionary.home.badge}</Badge><h1
            className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">{dictionary.home.title}</h1>
            <p
              className="text-base leading-7 text-muted-foreground sm:text-lg">{dictionary.home.description}</p>
          </div>
          <div className="flex flex-wrap gap-3"><Button asChild size="lg"><Link
            href={`/${resolvedLocale}/${user ? "dashboard" : "login"}`}>{user ? dictionary.home.dashboard : dictionary.home.signIn}<ArrowRight /></Link></Button><Button
            asChild size="lg" variant="outline"><Link href={`/${resolvedLocale}/community`}>{dictionary.home.community}</Link></Button>
          </div>
          <div
            className="grid gap-3 sm:grid-cols-2">{[dictionary.home.freeToUse, dictionary.home.sourceAvailable, dictionary.home.contributionsWelcome, dictionary.home.noMarketingFiller].map((item) =>
            <div key={item} className="rounded-xl border bg-card px-4 py-3 text-sm font-medium">{item}</div>)}</div>
        </div><div className="relative overflow-hidden rounded-3xl border border-indigo-400/40 bg-gradient-to-br from-[#172554] via-[#3730a3] to-[#7e22ce] p-6 text-white shadow-[0_24px_60px_rgba(76,29,149,0.32)] ring-1 ring-white/10"><div className="absolute -right-16 -top-16 size-56 rounded-full bg-white/10" /><div className="absolute -bottom-20 -left-12 size-48 rounded-full bg-fuchsia-400/20" /><div className="relative space-y-5"><div className="flex items-center justify-between"><Trophy className="size-6" /></div><div><p className="text-3xl font-semibold">{dictionary.home.commandCenter}</p><p className="mt-2 text-sm text-white/75">{dictionary.home.commandCenterDescription}</p></div><div className="grid grid-cols-3 gap-3"><HeroMetric icon={CalendarDays} label={dictionary.home.eventsMetric} value="12" /><HeroMetric icon={Users} label={dictionary.home.playersMetric} value="48" /><HeroMetric icon={BarChart3} label={dictionary.home.matchesMetric} value="37" /></div><div className="rounded-2xl border border-white/15 bg-black/20 p-4"><div className="flex items-center justify-between text-sm"><span>{dictionary.home.nextOperation}</span><span className="rounded-full bg-emerald-400/20 px-2 py-1 text-emerald-100">{dictionary.home.registrationOpen}</span></div><p className="mt-3 text-lg font-semibold">{dictionary.home.sampleOperation}</p><p className="mt-1 text-sm text-white/70">{dictionary.home.sampleOperationMeta}</p></div></div></div>
{/*        <Card className="border-border/70 bg-card/80 shadow-none"><CardHeader className="gap-3">
          <CardTitle
          className="text-2xl">{dictionary.home.featuresTitle}</CardTitle>
          <CardDescription
          className="text-sm leading-6">{dictionary.home.featuresDescription}</CardDescription></CardHeader><CardContent
          className="grid gap-3">{features.map((item) => <div key={item}
                                                              className="rounded-lg border px-4 py-3">{item}</div>)}</CardContent></Card>*/}
      </section>
      <section id="features" className="border-t py-10"><div className="mb-6 flex items-end justify-between gap-4"><div><p className="text-sm font-medium text-primary">{dictionary.home.featuresEyebrow}</p><h2 className="mt-1 text-3xl font-semibold tracking-tight">{dictionary.home.featuresTitle}</h2></div><Link href={`/${resolvedLocale}/community`} className="text-sm font-medium text-primary hover:underline">{dictionary.home.community} <ArrowRight className="inline size-4" /></Link></div><div className="grid gap-4 md:grid-cols-3"><FeatureCard icon={CalendarDays} title={dictionary.home.featureEvents} description={dictionary.home.featureEventsDescription} /><FeatureCard icon={Users} title={dictionary.home.featureRosters} description={dictionary.home.featureRostersDescription} /><FeatureCard icon={Trophy} title={dictionary.home.featureStats} description={dictionary.home.featureStatsDescription} /></div></section>
      <section id="logicomms" className="border-t py-10">
        <div className="grid gap-6 rounded-2xl border bg-card p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="space-y-3"><Badge variant="outline"
                                            className="rounded-full">{dictionary.home.commsBadge}</Badge><h2
            className="text-2xl font-semibold tracking-tight">{dictionary.home.commsTitle}</h2><p
            className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">{dictionary.home.commsDescription}</p>
          </div>
          {logiCommsDownload ?
            <Button asChild size="lg"><a href={logiCommsDownload}><Download />{dictionary.home.commsDownload}
            </a></Button> : <p className="text-sm text-muted-foreground">{dictionary.home.commsUnavailable}</p>}</div>
      </section>
      <Separator />
      <section className="grid gap-5 py-10 lg:grid-cols-3">{pillars.map(([title, description, Icon]) => <Card
        key={title} className="shadow-none"><CardHeader className="gap-4">
        <div className="flex size-10 items-center justify-center rounded-lg border bg-background"><Icon
          className="size-4" /></div>
        <div className="space-y-2"><CardTitle>{title}</CardTitle><CardDescription
          className="leading-6">{description}</CardDescription></div>
      </CardHeader></Card>)}</section>
    </div>
  </main>
}

function HeroMetric({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) { return <div className="rounded-xl border border-white/15 bg-white/10 p-3"><Icon className="size-4 text-white/75" /><p className="mt-3 text-xl font-semibold">{value}</p><p className="text-xs text-white/70">{label}</p></div> }
function FeatureCard({ icon: Icon, title, description }: { icon: typeof CalendarDays; title: string; description: string }) { return <Card className="border-border/70 bg-card/80 shadow-none"><CardHeader className="gap-4"><div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></div><div className="space-y-2"><CardTitle>{title}</CardTitle><CardDescription className="leading-6">{description}</CardDescription></div></CardHeader></Card> }
