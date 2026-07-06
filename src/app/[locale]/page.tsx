import { redirect } from "next/navigation";

import { defaultLocale } from "@/i18n/config";
import { getCurrentPlayer } from "@/lib/auth";

export default async function LocaleHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const resolvedLocale = locale || defaultLocale;
  const isAuthenticated = Boolean(await getCurrentPlayer());

  redirect(`/${resolvedLocale}/${isAuthenticated ? "dashboard" : "login"}`);
}
