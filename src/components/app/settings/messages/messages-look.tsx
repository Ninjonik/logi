"use client"

import { Lock } from "lucide-react"
import { useId } from "react"
import Link from "next/link"

import {
    normalizeAccentColor,
    type MessageIconDensity,
    type MessageStyle,
} from "@/domain/discord-messages/message-style"
import { DEFAULT_MESSAGE_ACCENT_HEX } from "@/domain/discord-messages/format"
import { SegmentedControl } from "@/components/app/settings/settings-panel"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import { SettingsMessagePreview } from "./message-preview-panel"

/** The clan-wide faction signs (N1-06): ★/✚ and the Wardogs letters. */
const FACTION_SIGNS = [
    { key: "allies", sign: "★", boxed: false },
    { key: "axis", sign: "✚", boxed: false },
    { key: "valkyra", sign: "V", boxed: true },
    { key: "manticore", sign: "M", boxed: true },
    { key: "lonestar", sign: "L", boxed: true },
] as const

function Field({
    label,
    help,
    children,
    labelFor,
    labelId,
}: {
    label: string
    help?: string
    children: React.ReactNode
    labelFor?: string
    labelId?: string
}) {
    return (
        <div className="space-y-2 border-t pt-4 first:border-t-0 first:pt-0">
            <div className="space-y-0.5">
                {labelFor ? (
                    <label htmlFor={labelFor} className="text-sm font-medium">
                        {label}
                    </label>
                ) : (
                    <div id={labelId} className="text-sm font-medium">
                        {label}
                    </div>
                )}
                {help ? (
                    <p className="text-muted-foreground text-[13px] leading-5">
                        {help}
                    </p>
                ) : null}
            </div>
            {children}
        </div>
    )
}

/**
 * "Vzhled všech zpráv" (board N1 1.1): the clan colour, the icon density,
 * the clan-wide faction signs and the bot language, next to a live preview
 * of a match announcement that follows the colour and icons as they change.
 */
