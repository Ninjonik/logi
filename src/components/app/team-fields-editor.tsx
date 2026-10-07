"use client"

import {
    TEAM_DESCRIPTION_MAX,
    TEAM_NAME_MAX,
    TEAM_SHORT_CODE_MAX,
} from "@/domain/teams/team"
import type {
    TeamEditorField,
    TeamEditorValues,
} from "@/lib/teams-admin/team-editor"
import { uploadPlatformTeamLogo } from "@/lib/teams-admin/team-admin-client"
import { formatImageUploadMessage } from "@/lib/image-asset-upload"
import { fillTemplate } from "@/lib/teams-admin/team-admin-list"
import { IMAGE_INPUT_TYPES } from "@/domain/assets/image-asset"
import { TeamLogo } from "@/components/app/team-logo"
import type { Dictionary } from "@/i18n/dictionaries"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useRef, useState } from "react"

export type TeamCatalogLabels = Dictionary["teamCatalogAdmin"]
type Update = (values: TeamEditorValues) => TeamEditorValues

const ACCEPT = IMAGE_INPUT_TYPES.join(",")

/**
 * Logo, name, short code, description and links of a catalogue team. Logos
 * are uploaded to the platform scope; updates are functional so an upload
 * finishing later never overwrites what the administrator typed meanwhile.
 */
