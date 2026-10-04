/* eslint-disable @next/next/no-html-link-for-pages -- Standalone synthetic preview. */
import { VerifiedPlatformLinks } from "../../src/components/app/verified-platform-links"
import { getDictionary } from "../../src/i18n/dictionaries"
import { isLocale } from "../../src/i18n/config"
import { createRoot } from "react-dom/client"
function Preview() {
    const value = new URLSearchParams(window.location.search).get("locale")
    const locale = isLocale(value ?? "") ? (value as "en" | "cs" | "de") : "en"
    return (
        <main className="mx-auto max-w-3xl space-y-5 p-4">
            <header className="space-y-3 text-sm">
                <h1 className="text-xl font-semibold">
                    Logi — Steam linking preview
                </h1>
                <p>
                    Synthetic account and provider. Actual component, HTTP
                    handlers, use-case and persistence handlers; in-memory
                    database.
                </p>
                <nav className="flex flex-wrap gap-3">
                    <a href="/?locale=cs">Čeština</a>
                    <a href="/?locale=en">English</a>
                    <a href="/?locale=de">Deutsch</a>
                    <a href={`/__fixture/callback?locale=${locale}`}>
                        Simulate verified Steam callback
                    </a>
                    <a href={`/?locale=${locale}&steam=failed`}>
                        Simulate failed callback
                    </a>
                    <button
                        onClick={() =>
                            fetch("/__fixture/fail-next", { method: "POST" })
                        }
                    >
                        Fail next read
                    </button>
                </nav>
            </header>
            <VerifiedPlatformLinks
                locale={locale}
                dictionary={getDictionary(locale)}
                initialCallbackFailed={
                    new URLSearchParams(window.location.search).get("steam") ===
                    "failed"
                }
            />
        </main>
    )
}
createRoot(document.getElementById("root")!).render(<Preview />)
