"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Check, ChevronDown } from "lucide-react"
import { useTransition } from "react"

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Dictionary } from "@/i18n/dictionaries"
import { locales, type Locale } from "@/i18n/config"
import { cn } from "@/lib/utils"

const localeOptions: Record<Locale, { flag: string; label: string }> = {
    en: { flag: "🇬🇧", label: "English" },
    cs: { flag: "🇨🇿", label: "Česky" },
    de: { flag: "🇩🇪", label: "Deutsch" },
}

export function LocaleSwitcher({
    locale,
    dictionary: _dictionary,
    compact = false,
}: {
    locale: Locale
    dictionary: Dictionary
    compact?: boolean
}) {
    const router = useRouter(),
        pathname = usePathname(),
        searchParams = useSearchParams()
    const [isPending, startTransition] = useTransition()
    const active = localeOptions[locale]
    function onLocaleChange(nextLocale: Locale) {
        if (!pathname || nextLocale === locale) return
        const segments = pathname.split("/")
        if (segments[1]) segments[1] = nextLocale
        else segments.push(nextLocale)
        const query = searchParams.toString(),
            nextPath = segments.join("/") || `/${nextLocale}`
        startTransition(() =>
            router.push(query ? `${nextPath}?${query}` : nextPath)
        )
    }
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    disabled={isPending}
                    className={cn(
                        "bg-background hover:bg-muted inline-flex h-9 items-center gap-2 rounded-lg border px-2.5 text-sm font-medium transition-colors",
                        compact && "h-8 px-2 text-xs"
                    )}
                    aria-label="Change language"
                >
                    <span className="text-base leading-none">
                        {active.flag}
                    </span>
                    <span>{active.label}</span>
                    <ChevronDown className="text-muted-foreground size-3.5" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-36 p-1.5">
                {locales.map((item) => {
                    const option = localeOptions[item],
                        selected = item === locale
                    return (
                        <DropdownMenuItem
                            key={item}
                            disabled={isPending || selected}
                            onSelect={() => onLocaleChange(item)}
                            className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2"
                        >
                            <span className="text-base leading-none">
                                {option.flag}
                            </span>
                            <span className="flex-1">{option.label}</span>
                            {selected && (
                                <Check className="text-primary size-4" />
                            )}
                        </DropdownMenuItem>
                    )
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
