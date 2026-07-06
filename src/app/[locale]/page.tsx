import { redirect } from "next/navigation";

import { mockIsAuthenticated } from "@/lib/mock-data";
import { defaultLocale } from "@/i18n/config";

export default async function LocaleHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const resolvedLocale = locale || defaultLocale;

  redirect(`/${resolvedLocale}/${mockIsAuthenticated ? "dashboard" : "login"}`);
}
