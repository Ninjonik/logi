import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {NextIntlClientProvider} from "next-intl";
import {getMessages, setRequestLocale} from "next-intl/server";

import { getDictionary } from "@/i18n/dictionaries";
import { isLocale, type Locale } from "@/i18n/config";

export const metadata: Metadata = {
  title: "Logi",
  description: "Server and community management for Discord.",
  openGraph: {
    title: "Logi",
    description: "Server and community management for Discord.",
  },
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();

  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}

export function generateStaticParams() {
  return [{ locale: "en" satisfies Locale }];
}
