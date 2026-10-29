"use client"

import { DiscordMessagePreview } from "@/components/app/discord-preview/discord-message-preview"
import { attendanceReminderView } from "@/domain/discord-messages/direct-message-views"
import { buildAnnouncementView } from "@/domain/discord-messages/match-announcement"
import { getAnnouncementMessages } from "@/lib/clan-language/announcements"
import { getDirectMessages } from "@/lib/clan-language/direct-messages"
import type { Dictionary } from "@/i18n/dictionaries"
import { useEffect, useRef, useState } from "react"
import type { Locale } from "@/i18n/config"

/** Fictional data passed through the same pure builders and renderer as the bot. */
export function LandingDiscordPreview({
    kind,
    locale,
    dictionary,
    fit = false,
}: {
    kind: "announcement" | "reminder"
    locale: Locale
    dictionary: Dictionary
    fit?: boolean
}) {
    const frame = useRef<HTMLDivElement>(null)
    const message = useRef<HTMLDivElement>(null)
    const [scale, setScale] = useState(1)
    useEffect(() => {
        if (!fit || !frame.current || !message.current) return
        const container = frame.current
        const content = message.current
        const resize = () => {
            setScale(
                Math.min(
                    1,
                    container.clientWidth / 540,
                    container.clientHeight / content.offsetHeight
                )
            )
        }
        const observer = new ResizeObserver(resize)
        observer.observe(container)
        observer.observe(content)
        resize()
        return () => observer.disconnect()
    }, [fit])
    const meetingStart = "2026-11-07T18:30:00Z"
    const gameStart = "2026-11-07T19:00:00Z"
    const view =
        kind === "announcement"
            ? buildAnnouncementView({
                  event: {
                      kind: "match",
                      eventId: "landing-example",
                      guildId: "example",
                      name: "NOVA vs WOLF vs RAVN",
                      teams: [
                          { code: "NOVA", side: "Valkyra" },
                          { code: "WOLF", side: "Manticore" },
                          { code: "RAVN", side: "Lonestar" },
                      ],
                      mapLabel: "Bakurani",
                      meetingStart,
                      gameStart,
                      registrationEnd: "2026-11-07T17:00:00Z",
                      timeZone: "Europe/Prague",
                      locale,
                  },
                  state: "open",
                  counts: {
                      groups: [
                          { id: "alpha", name: "Alpha", count: 4, max: 6 },
                          { id: "bravo", name: "Bravo", count: 3, max: 6 },
                      ],
                      withoutGroup: 0,
                      total: 7,
                      declined: 1,
                  },
                  signupRoster: {
                      groups: [
                          {
                              name: "Alpha",
                              icon: "🟠",
                              names: ["Atlas", "Echo", "Kestrel", "Nova"],
                          },
                          {
                              name: "Bravo",
                              icon: "🔵",
                              names: ["Lynx", "Moss", "Rook"],
                          },
                      ],
                      declined: ["Pixel"],
                  },
                  links: { calendar: "#" },
                  copy: getAnnouncementMessages(locale),
              })
            : attendanceReminderView({
                  event: {
                      id: "landing-example",
                      guildId: "example",
                      title: "NOVA vs WOLF vs RAVN",
                      meetingStart,
                      gameStart,
                  },
                  place: { kind: "squad", squad: "Alpha", leader: "Nova" },
                  now: Date.parse("2026-11-07T15:00:00Z"),
                  copy: getDirectMessages(locale),
                  frame: { clanName: "NOVA", timeZone: "Europe/Prague" },
              })
    return (
        <div
            ref={frame}
            className={
                fit ? "relative min-h-0 flex-1 overflow-hidden" : undefined
            }
        >
            <div
                ref={message}
                inert
                className="min-w-0 select-none"
                style={
                    fit
                        ? {
                              position: "absolute",
                              width: 540,
                              left: "50%",
                              transformOrigin: "top center",
                              top: 0,
                              transform: `translateX(-50%) scale(${scale})`,
                          }
                        : undefined
                }
            >
                <DiscordMessagePreview
                    view={view}
                    language={locale}
                    labels={dictionary.discordPreview}
                    author={{ name: "Logi", time: "18:00" }}
                    timeZone="Europe/Prague"
                    now={Date.parse("2026-11-07T15:00:00Z")}
                />
            </div>
        </div>
    )
}
