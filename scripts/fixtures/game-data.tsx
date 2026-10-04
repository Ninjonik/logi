/* eslint-disable @next/next/no-html-link-for-pages -- Standalone preview without Next.js routing. */
import { GameDataConnections } from "../../src/components/app/game-data-connections"
import { getDictionary } from "../../src/i18n/dictionaries"
import { isLocale } from "../../src/i18n/config"
import { createRoot } from "react-dom/client"
import { useState } from "react"

function Preview() {
    const parameter =
        new URLSearchParams(window.location.search).get("locale") ?? "en"
    const locale = isLocale(parameter) ? parameter : "en"
    const [serverId, setServerId] = useState("fixture-a")
    const [notice, setNotice] = useState("")
    const dictionary = getDictionary(locale)
    return (
        <main className="mx-auto max-w-4xl space-y-5 p-5">
            <header className="space-y-3 border-b pb-4 text-sm">
                <h1 className="text-xl font-semibold">
                    Game data — local component preview
                </h1>
                <p>
                    Synthetic examples of three provider options. Actual Logi
                    component and styles; simulated API, no hosted session or
                    provider calls.
                </p>
                <div className="flex flex-wrap items-center gap-4">
                    <a className="underline" href="/?locale=en">
                        English
                    </a>
                    <a className="underline" href="/?locale=cs">
                        Čeština
                    </a>
                    <a className="underline" href="/?locale=de">
                        Deutsch
                    </a>
                    <label htmlFor="workspace">Fixture workspace</label>
                    <select
                        id="workspace"
                        className="bg-background rounded border p-1"
                        value={serverId}
                        onChange={(event) => setServerId(event.target.value)}
                    >
                        <option value="fixture-a">Workspace A</option>
                        <option value="fixture-b">Workspace B (empty)</option>
                    </select>
                    <button
                        className="rounded border p-2"
                        onClick={async () => {
                            await fetch("/__fixture/fail-next", {
                                method: "POST",
                            })
                            setNotice(
                                "Next simulated request will fail with 503."
                            )
                        }}
                    >
                        Fail next request
                    </button>
                </div>
                <p role="status">{notice}</p>
            </header>
            <section className="bg-card space-y-4 rounded-xl border p-5">
                <h2 className="text-lg font-semibold">
                    {dictionary.gameData.title}
                </h2>
                <GameDataConnections
                    serverId={serverId}
                    dictionary={dictionary}
                />
            </section>
        </main>
    )
}
createRoot(document.getElementById("root")!).render(<Preview />)
