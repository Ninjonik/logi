import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { MatchDetails } from "@/components/app/match-details";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getPublicMatch } from "@/lib/read-models/public-profiles";
import { ensurePublicMatchPreview } from "@/lib/public-preview-ensure";
import { getPublicPreviewMetadata } from "@/lib/public-preview-metadata";
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags";

type Props = { params: Promise<{ locale: string; eventId: string }> };

export async function generateStaticParams() {
  return [{ eventId: "sample-event" }];
}

async function ConnectionMarker() {
  await connection();
  return null;
}

function DynamicMetadataMarker() {
  return <Suspense><ConnectionMarker /></Suspense>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { eventId } = await params;
  const preview = await getPublicPreviewMetadata("match", eventId);
  const title = preview?.title ?? "Match result | Logi";
  const description = preview?.description ?? "Recorded public match result.";
  const image = `/api/og/match/${eventId}?v=${encodeURIComponent(preview?.imageVersion ?? "current")}`;
  return { title, description, openGraph: { title, description, images: [{ url: image, width: 1200, height: 630 }] }, twitter: { card: "summary_large_image", images: [image] } };
}

export default async function PublicMatchPage({ params }: Props) {
  const { locale, eventId } = await params;
  if (eventId === "sample-event") notFound();
  const resolvedLocale = isLocale(locale) ? locale : "en";
  const dictionary = getDictionary(resolvedLocale);
  const match = await getPublicMatch(eventId);
  if (!match) notFound();
  await ensurePublicMatchPreview(eventId);
  revalidateCacheEntries([appCacheTags.publicMatch(eventId)]);
  return <><main className="min-h-screen bg-background px-4 py-8 sm:px-6"><div className="mx-auto max-w-6xl space-y-6"><Link className="text-sm text-muted-foreground hover:text-foreground" href={`/${resolvedLocale}`}>&larr; {dictionary.publicProfiles.backToLogi}</Link><MatchDetails match={match} dictionary={dictionary} /></div></main><DynamicMetadataMarker /></>;
}