export function TeamFieldsEditor({
    labels,
    idPrefix,
    values,
    onChange,
    disabled,
    invalidField,
    onUploadingChange,
    autoFocus = false,
}: {
    labels: TeamCatalogLabels
    idPrefix: string
    values: TeamEditorValues
    onChange(update: Update): void
    disabled: boolean
    invalidField: TeamEditorField | null
    onUploadingChange(uploading: boolean): void
    autoFocus?: boolean
}) {
    const fileInput = useRef<HTMLInputElement>(null)
    const [uploading, setUploading] = useState(false)
    const [uploadError, setUploadError] = useState<string | null>(null)
    const busy = disabled || uploading
    const errorId = (field: TeamEditorField) => `${idPrefix}-${field}-error`
    const describedBy = (field: TeamEditorField, help?: string) =>
        [help, invalidField === field ? errorId(field) : null]
            .filter(Boolean)
            .join(" ") || undefined
    const fieldError = (field: TeamEditorField) =>
        invalidField === field ? (
            <p id={errorId(field)} className="text-destructive text-xs">
                {labels.fieldErrors[field]}
            </p>
        ) : null

    async function upload(file: File) {
        setUploadError(null)
        setUploading(true)
        onUploadingChange(true)
        try {
            const result = await uploadPlatformTeamLogo(file)
            if (result.ok) {
                const logo = { assetId: result.asset.id, url: result.asset.url }
                onChange((current) => ({ ...current, logo }))
            } else
                setUploadError(
                    formatImageUploadMessage(
                        labels.uploadErrors[result.error],
                        result.retryAfterMs
                    )
                )
        } finally {
            setUploading(false)
            onUploadingChange(false)
            if (fileInput.current) fileInput.current.value = ""
        }
    }

    return (
        <div className="space-y-5">
            <fieldset className="space-y-2">
                <legend className="text-sm leading-none font-medium">
                    {labels.logo}
                </legend>
                <div className="flex items-start gap-4 pt-2">
                    <TeamLogo
                        name={values.name.trim()}
                        shortCode={values.shortCode.trim() || null}
                        logoUrl={values.logo.url}
                        className="size-16 text-base"
                    />
                    <div className="space-y-2">
                        <input
                            ref={fileInput}
                            type="file"
                            accept={ACCEPT}
                            className="sr-only"
                            tabIndex={-1}
                            aria-hidden
                            disabled={busy}
                            onChange={(event) => {
                                const file = event.target.files?.[0]
                                if (file) void upload(file)
                            }}
                        />
                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={busy}
                                aria-describedby={`${idPrefix}-logo-help`}
                                onClick={() => fileInput.current?.click()}
                            >
                                {uploading ? labels.uploading : labels.upload}
                            </Button>
                            {values.logo.assetId ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    disabled={busy}
                                    onClick={() =>
                                        onChange((current) => ({
                                            ...current,
                                            logo: { assetId: null, url: null },
                                        }))
                                    }
                                >
                                    {labels.removeLogo}
                                </Button>
                            ) : null}
                        </div>
                        <p
                            id={`${idPrefix}-logo-help`}
                            className="text-muted-foreground text-xs"
                        >
                            {labels.logoHelp}
                        </p>
                        {uploadError ? (
                            <p
                                role="alert"
                                className="text-destructive text-xs"
                            >
                                {uploadError}
                            </p>
                        ) : null}
                    </div>
                </div>
            </fieldset>
            <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-name`}>{labels.name}</Label>
                <Input
                    id={`${idPrefix}-name`}
                    value={values.name}
                    maxLength={TEAM_NAME_MAX}
                    required
                    autoFocus={autoFocus}
                    autoComplete="off"
                    disabled={disabled}
                    aria-invalid={invalidField === "name" || undefined}
                    aria-describedby={describedBy("name")}
                    onChange={(event) => {
                        const name = event.target.value
                        onChange((current) => ({ ...current, name }))
                    }}
                />
                {fieldError("name")}
            </div>
            <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-code`}>{labels.shortCode}</Label>
                <Input
                    id={`${idPrefix}-code`}
                    value={values.shortCode}
                    maxLength={TEAM_SHORT_CODE_MAX}
                    autoComplete="off"
                    disabled={disabled}
                    aria-invalid={invalidField === "shortCode" || undefined}
                    aria-describedby={describedBy(
                        "shortCode",
                        `${idPrefix}-code-help`
                    )}
                    onChange={(event) => {
                        const shortCode = event.target.value
                        onChange((current) => ({ ...current, shortCode }))
                    }}
                />
                <p
                    id={`${idPrefix}-code-help`}
                    className="text-muted-foreground text-xs"
                >
                    {labels.shortCodeHelp}
                </p>
                {fieldError("shortCode")}
            </div>
            <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-description`}>
                    {labels.descriptionField}
                </Label>
                <Textarea
                    id={`${idPrefix}-description`}
                    value={values.description}
                    maxLength={TEAM_DESCRIPTION_MAX}
                    rows={3}
                    disabled={disabled}
                    aria-invalid={invalidField === "description" || undefined}
                    aria-describedby={describedBy(
                        "description",
                        `${idPrefix}-description-help`
                    )}
                    onChange={(event) => {
                        const description = event.target.value
                        onChange((current) => ({ ...current, description }))
                    }}
                />
                <p
                    id={`${idPrefix}-description-help`}
                    className="text-muted-foreground text-xs"
                >
                    {labels.descriptionHelp} ({values.description.length}/
                    {TEAM_DESCRIPTION_MAX})
                </p>
                {fieldError("description")}
            </div>
            <fieldset
                className="space-y-2"
                aria-describedby={describedBy(
                    "links",
                    `${idPrefix}-links-help`
                )}
            >
                <legend className="text-sm leading-none font-medium">
                    {labels.links}
                </legend>
                {values.links.map((link, index) => {
                    const id = `${idPrefix}-link-${index}`
                    return (
                        <div key={id} className="space-y-1 pt-1">
                            <Label
                                htmlFor={id}
                                className="text-muted-foreground text-xs"
                            >
                                {fillTemplate(labels.linkLabel, {
                                    number: String(index + 1),
                                })}
                            </Label>
                            <Input
                                id={id}
                                type="url"
                                inputMode="url"
                                placeholder="https://"
                                value={link}
                                maxLength={300}
                                autoComplete="off"
                                disabled={disabled}
                                aria-invalid={
                                    invalidField === "links" || undefined
                                }
                                onChange={(event) => {
                                    const value = event.target.value
                                    onChange((current) => ({
                                        ...current,
                                        links: current.links.map(
                                            (item, position) =>
                                                position === index
                                                    ? value
                                                    : item
                                        ),
                                    }))
                                }}
                            />
                        </div>
                    )
                })}
                <p
                    id={`${idPrefix}-links-help`}
                    className="text-muted-foreground text-xs"
                >
                    {labels.linksHelp}
                </p>
                {fieldError("links")}
            </fieldset>
        </div>
    )
}
