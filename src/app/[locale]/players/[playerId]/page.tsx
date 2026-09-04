import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { Badge } from "@/components/ui/badge";
import { DynamicMetadataMarker } from "@/components/public/dynamic-metadata-marker";
import { PublicStat } from "@/components/public/public-stat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getPublicPlayerProfile } from "@/lib/read-models/public-profiles";

type Props = { params: Promise<{ locale: string; playerId: string }> };

export const metadata: Metadata = { title: "Player profile | Logi", description: "Public player profile and recorded match history." };

export default async function PublicPlayerPage({ params }: Props) {
  await connection();
  const { locale, playerId } = await params;
  const resolvedLocale = isLocale(locale) ? locale : "en";
  const dictionary = getDictionary(resolvedLocale);
  const player = await getPublicPlayerProfile(playerId);
  if (!player) notFound();

  return <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6"><div className="mx-auto max-w-5xl space-y-6">
    <Link className="text-sm text-muted-foreground hover:text-foreground" href={`/${resolvedLocale}`}>← {dictionary.publicProfiles.backToLogi}</Link>
    <section className="flex flex-col gap-5 rounded-3xl border bg-card p-6 sm:flex-row sm:items-center">
      <Image src={player.avatar} alt="" width={112} height={112} className="size-24 rounded-2xl object-cover" />
      <div className="min-w-0 flex-1"><h1 className="truncate text-3xl font-semibold tracking-tight">{player.name}</h1><div className="mt-3 flex flex-wrap gap-2">{player.clans.map((clan) => <Badge key={clan.id} variant="secondary">{clan.name}</Badge>)}</div></div>
      <div className="grid grid-cols-3 gap-5 text-center"><PublicStat label={dictionary.publicProfiles.matches} value={String(player.stats.matches)} /><PublicStat label={dictionary.publicProfiles.kd} value={player.stats.kd.toFixed(2)} /><PublicStat label={dictionary.publicProfiles.kills} value={String(player.stats.kills)} /></div>
    </section>
    <Card><CardHeader><CardTitle>{dictionary.publicProfiles.matchHistory}</CardTitle></CardHeader><CardContent className="space-y-2">{player.recentMatches.map((match) => <Link key={match.eventId} href={`/${resolvedLocale}/matches/${match.eventId}`} className="grid gap-2 rounded-xl border p-4 transition-colors hover:bg-muted sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"><div><p className="font-medium">{match.name}</p><p className="text-sm text-muted-foreground">{match.mapName ?? dictionary.shared.notSet} · {new Intl.DateTimeFormat(resolvedLocale === "cs" ? "cs-CZ" : "en-GB", { dateStyle: "medium" }).format(new Date(match.endedAt))}</p></div><PublicStat label={dictionary.publicProfiles.kills} value={String(match.kills)} /><PublicStat label={dictionary.publicProfiles.deaths} value={String(match.deaths)} /><PublicStat label={dictionary.publicProfiles.kd} value={match.killDeathRatio.toFixed(2)} /></Link>)}</CardContent></Card>
  <DynamicMetadataMarker /></div></main>;
}
