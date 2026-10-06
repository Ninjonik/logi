"use client"

import { useEffect, useId, useState } from "react"
import { Check, Copy } from "lucide-react"

import { steamConnectUrl } from "@/domain/discord-publications/server-join"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export type ServerJoinCardCopy = {
    opening: string
    players: string
    queue: string
    steamPrompt: string
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
    queue: number | null
    copy: ServerJoinCardCopy
}

/** Where "Zpět do Discordu" leads: the Discord app, which the player came from. */
const DISCORD_APP_URL = "https://discord.com/app"

/**
 * The join page of one server (P4-44..46, P4-B10), laid out as the board
 * draws it: the Logi mark, "Otevírám Hell Let Loose…", "Vlci #1 · Public ·
 * 78 / 100 hráčů · fronta 3", the Steam prompt, the manual address with
 * "Kopírovat" and "Zpět do Discordu", all centred. Discord link buttons
 * allow only http(s), so the panel's "Připojit se" opens this page, which
 * immediately hands `steam://connect/<ip:port>` to the browser; when the
 * browser blocks it, the address stays here to copy. Wardogs shows the join
 * code. Never a password.
 */
export function ServerJoinCard({
    gameId,
    gameName,
    name,
    address,
    joinCode,
    players,
    capacity,
    queue,
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
        queue ? copy.queue.replace("{queue}", String(queue)) : null,
    ].filter((part): part is string => Boolean(part))

    return (
        <section className="flex w-full flex-col items-center gap-3 text-center">
            <span
                aria-hidden="true"
                className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-[10px] font-semibold"
            >
                L
            </span>
            <h1 className="text-xl font-semibold tracking-tight">
                {connectUrl ? copy.opening.replace("{game}", gameName) : name}
            </h1>
            {facts.length ? (
                <p className="text-muted-foreground text-sm">
                    {facts.join(" · ")}
                </p>
            ) : null}
            {connectUrl ? (
                <p className="text-muted-foreground text-[13px]">
                    {copy.steamPrompt}
                </p>
            ) : null}

            {value ? (
                <div className="flex w-full max-w-[380px] flex-col gap-1.5 text-left">
                    <label
                        htmlFor={inputId}
                        className="text-[13px] font-medium"
                    >
                        {gameId === "hell_let_loose"
                            ? copy.manualTitle
                            : copy.joinCodeTitle}
                        <span className="sr-only">
                            {" · "}
                            {gameId === "hell_let_loose"
                                ? copy.addressLabel
                                : copy.joinCodeLabel}
                        </span>
                    </label>
                    <div className="flex gap-2">
                        <Input
                            id={inputId}
                            readOnly
                            value={value}
                            onFocus={(event) => event.currentTarget.select()}
                            className="min-w-0 flex-1 font-mono"
                        />
                        <Button type="button" onClick={copyValue}>
                            {copied === "copied" ? (
                                <Check aria-hidden="true" />
                            ) : (
                                <Copy aria-hidden="true" />
                            )}
                            {copied === "copied" ? copy.copied : copy.copy}
                        </Button>
                    </div>
                    <p
                        className="text-muted-foreground text-xs"
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
                <p className="text-muted-foreground max-w-[380px] text-sm">
                    {gameId === "hell_let_loose"
                        ? copy.noAddress
                        : copy.noJoinCode}
                </p>
            )}

            <a
                href={DISCORD_APP_URL}
                className="text-foreground text-[13px] underline underline-offset-4"
            >
                {copy.backToDiscord}
            </a>
        </section>
    )
}
