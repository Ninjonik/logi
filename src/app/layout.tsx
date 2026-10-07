import { getSiteUrl } from "@/lib/env"
import type { Metadata } from "next"
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

/**
 * Passes its children through: `<html>` and `<body>` come from the segment
 * below (`RootDocument` in `[locale]/layout.tsx`, the wiki layout and the
 * global 404), so the server HTML carries each route's language without making
 * pages dynamic.
 */
export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return children
}
