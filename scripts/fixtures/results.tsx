/* eslint-disable @next/next/no-html-link-for-pages -- Standalone synthetic preview. */
import { ResultReview } from "../../src/components/app/result-review"
import { getDictionary } from "../../src/i18n/dictionaries"
import { isLocale } from "../../src/i18n/config"
import { createRoot } from "react-dom/client"
import { useState } from "react"
function Preview() {
    const value =
        new URLSearchParams(window.location.search).get("locale") ?? "en"
    const locale = isLocale(value) ? value : "en"
    const [fixture, setFixture] = useState("hll"),
        [notice, setNotice] = useState("")
    return (
        <main className="mx-auto max-w-3xl space-y-5 p-4">
            <header className="space-y-3 text-sm">
                <h1 className="text-xl font-semibold">
                    Logi — result review preview
                </h1>
                <p>
                    Synthetic events, session data and account proof. Actual
                    component, HTTP/use-case and Convex handlers; in-memory
                    database.
                </p>
                <nav className="flex flex-wrap items-center gap-3">
                    <a href="/?locale=cs">Čeština</a>
                    <a href="/?locale=en">English</a>
                    <a href="/?locale=de">Deutsch</a>
                    <label>
                        Fixture{" "}
                        <select
                            aria-label="Fixture"
                            className="bg-background rounded border p-1"
                            value={fixture}
                            onChange={(e) => setFixture(e.target.value)}
                        >
                            <option value="hll">HLL collected session</option>
                            <option value="wdg">Wardogs manual factions</option>
                            <option value="other">
                                Other workspace (forbidden)
                            </option>
                        </select>
                    </label>
                    <button
                        onClick={async () => {
                            await fetch("/__fixture/fail-next", {
                                method: "POST",
                            })
                            setNotice("Next read fails")
                        }}
                    >
                        Fail next read
                    </button>
                    <button
                        onClick={async () => {
                            await fetch("/__fixture/source-change", {
                                method: "POST",
                            })
                            setNotice(
                                "Collected source changed to 3 / 2; reviewed revisions remain frozen"
                            )
                        }}
                    >
                        Simulate source correction
                    </button>
                </nav>
                <p role="status">{notice}</p>
            </header>
            <ResultReview
                dictionary={getDictionary(locale)}
                serverId={fixture === "other" ? "other" : "fixture"}
                eventId={fixture === "wdg" ? "events:b" : "events:a"}
                gameId={fixture === "wdg" ? "wardogs" : "hell_let_loose"}
            />
        </main>
    )
}
createRoot(document.getElementById("root")!).render(<Preview />)
