"use client"

import { Monitor, Moon, Sun } from "lucide-react"
import * as React from "react"

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/hooks/use-theme"

export type ThemeOption = "light" | "dark" | "system"

/** The three theme choices with their localized labels, in menu order. */
export function themeOptionsFor(dictionary: Dictionary): Array<{
    value: ThemeOption
    label: string
    icon: typeof Sun
}> {
    const t = dictionary.languageSwitcher
    return [
        { value: "light", label: t.themeLight, icon: Sun },
        { value: "dark", label: t.themeDark, icon: Moon },
        { value: "system", label: t.themeSystem, icon: Monitor },
    ]
}

export function ThemeSwitcher({ dictionary }: { dictionary: Dictionary }) {
    const { theme, setTheme } = useTheme()
    const themeOptions = themeOptionsFor(dictionary)
    const [mounted, setMounted] = React.useState(false)

    React.useEffect(() => {
        setMounted(true)
    }, [])

    const activeTheme = mounted ? theme : "system"
    const activeOption =
        themeOptions.find((option) => option.value === activeTheme) ??
        themeOptions[2]
    const ActiveIcon = activeOption.icon

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    aria-label={`${dictionary.languageSwitcher.theme}: ${activeOption.label}`}
                    className="h-8 rounded-lg px-2 text-xs font-medium"
                >
                    <ActiveIcon className="size-3.5 sm:mr-1.5" />
                    <span className="hidden sm:inline">
                        {activeOption.label}
                    </span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuRadioGroup
                    value={activeTheme}
                    onValueChange={(value) => setTheme(value as ThemeOption)}
                >
                    {themeOptions.map((option) => {
                        const Icon = option.icon

                        return (
                            <DropdownMenuRadioItem
                                key={option.value}
                                value={option.value}
                            >
                                <Icon className="size-4" />
                                {option.label}
                            </DropdownMenuRadioItem>
                        )
                    })}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
