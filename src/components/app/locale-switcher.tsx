"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { locales, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { cn } from "@/lib/utils";

const localeFlags: Record<Locale, string> = {
  en: "GB",
  cs: "CZ",
};

export function LocaleSwitcher({
  locale,
  dictionary: _dictionary,
  compact = false,
}: {
  locale: Locale;
  dictionary: Dictionary;
  compact?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function onLocaleChange(nextLocale: string) {
    if (!pathname || nextLocale === locale) return;

    const segments = pathname.split("/");
    if (segments[1]) {
      segments[1] = nextLocale;
    } else {
      segments.push(nextLocale);
    }

    const nextPath = segments.join("/") || `/${nextLocale}`;
    const query = searchParams.toString();

    startTransition(() => {
      router.push(query ? `${nextPath}?${query}` : nextPath);
    });
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border bg-background p-1",
        compact && "gap-1",
      )}
    >
      {locales.map((item) => {
        const isActive = item === locale;

        return (
          <button
            key={item}
            type="button"
            onClick={() => onLocaleChange(item)}
            disabled={isPending || isActive}
            aria-pressed={isActive}
            aria-label={item === "en" ? "Switch to English" : "Přepnout do češtiny"}
            className={cn(
              "inline-flex h-8 min-w-10 items-center justify-center rounded-full px-2 text-xs font-semibold transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {localeFlags[item]}
          </button>
        );
      })}
    </div>
  );
}
