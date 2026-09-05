import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { MatchDetails } from "@/components/app/match-details";
import { PublicBreadcrumbs } from "@/components/public/public-breadcrumbs";
import { PublicPage, PublicSiteShell } from "@/components/public/public-site-shell";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getPublicMatch } from "@/lib/read-models/public-profiles";
import { getPublicPreviewMetadata } from "@/lib/public-preview-metadata";

type Props = { params: Promise<{ locale: string; eventId: string }> };
async function ConnectionMarker() { await connection(); return null; }
function DynamicMetadataMarker() { return <Suspense><ConnectionMarker /></Suspense>; }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { eventId } = await params; const preview = await getPublicPreviewMetadata("match", eventId);
  const title = preview?.title ?? "Match result | Logi"; const description = preview?.description ?? "Recorded public match result.";
  const image = `/api/og/match/${eventId}?v=${encodeURIComponent(preview?.imageVersion ?? "current")}`;
  return { title, description, openGraph: { title, description, images: [{ url: image, width: 1200, height: 630 }] }, twitter: { card: "summary_large_image", images: [image] } };
}

export default async function PublicMatchPage({ params }: Props) {
  const { locale, eventId } = await params;
  const resolvedLocale = isLocale(locale) ? locale : "en"; const dictionary = getDictionary(resolvedLocale); const match = await getPublicMatch(eventId); if (!match) notFound();
  return <PublicSiteShell locale={resolvedLocale}><PublicPage><div className="space-y-6"><PublicBreadcrumbs items={[{ label: dictionary.app.name, href: `/${resolvedLocale}` }, { label: dictionary.publicProfiles.communityTitle, href: `/${resolvedLocale}/community` }, { label: dictionary.publicProfiles.matches }]} /><MatchDetails match={match} dictionary={dictionary} /></div></PublicPage><DynamicMetadataMarker /></PublicSiteShell>;
}
