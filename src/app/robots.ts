import type { MetadataRoute } from "next"

import { getPublicUrl } from "@/lib/seo"

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: "*",
            allow: "/",
            disallow: [
                "/api/",
                "/en/dashboard/",
                "/cs/dashboard/",
                "/de/dashboard/",
                "/en/login",
                "/cs/login",
                "/de/login",
                "/en/platform-id-link/",
                "/cs/platform-id-link/",
                "/de/platform-id-link/",
                "/platform-id-link/",
                "/en/guild-login/",
                "/cs/guild-login/",
                "/de/guild-login/",
            ],
        },
        sitemap: getPublicUrl("/sitemap.xml"),
    }
}
