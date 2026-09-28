import { TopLoaderProvider } from "@/components/providers/top-loader-provider"
import { AppProviders } from "@/components/providers/app-providers"
import { SidebarConfigProvider } from "@/contexts/sidebar-context"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { getSiteUrl } from "@/lib/env"
import type { Metadata } from "next"
import { inter } from "@/lib/fonts"
import "./globals.css"

export const metadata: Metadata = {
    metadataBase: new URL(getSiteUrl()),
    title: {
        default: "Logi | Hell Let Loose community management",
        template: "%s | Logi",
    },
    description:
        "Open-source community management for Hell Let Loose: plan events, build rosters, publish match results, and coordinate your Discord server.",
    applicationName: "Logi",
    category: "Community management",
    keywords: [
        "Hell Let Loose",
        "Hell Let Loose community management",
        "Hell Let Loose roster",
        "Hell Let Loose events",
        "Discord community management",
    ],
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
        },
    },
    formatDetection: {
        telephone: false,
        address: false,
        email: false,
    },
    openGraph: {
        title: "Logi | Hell Let Loose community management",
        description:
            "Plan events, build rosters, publish match results, and coordinate your Hell Let Loose Discord community.",
        siteName: "Logi",
        type: "website",
    },
    twitter: {
        card: "summary",
    },
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html
            lang="en"
            className={`${inter.variable} antialiased`}
            data-scroll-behavior="smooth"
        >
            <body className={inter.className}>
                <AppProviders>
                    <ThemeProvider
                        defaultTheme="system"
                        storageKey="nextjs-ui-theme"
                    >
                        <TopLoaderProvider />
                        <SidebarConfigProvider>
                            {children}
                        </SidebarConfigProvider>
                        <Toaster />
                    </ThemeProvider>
                </AppProviders>
            </body>
        </html>
    )
}
