import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "Logi",
        short_name: "Logi",
        description:
            "Open-source Hell Let Loose community management, events, rosters, and Discord coordination.",
        start_url: "/en",
        display: "standalone",
        background_color: "#020617",
        theme_color: "#020617",
        icons: [
            {
                src: "/favicon.png",
                sizes: "32x32",
                type: "image/png",
            },
        ],
    }
}
