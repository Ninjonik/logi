import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MatchDetails } from "@/components/app/match-details";
import { DynamicMetadataMarker } from "@/components/public/dynamic-metadata-marker";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getPublicMatch } from "@/lib/read-models/public-profiles";

type Props = { params: Promise<{ locale: string; eventId: string }> };

export const metadata: Metadata = { title: "Match result | Logi", description: "Recorded public match result." };

export default async function PublicMatchPage({ params }: Props) {
  const { locale, eventId } = await params;
  const resolvedLocale = isLocale(locale) ? locale : "en";
  const dictionary = getDictionary(resolvedLocale);
  const match = await getPublicMatch(eventId);
  if (!match) notFound();
  return <main className="min-h-screen bg-background px-4 py-8 sm:px-6"><div className="mx-auto max-w-6xl space-y-6"><Link className="text-sm text-muted-foreground hover:text-foreground" href={`/${resolvedLocale}`}>← {dictionary.publicProfiles.backToLogi}</Link><MatchDetails match={match} dictionary={dictionary} /><DynamicMetadataMarker /></div></main>;
}
