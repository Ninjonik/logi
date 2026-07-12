"use client"

import * as React from "react"
import { ThemeProviderContext } from "@/contexts/theme-context"

type Theme = "dark" | "light" | "system"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = React.useState<Theme>(
    () => (typeof window !== "undefined" && localStorage.getItem(storageKey) as Theme) || defaultTheme
  )

  React.useEffect(() => {
    if (typeof window === "undefined") return

    const root = window.document.documentElement
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")

    const applyTheme = (value: Theme) => {
      root.classList.remove("light", "dark")

      if (value === "system") {
        root.classList.add(mediaQuery.matches ? "dark" : "light")
        return
      }

      root.classList.add(value)
    }

    applyTheme(theme)

    if (theme !== "system") {
      return
    }

    const handleSystemThemeChange = () => {
      applyTheme("system")
    }

    mediaQuery.addEventListener("change", handleSystemThemeChange)

    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange)
    }
  }, [theme, storageKey])

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      if (typeof window !== "undefined") {
        localStorage.setItem(storageKey, theme)
      }
      setTheme(theme)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}
