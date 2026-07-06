"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Languages } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { locales, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

const localeLabels: Record<Locale, string> = {
  en: "English",
  cs: "Czech"
};

export function LocaleSwitcher({
  locale,
  dictionary,
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

  if (compact) {
    return (
      <Button variant="secondary" className="rounded-full px-3" disabled>
        <Languages className="mr-1 size-3.5" />
        {locale.toUpperCase()}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Languages className="size-4 text-muted-foreground" />
      <Select value={locale} onValueChange={onLocaleChange} disabled={isPending}>
        <SelectTrigger className="w-[148px] rounded-full">
          <SelectValue placeholder={dictionary.languageSwitcher.selectLanguage} />
        </SelectTrigger>
        <SelectContent>
          {locales.map((item) => (
            <SelectItem key={item} value={item}>
              {localeLabels[item]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
