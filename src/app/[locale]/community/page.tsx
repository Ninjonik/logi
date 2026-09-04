import Image from "next/image";
import Link from "next/link";

import { PublicPlayerSearch } from "@/components/public/public-player-search";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { listPublicClans, listPublicMatches, searchPublicPlayers } from "@/lib/read-models/public-profiles";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string; matchesCursor?: string; clansCursor?: string; playersCursor?: string }> };

export default async function CommunityPage({ params, searchParams }: Props) {
  const [{ locale }, { q, matchesCursor, clansCursor, playersCursor }] = await Promise.all([params, searchParams]);
  const resolvedLocale = isLocale(locale) ? locale : "en";
  const dictionary = getDictionary(resolvedLocale);
  const query = q?.trim() ?? "";
  const queryString = (overrides: Record<string, string | undefined>) => {
    const next = new URLSearchParams(query ? { q: query } : undefined);
    Object.entries(overrides).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    return next.toString();
  };
  const [clans, matches, players] = await Promise.all([
    listPublicClans(clansCursor ?? null),
    listPublicMatches(matchesCursor ?? null),
    query.length >= 2 ? searchPublicPlayers(query, playersCursor ?? null) : Promise.resolve({ page: [], isDone: true, continueCursor: "" }),
  ]);

  return <main className="min-h-screen bg-background px-4 py-8 sm:px-6"><div className="mx-auto max-w-6xl space-y-10">
    <Link className="text-sm text-muted-foreground hover:text-foreground" href={`/${resolvedLocale}`}>&larr; {dictionary.publicProfiles.backToLogi}</Link>
    <div><h1 className="text-3xl font-semibold">{dictionary.publicProfiles.communityTitle}</h1><p className="mt-2 text-muted-foreground">{dictionary.publicProfiles.communityDescription}</p></div>
    <section className="rounded-2xl border bg-card p-5 sm:p-6"><div className="max-w-xl"><h2 className="text-xl font-semibold">{dictionary.publicProfiles.findPlayer}</h2><p className="mt-1 text-sm text-muted-foreground">{dictionary.publicProfiles.findPlayerDescription}</p><PublicPlayerSearch initialQuery={query} label={dictionary.publicProfiles.findPlayer} placeholder={dictionary.publicProfiles.playerSearchPlaceholder} /></div>
      {query.length >= 2 ? <div className="mt-4 grid gap-2 sm:grid-cols-2">{players.page.length ? players.page.map((player) => <Link key={player.id} href={`/${resolvedLocale}/players/${player.id}`} className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-muted"><Image src={player.avatar} alt="" width={40} height={40} className="size-10 rounded-lg object-cover" /><span className="font-medium">{player.name}</span></Link>) : <p className="text-sm text-muted-foreground">{dictionary.publicProfiles.noPlayersFound}</p>}</div> : null}
      {query.length >= 2 && !players.isDone ? <Link className="mt-4 inline-block text-sm font-medium text-primary hover:underline" href={`/${resolvedLocale}/community?${queryString({ playersCursor: players.continueCursor })}`}>{dictionary.publicProfiles.loadMore}</Link> : null}
    </section>
    <section><div className="mb-4"><h2 className="text-2xl font-semibold">{dictionary.publicProfiles.matchHistory}</h2><p className="mt-1 text-sm text-muted-foreground">{dictionary.publicProfiles.platformMatchHistoryDescription}</p></div><div className="grid gap-3 md:grid-cols-2">{matches.page.map((match) => <Link key={match.eventId} href={`/${resolvedLocale}/matches/${match.eventId}`}><Card className="h-full transition-colors hover:bg-muted"><CardHeader className="space-y-1"><div className="flex items-start justify-between gap-4"><CardTitle className="line-clamp-1">{match.name}</CardTitle><span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${match.outcome === "victory" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : match.outcome === "defeat" ? "bg-red-500/15 text-red-700 dark:text-red-300" : "bg-muted text-muted-foreground"}`}>{match.outcome === "victory" ? dictionary.publicProfiles.victory : match.outcome === "defeat" ? dictionary.publicProfiles.defeat : dictionary.publicProfiles.recorded}</span></div><p className="text-sm text-muted-foreground">{match.clan?.name ?? dictionary.shared.notSet}{match.category ? ` · ${match.category}` : ""}</p></CardHeader><CardContent className="flex items-end justify-between gap-4"><div><p className="text-2xl font-semibold tabular-nums">{match.score.allied} – {match.score.axis}</p><p className="text-sm text-muted-foreground">{match.mapName}</p></div><time className="text-right text-sm text-muted-foreground">{new Intl.DateTimeFormat(resolvedLocale === "cs" ? "cs-CZ" : "en-GB", { dateStyle: "medium" }).format(new Date(match.gameEnd))}</time></CardContent></Card></Link>)}</div>{!matches.page.length ? <p className="text-sm text-muted-foreground">{dictionary.publicProfiles.noMatches}</p> : null}{!matches.isDone ? <Link className="mt-4 inline-block text-sm font-medium text-primary hover:underline" href={`/${resolvedLocale}/community?${queryString({ matchesCursor: matches.continueCursor })}`}>{dictionary.publicProfiles.loadMore}</Link> : null}</section>
    <section><h2 className="mb-4 text-2xl font-semibold">{dictionary.publicProfiles.clans}</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{clans.page.map((clan) => <Link key={clan.id} href={`/${resolvedLocale}/clans/${clan.id}`}><Card className="h-full transition-colors hover:bg-muted"><CardHeader className="flex-row items-center gap-3 space-y-0"><Image src={clan.avatar} alt="" width={48} height={48} className="size-12 rounded-xl object-cover" /><CardTitle className="truncate">{clan.name}</CardTitle></CardHeader><CardContent><p className="line-clamp-2 text-sm text-muted-foreground">{clan.description ?? dictionary.shared.notSet}</p><p className="mt-3 text-sm font-medium">{clan.memberCount} {dictionary.publicProfiles.activeMembers}</p></CardContent></Card></Link>)}</div>{!clans.isDone ? <Link className="mt-4 inline-block text-sm font-medium text-primary hover:underline" href={`/${resolvedLocale}/community?${queryString({ clansCursor: clans.continueCursor })}`}>{dictionary.publicProfiles.loadMore}</Link> : null}</section>
  </div></main>;
}
