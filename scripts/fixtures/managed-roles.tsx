/* eslint-disable @next/next/no-html-link-for-pages -- Standalone synthetic preview. */
import { MemberRoleOperations } from "../../src/components/app/member-role-operations"
import { getDictionary } from "../../src/i18n/dictionaries"
import { isLocale } from "../../src/i18n/config"
import { createRoot } from "react-dom/client"
import { useState } from "react"

function Preview() {
    const locale =
        new URLSearchParams(window.location.search).get("locale") ?? "en"
    const [serverId, setServerId] = useState("fixture-a")
    const [notice, setNotice] = useState("")
    return (
        <main className="mx-auto max-w-3xl space-y-5 p-4">
            <header className="space-y-3 text-sm">
                <h1 className="text-xl font-semibold">
                    Logi — managed roles preview
                </h1>
                <p>
                    Synthetic data. Actual component and styles; simulated API.
                    No hosted session or Discord actions.
                </p>
                <div className="flex flex-wrap items-center gap-3">
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
            <MemberRoleOperations
                serverId={serverId}
                dictionary={getDictionary(isLocale(locale) ? locale : "en")}
            />
        </main>
    )
}
createRoot(document.getElementById("root")!).render(<Preview />)