export function MessagesLook({
    accentColor,
    iconDensity,
    onChange,
    language,
    timeZone,
    siteUrl,
    hrefs,
    dictionary,
}: {
    /** As typed; a valid hex colour or blank. */
    accentColor: string
    iconDensity: MessageIconDensity
    onChange(patch: {
        accentColor?: string
        iconDensity?: MessageIconDensity
    }): void
    language: "en" | "cs" | "de"
    timeZone: string
    siteUrl: string
    hrefs: { channels: string; factionSigns: string }
    dictionary: Dictionary
}) {
    const text = dictionary.settingsHub.messagesPage
    const ids = useId()
    const typed = accentColor.trim()
    const valid = normalizeAccentColor(typed)
    const invalid = Boolean(typed) && !valid
    const swatch = valid ?? DEFAULT_MESSAGE_ACCENT_HEX
    const style: MessageStyle = {
        iconDensity,
        ...(valid ? { accentColor: valid } : {}),
    }
    return (
        <section
            aria-labelledby={`${ids}-look`}
            className="bg-card rounded-2xl border p-5 sm:p-6"
        >
            <div className="space-y-1 border-b pb-4">
                <h2 id={`${ids}-look`} className="text-base font-semibold">
                    {text.lookTitle}
                </h2>
                <p className="text-muted-foreground text-[13px] leading-5">
                    {text.lookIntro}
                </p>
            </div>
            <div className="grid gap-6 pt-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                <div className="min-w-0 space-y-4">
                    <Field
                        label={text.clanColor}
                        help={text.clanColorHelp}
                        labelFor={`${ids}-color`}
                    >
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="relative size-9 shrink-0 overflow-hidden rounded-lg border shadow-xs">
                                <span
                                    aria-hidden="true"
                                    className="absolute inset-0"
                                    style={{ backgroundColor: swatch }}
                                />
                                <input
                                    type="color"
                                    aria-label={text.clanColorPicker}
                                    value={swatch.toLowerCase()}
                                    onChange={(event) =>
                                        onChange({
                                            accentColor:
                                                event.target.value.toUpperCase(),
                                        })
                                    }
                                    className="absolute inset-0 size-full cursor-pointer opacity-0"
                                />
                            </span>
                            <Input
                                id={`${ids}-color`}
                                value={accentColor}
                                onChange={(event) =>
                                    onChange({
                                        accentColor: event.target.value,
                                    })
                                }
                                placeholder={DEFAULT_MESSAGE_ACCENT_HEX}
                                spellCheck={false}
                                autoComplete="off"
                                maxLength={7}
                                aria-invalid={invalid || undefined}
                                aria-describedby={`${ids}-color-note`}
                                className="w-32 rounded-lg font-mono uppercase"
                            />
                        </div>
                        <p
                            id={`${ids}-color-note`}
                            className={cn(
                                "text-[13px] leading-5",
                                invalid
                                    ? "text-destructive"
                                    : "text-muted-foreground"
                            )}
                        >
                            {invalid
                                ? text.clanColorInvalid
                                : valid && valid !== DEFAULT_MESSAGE_ACCENT_HEX
                                  ? text.clanColorCustom
                                  : text.clanColorDefault}
                        </p>
                    </Field>
                    <Field
                        label={text.icons}
                        help={text.iconsHelp}
                        labelId={`${ids}-icons`}
                    >
                        <SegmentedControl<MessageIconDensity>
                            labelledBy={`${ids}-icons`}
                            value={iconDensity}
                            onChange={(value) =>
                                onChange({ iconDensity: value })
                            }
                            options={[
                                { value: "sparse", label: text.iconsSparse },
                                { value: "rich", label: text.iconsRich },
                            ]}
                        />
                    </Field>
                    <Field
                        label={text.factions}
                        help={text.factionsHelp}
                        labelId={`${ids}-factions`}
                    >
                        <ul
                            aria-labelledby={`${ids}-factions`}
                            className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm"
                        >
                            {FACTION_SIGNS.map((faction) => (
                                <li
                                    key={faction.key}
                                    className="inline-flex items-center gap-1.5"
                                >
                                    <span
                                        aria-hidden="true"
                                        className={cn(
                                            "inline-flex items-center justify-center text-xs font-semibold",
                                            faction.boxed
                                                ? "size-5 rounded border"
                                                : "w-3.5"
                                        )}
                                    >
                                        {faction.sign}
                                    </span>
                                    {text.factionNames[faction.key]}
                                </li>
                            ))}
                        </ul>
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="text-muted-foreground text-[13px]">
                                {text.factionsDefault}
                            </span>
                            <Button
                                asChild
                                variant="outline"
                                size="sm"
                                className="rounded-lg"
                            >
                                <Link href={hrefs.factionSigns}>
                                    {text.factionsChange}
                                </Link>
                            </Button>
                        </div>
                    </Field>
                    <Field label={text.language}>
                        <div className="space-y-0.5 text-sm">
                            <div>{text.languages[language]}</div>
                            <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                                <Lock
                                    className="size-3 shrink-0"
                                    aria-hidden="true"
                                />
                                <span>
                                    {text.languageFrom}{" "}
                                    <Link
                                        href={hrefs.channels}
                                        className="text-foreground underline underline-offset-3"
                                    >
                                        {text.languageLink}
                                    </Link>
                                </span>
                            </div>
                            <p className="text-muted-foreground text-xs">
                                {text.languageScope}
                            </p>
                        </div>
                    </Field>
                </div>
                <section
                    aria-label={text.livePreviewLabel}
                    className="min-w-0 space-y-2"
                >
                    <h3 className="text-sm font-semibold">
                        {text.livePreview}
                    </h3>
                    <SettingsMessagePreview
                        kind="announcement"
                        language={language}
                        style={style}
                        rosterVariant="photo_text"
                        timeZone={timeZone}
                        siteUrl={siteUrl}
                        dictionary={dictionary}
                    />
                    <p className="text-muted-foreground text-xs">
                        {iconDensity === "rich"
                            ? text.livePreviewRich
                            : text.livePreviewSparse}
                    </p>
                </section>
            </div>
        </section>
    )
}
