import { fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";
import type { Metadata } from "next";

import { PlatformIdLinkForm } from "@/components/app/platform-id-link-form";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";

const getPlatformIdLinkTokenReference = makeFunctionReference<"query">("discord:getPlatformIdLinkToken");

export const metadata: Metadata = {
  title: "Link platform ID",
  description: "Submit your platform ID for clan membership applications.",
};

export default async function LocalizedPlatformIdLinkPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const dictionary = getDictionary(safeLocale);
  const tokenRecord = await fetchQuery(getPlatformIdLinkTokenReference, { token });

  const isExpired = !tokenRecord || Boolean(tokenRecord.consumedAt) || new Date(tokenRecord.expiresAt).getTime() < Date.now();

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-16">
      <div className="w-full rounded-3xl border border-border/60 bg-card p-8 shadow-sm">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{dictionary.platformIdLink.title}</h1>
          <p className="text-sm text-muted-foreground">
            {dictionary.platformIdLink.description}
          </p>
        </div>
        <div className="mt-8">
          <PlatformIdLinkForm
            token={token}
            userName={tokenRecord?.userName ?? "Discord user"}
            expired={isExpired}
            locale={safeLocale}
            dictionary={dictionary}
          />
        </div>
      </div>
    </main>
  );
}
