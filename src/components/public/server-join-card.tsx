"use client"

import { ArrowLeft, Check, Copy, ExternalLink } from "lucide-react"
import { useEffect, useId, useState } from "react"

import { steamConnectUrl } from "@/domain/discord-publications/server-join"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export type ServerJoinCardCopy = {
    opening: string
    players: string
    map: string
    steamPrompt: string
    openAgain: string
    manualTitle: string
    addressLabel: string
    copy: string
    copied: string
    copyFailed: string
    steamInstructions: string
    backToDiscord: string
    joinCodeTitle: string
    joinCodeLabel: string
    joinCodeHelp: string
    noAddress: string
    noJoinCode: string
}

type Props = {
    gameId: "hell_let_loose" | "wardogs"
    gameName: string
    name: string
    address: string | null
    joinCode: string | null
    players: number | null
    capacity: number | null
    map: string | null
    copy: ServerJoinCardCopy
}

/** Where "Zpět do Discordu" leads: the Discord app, which the player came from. */
const DISCORD_APP_URL = "https://discord.com/app"

/**
 * The join page of one server (P4-44..46, P4-B10). Discord link buttons
 * allow only http(s), so the panel's "Připojit se" opens this page, which
 * immediately hands `steam://connect/<ip:port>` to the browser. When the
 * browser blocks it, the address stays here to copy. Wardogs shows the
 * join code. Never a password.
 */
export function ServerJoinCard({
    gameId,
    gameName,
    name,
    address,
    joinCode,
    players,
    capacity,
    map,
    copy,
}: Props) {
    const connectUrl =
        gameId === "hell_let_loose" && address ? steamConnectUrl(address) : null
    const value = gameId === "hell_let_loose" ? address : joinCode
    const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle")
    const inputId = useId()

    useEffect(() => {
        if (connectUrl) window.location.href = connectUrl
    }, [connectUrl])

    async function copyValue() {
        if (!value) return
        try {
            await navigator.clipboard.writeText(value)
            setCopied("copied")
        } catch {
            setCopied("failed")
        }
    }

    // The name is the heading when Steam is not being opened.
    const facts = [
        connectUrl ? name : null,
        players !== null && capacity !== null
            ? copy.players
                  .replace("{players}", String(players))
                  .replace("{capacity}", String(capacity))
            : null,
        map ? copy.map.replace("{map}", map) : null,
    ].filter((part): part is string => Boolean(part))

    return (
        <section className="bg-card mx-auto flex w-full max-w-xl flex-col gap-6 rounded-xl border p-6 shadow-xs sm:p-8">
            <header className="flex flex-col gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">
                    {connectUrl
                        ? copy.opening.replace("{game}", gameName)
                        : name}
                </h1>
                <p className="text-muted-foreground text-sm">
                    {facts.join(" · ")}
                </p>
                {connectUrl ? (
                    <p className="text-sm">{copy.steamPrompt}</p>
                ) : null}
            </header>

            {connectUrl ? (
                <Button asChild className="self-start">
                    <a href={connectUrl}>
                        <ExternalLink aria-hidden="true" />
                        {copy.openAgain}
                    </a>
                </Button>
            ) : null}

            {value ? (
                <div className="flex flex-col gap-2">
                    <h2 className="text-base font-semibold">
                        {gameId === "hell_let_loose"
                            ? copy.manualTitle
                            : copy.joinCodeTitle}
                    </h2>
                    <label htmlFor={inputId} className="sr-only">
                        {gameId === "hell_let_loose"
                            ? copy.addressLabel
                            : copy.joinCodeLabel}
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Input
                            id={inputId}
                            readOnly
                            value={value}
                            onFocus={(event) => event.currentTarget.select()}
                            className="font-mono"
                        />
                        <Button
                            type="button"
                            variant="outline"
                            onClick={copyValue}
                            className="self-start sm:self-auto"
                        >
                            {copied === "copied" ? (
                                <Check aria-hidden="true" />
                            ) : (
                                <Copy aria-hidden="true" />
                            )}
                            {copied === "copied" ? copy.copied : copy.copy}
                        </Button>
                    </div>
                    <p
                        className="text-muted-foreground text-sm"
                        aria-live="polite"
                    >
                        {copied === "failed"
                            ? copy.copyFailed
                            : gameId === "hell_let_loose"
                              ? copy.steamInstructions
                              : copy.joinCodeHelp}
                    </p>
                </div>
            ) : (
                <p className="text-muted-foreground text-sm">
                    {gameId === "hell_let_loose"
                        ? copy.noAddress
                        : copy.noJoinCode}
                </p>
            )}

            <a
                href={DISCORD_APP_URL}
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 self-start text-sm underline-offset-4 hover:underline"
            >
                <ArrowLeft aria-hidden="true" className="size-4" />
                {copy.backToDiscord}
            </a>
        </section>
    )
}
