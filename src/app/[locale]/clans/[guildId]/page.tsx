import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DynamicMetadataMarker } from "@/components/public/dynamic-metadata-marker";
import { PublicStat } from "@/components/public/public-stat";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getPublicClan } from "@/lib/read-models/public-profiles";

type Props = { params: Promise<{ locale: string; guildId: string }> };

export const metadata: Metadata = { title: "Clan profile | Logi", description: "Public clan profile and recorded match history." };

export default async function PublicClanPage({ params }: Props) {
  await connection();
  const { locale, guildId } = await params; const resolvedLocale = isLocale(locale) ? locale : "en"; const dictionary = getDictionary(resolvedLocale); const clan = await getPublicClan(guildId); if (!clan) notFound();
  return <main className="min-h-screen bg-background px-4 py-8 sm:px-6"><div className="mx-auto max-w-5xl space-y-6"><Link className="text-sm text-muted-foreground hover:text-foreground" href={`/${resolvedLocale}`}>← {dictionary.publicProfiles.backToLogi}</Link><section className="flex flex-col gap-5 rounded-3xl border bg-card p-6 sm:flex-row sm:items-center"><Image src={clan.avatar} alt="" width={96} height={96} className="size-20 rounded-2xl object-cover" /><div className="min-w-0 flex-1"><h1 className="text-3xl font-semibold">{clan.name}</h1>{clan.description ? <p className="mt-1 text-muted-foreground">{clan.description}</p> : null}<p className="mt-3 text-sm text-muted-foreground">{clan.memberCount} {dictionary.publicProfiles.activeMembers}</p></div><div className="grid grid-cols-3 gap-5 text-center"><PublicStat label={dictionary.publicProfiles.matches} value={String(clan.stats.matches)} /><PublicStat label={dictionary.publicProfiles.wins} value={String(clan.stats.wins)} /><PublicStat label={dictionary.publicProfiles.winRate} value={`${Math.round(clan.stats.winRate * 100)}%`} /></div></section><Card><CardHeader><CardTitle>{dictionary.publicProfiles.recentMatches}</CardTitle></CardHeader><CardContent className="space-y-2">{clan.recentMatches.map((match) => <Link key={match.eventId} href={`/${resolvedLocale}/matches/${match.eventId}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 hover:bg-muted"><div><p className="font-medium">{match.name}</p><p className="text-sm text-muted-foreground">{[match.category, match.mapName].filter(Boolean).join(" · ")}</p></div><div className="flex items-center gap-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${match.outcome === "victory" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : match.outcome === "defeat" ? "bg-red-500/15 text-red-700 dark:text-red-300" : "bg-muted text-muted-foreground"}`}>{outcomeLabel(match.outcome, dictionary)}</span><p className="text-lg font-semibold tabular-nums">{match.score.allied} – {match.score.axis}</p></div></Link>)}</CardContent></Card><DynamicMetadataMarker /></div></main>;
}

function outcomeLabel(outcome: string | undefined, dictionary: ReturnType<typeof getDictionary>) { return outcome === "victory" ? dictionary.event.resultVictory : outcome === "defeat" ? dictionary.event.resultDefeat : outcome === "draw" ? dictionary.event.resultDraw : dictionary.shared.notSet; }
