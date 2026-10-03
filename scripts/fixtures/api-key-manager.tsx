/* eslint-disable @next/next/no-html-link-for-pages -- Standalone esbuild preview; no Next.js router. */
import { createRoot } from "react-dom/client"
import { Toaster } from "sonner"
import { useState } from "react"

import { ApiKeyManager } from "../../src/components/app/api-key-manager"
import { getDictionary } from "../../src/i18n/dictionaries"
import { isLocale } from "../../src/i18n/config"

function Preview() {
    const localeParameter =
        new URLSearchParams(window.location.search).get("locale") ?? "en"
    const locale = isLocale(localeParameter) ? localeParameter : "en"
    const [serverId, setServerId] = useState("fixture-a")
    const [log, setLog] = useState("")
    const [notice, setNotice] = useState("")
    return (
        <main className="mx-auto max-w-4xl space-y-5 p-5">
            <header className="space-y-2 border-b pb-4 text-sm">
                <h1 className="text-xl font-semibold">
                    API key manager — local component preview
                </h1>
                <p>
                    Synthetic data only. Actual React component and application
                    styles; simulated API, no dashboard session or hosted calls.
                </p>
                <div className="flex flex-wrap items-center gap-4">
                    <a href="/?locale=en" className="underline">
                        English
                    </a>
                    <a href="/?locale=cs" className="underline">
                        Čeština
                    </a>
                    <a href="/?locale=de" className="underline">
                        Deutsch
                    </a>
                    <label htmlFor="fixture-workspace">Fixture workspace</label>
                    <select
                        className="bg-background rounded border p-1"
                        id="fixture-workspace"
                        value={serverId}
                        onChange={(event) => setServerId(event.target.value)}
                    >
                        <option value="fixture-a">Workspace A</option>
                        <option value="fixture-b">Workspace B</option>
                    </select>
                </div>
            </header>
            <section className="bg-card rounded-xl border p-5">
                <ApiKeyManager
                    serverId={serverId}
                    dictionary={getDictionary(locale)}
                />
            </section>
            <details className="space-y-2 text-sm">
                <summary>Fixture controls and request evidence</summary>
                <div className="flex gap-4 py-2">
                    <button
                        className="rounded border p-2"
                        onClick={async () => {
                            await fetch("/__fixture/fail-next", {
                                method: "POST",
                            })
                            setNotice(
                                "The next simulated API request will fail with 503."
                            )
                        }}
                    >
                        Fail next API request
                    </button>
                    <button
                        className="rounded border p-2"
                        onClick={async () =>
                            setLog(
                                JSON.stringify(
                                    await (
                                        await fetch("/__fixture/requests")
                                    ).json(),
                                    null,
                                    2
                                )
                            )
                        }
                    >
                        Refresh request log
                    </button>
                </div>
                <p>{notice}</p>
                <pre className="max-h-96 overflow-auto text-xs">{log}</pre>
            </details>
            <Toaster richColors />
        </main>
    )
}

createRoot(document.getElementById("root")!).render(<Preview />)
