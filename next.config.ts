import createNextIntlPlugin from "next-intl/plugin"
import { execFileSync } from "node:child_process"
import type { NextConfig } from "next"

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")

function getBuildVersion() {
    try {
        const commitCount = execFileSync(
            "git",
            ["rev-list", "--count", "HEAD"],
            {
                encoding: "utf8",
                stdio: ["ignore", "pipe", "ignore"],
            }
        ).trim()
        return `1.0.${commitCount}`
    } catch {
        return "1.0.0"
    }
}

const nextConfig: NextConfig = {
    env: {
        NEXT_PUBLIC_APP_VERSION: getBuildVersion(),
    },
    experimental: {
        optimizePackageImports: ["lucide-react", "@radix-ui/react-icons"],
    },
    turbopack: {},

    cacheComponents: false,

    // Image optimization
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "ui.shadcn.com",
            },
            {
                protocol: "https",
                hostname: "images.unsplash.com",
            },
            {
                protocol: "https",
                hostname: "avatars.githubusercontent.com",
            },
            {
                protocol: "https",
                hostname: "cdn.discordapp.com",
            },
        ],
        formats: ["image/webp", "image/avif"],
    },

    // Headers for better security and performance
    async headers() {
        return [
            {
                source: "/(.*)",
                headers: [
                    {
                        key: "X-Frame-Options",
                        value: "DENY",
                    },
                    {
                        key: "X-Content-Type-Options",
                        value: "nosniff",
                    },
                    {
                        key: "Referrer-Policy",
                        value: "origin-when-cross-origin",
                    },
                ],
            },
        ]
    },

    // Redirects for better SEO
    async redirects() {
        return [
            {
                source: "/home",
                destination: "/en/dashboard",
                permanent: true,
            },
        ]
    },
}

export default withNextIntl(nextConfig)
