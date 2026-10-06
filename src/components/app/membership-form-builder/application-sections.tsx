"use client"

import { Check, Clock, Info, Plus } from "lucide-react"
import type { ReactNode } from "react"
import Link from "next/link"

import {
    categoryAsksSpecialization,
    categoryGame,
    isHellLetLoose,
    type ApplicationCategory,
} from "@/domain/membership/application-form"
import {
    decisionTable,
    type DecisionRolePolicy,
} from "@/domain/membership/application-decision"
import { DiscordMessagePreview } from "@/components/app/discord-preview/discord-message-preview"
import { DiscordMarkdownTextarea } from "@/components/app/discord-markdown"
import type { MessageView } from "@/domain/discord-messages/message-view"
import { categoryName } from "@/domain/membership/application-views"
import { fillTemplate } from "@/domain/discord-messages/format"
import type { MembershipCategory } from "@/types/domain"
import type { Dictionary } from "@/i18n/dictionaries"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

import type { FormBuilderPreview } from "./form-builder"

type Copy = Dictionary["membershipApplication"]

export function SectionCard({
    title,
    description,
    children,
}: {
    title: string
    description?: string
    children: ReactNode
}) {
    return (
        <section className="bg-card space-y-4 rounded-2xl border p-4 sm:p-5">
            <div className="space-y-1">
                <h2 className="text-lg font-semibold">{title}</h2>
                {description ? (
                    <p className="text-muted-foreground text-sm">
                        {description}
                    </p>
                ) : null}
            </div>
            {children}
        </section>
    )
}

function RoleChip({ children }: { children: ReactNode }) {
    return (
        <span className="bg-background rounded-md border px-1.5 py-0.5 text-xs whitespace-nowrap">
            {children}
        </span>
    )
}

function categoryInitials(category: MembershipCategory) {
    const words = (category.label ?? "").trim().split(/\s+/).filter(Boolean)
    return (
        words
            .slice(0, 2)
            .map((word) => word[0])
            .join("")
            .toUpperCase() || "?"
    )
}

/** "Kategorie" on the Přihláška tab (N4-27..N4-32, N4-B05). */
export function CategoriesSummary({
    categories,
    roleName,
    clanRoleName,
    rolesHref,
    specializationInForm,
    t,
    gameShort,
    onSpecialization,
    onEdit,
    onAdd,
    onRestoreSpecialization,
}: {
    categories: MembershipCategory[]
    roleName(roleId: string): string
    clanRoleName: string | null
    rolesHref: string
    specializationInForm: boolean
    t: Copy["categories"]
    gameShort: Copy["form"]["gameShort"]
    onSpecialization(categoryId: string, ask: boolean): void
    onEdit(categoryId: string): void
    onAdd(): void
    onRestoreSpecialization(): void
}) {
    const roles = (ids: readonly string[]) =>
        ids.length ? (
            <span className="flex flex-wrap gap-1">
                {ids.map((roleId) => (
                    <RoleChip key={roleId}>@{roleName(roleId)}</RoleChip>
                ))}
            </span>
        ) : (
            <span className="text-muted-foreground">{t.noRole}</span>
        )
    const hasHll = categories.some((category) =>
        isHellLetLoose(categoryGame(category))
    )
    const [noteBefore, noteAfter] = t.note.split("@{role}")
    return (
        <SectionCard title={t.title} description={t.intro}>
            {categories.length ? (
                <div className="relative -mx-4 overflow-x-auto sm:-mx-5">
                    <table className="w-full min-w-[46rem] text-sm">
                        <thead className="bg-muted/50 text-left text-xs">
                            <tr>
                                <th
                                    scope="col"
                                    className="px-4 py-2 font-semibold sm:px-5"
                                >
                                    {t.columns.category}
                                </th>
                                <th
                                    scope="col"
                                    className="px-2 py-2 font-semibold"
                                >
                                    {t.columns.game}
                                </th>
                                <th
                                    scope="col"
                                    className="px-2 py-2 font-semibold"
                                >
                                    {t.columns.roles}
                                </th>
                                <th
                                    scope="col"
                                    className="px-2 py-2 font-semibold"
                                >
                                    {t.columns.thread}
                                </th>
                                <th
                                    scope="col"
                                    className="px-2 py-2 font-semibold"
                                >
                                    {t.columns.specialization}
                                </th>
                                <th scope="col" className="px-4 py-2 sm:px-5">
                                    <span className="sr-only">
                                        {t.columns.actions}
                                    </span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {categories.map((category) => {
                                const name = categoryName(category)
                                const game = categoryGame(category)
                                const hll = isHellLetLoose(game)
                                const mercenary =
                                    category.assignmentType === "mercenary"
                                return (
                                    <tr key={category.id}>
                                        <td className="px-4 py-2.5 sm:px-5">
                                            <span className="flex items-center gap-2">
                                                <span
                                                    aria-hidden="true"
                                                    className="bg-muted flex size-7 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold"
                                                >
                                                    {categoryInitials(category)}
                                                </span>
                                                {name}
                                            </span>
                                        </td>
                                        <td className="px-2 py-2.5">
                                            <RoleChip>
                                                {gameShort[game]}
                                            </RoleChip>
                                        </td>
                                        <td className="px-2 py-2.5">
                                            <span className="flex flex-wrap items-center gap-1">
                                                {mercenary ? (
                                                    <span className="text-muted-foreground">
                                                        {t.noRecruit}
                                                    </span>
                                                ) : (
                                                    roles(
                                                        category.recruitRoleIds
                                                    )
                                                )}
                                                <span aria-hidden="true">
                                                    →
                                                </span>
                                                {roles(category.finalRoleIds)}
                                            </span>
                                        </td>
                                        <td className="px-2 py-2.5">
                                            {category.supportRoleIds.length ? (
                                                roles(category.supportRoleIds)
                                            ) : (
                                                <span className="text-muted-foreground">
                                                    {t.admins}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-2 py-2.5">
                                            <Switch
                                                aria-label={fillTemplate(
                                                    t.specializationAria,
                                                    { name }
                                                )}
                                                checked={categoryAsksSpecialization(
                                                    category as ApplicationCategory
                                                )}
                                                disabled={!hll}
                                                onCheckedChange={(checked) =>
                                                    onSpecialization(
                                                        category.id,
                                                        checked
                                                    )
                                                }
                                            />
                                        </td>
                                        <td className="px-4 py-2.5 text-right sm:px-5">
                                            <Button
                                                type="button"
                                                variant="link"
                                                size="sm"
                                                className="h-auto p-0"
                                                aria-label={fillTemplate(
                                                    t.editAria,
                                                    { name }
                                                )}
                                                onClick={() =>
                                                    onEdit(category.id)
                                                }
                                            >
                                                {t.edit}
                                            </Button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="text-muted-foreground text-sm">{t.empty}</p>
            )}
            {hasHll && !specializationInForm ? (
                <div className="bg-muted/50 flex flex-wrap items-center justify-between gap-2 rounded-lg p-3 text-sm">
                    <span>{t.specializationMissing}</span>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="bg-background rounded-lg"
                        onClick={onRestoreSpecialization}
                    >
                        {t.restoreSpecialization}
                    </Button>
                </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    disabled={categories.length >= 20}
                    onClick={onAdd}
                >
                    <Plus className="size-4" aria-hidden="true" />
                    {t.add}
                </Button>
                <span className="text-muted-foreground text-xs">
                    {clanRoleName ? (
                        <>
                            {noteBefore}
                            <Link
                                href={rolesHref}
                                className="underline-offset-4 hover:underline"
                            >
                                @{clanRoleName}
                            </Link>
                            {noteAfter}
                        </>
                    ) : (
                        <Link
                            href={rolesHref}
                            className="underline-offset-4 hover:underline"
                        >
                            {t.noteNoRole}
                        </Link>
                    )}
                </span>
            </div>
        </SectionCard>
    )
}

function SwitchLine({
    id,
    title,
    help,
    checked,
    onChange,
}: {
    id: string
    title: string
    help: string
    checked: boolean
    onChange(checked: boolean): void
}) {
    return (
        <div className="flex items-start gap-3">
            <Switch
                id={id}
                checked={checked}
                onCheckedChange={onChange}
                className="mt-0.5"
            />
            <Label htmlFor={id} className="block space-y-0.5 font-normal">
                <span className="block text-sm">{title}</span>
                <span className="text-muted-foreground block text-xs">
                    {help}
                </span>
            </Label>
        </div>
    )
}

function FixedLine({
    icon,
    title,
    help,
}: {
    icon: ReactNode
    title: string
    help: string
}) {
    return (
        <div className="flex items-start gap-3">
            <span className="flex w-9 shrink-0 justify-center pt-0.5">
                {icon}
            </span>
            <p className="space-y-0.5">
                <span className="block text-sm">{title}</span>
                <span className="text-muted-foreground block text-xs">
                    {help}
                </span>
            </p>
        </div>
    )
}

/** "Po odeslání" (N4-33..N4-41, N4-B06). */
export function AfterSubmitSection({
    threadChannelName,
    mentionSupportRoles,
    autoRecruit,
    sendConfirmationDm,
    inviteIndividually,
    inviteCopy,
    welcome,
    decisionCard,
    decisionCategory,
    policy,
    roleName,
    preview,
    t,
    onChange,
}: {
    threadChannelName: string | null
    mentionSupportRoles: boolean
    autoRecruit: boolean
    sendConfirmationDm: boolean
    inviteIndividually: boolean
    inviteCopy: { title: string; description: string }
    welcome: string
    decisionCard: MessageView | null
    decisionCategory: MembershipCategory | null
    policy: DecisionRolePolicy | null
    roleName(roleId: string): string
    preview: FormBuilderPreview
    t: Copy["after"]
    onChange(patch: {
        mentionSupportRoles?: boolean
        autoAssignRecruitOnApply?: boolean
        sendConfirmationDm?: boolean
        inviteSupportMembersIndividually?: boolean
        applicationWelcomeMessage?: string
    }): void
}) {
    const rows =
        decisionCategory && policy
            ? decisionTable(policy, decisionCategory.assignmentType)
            : []
    const changes = (add: readonly string[], remove: readonly string[]) => {
        const parts = [
            ...add.map((roleId) => `+ @${roleName(roleId)}`),
            ...remove.map((roleId) => `− @${roleName(roleId)}`),
        ]
        return parts.length ? parts.join(", ") : t.noRoleChange
    }
    return (
        <SectionCard title={t.title}>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
                <div className="min-w-0 space-y-4">
                    <FixedLine
                        icon={
                            <Check
                                className="size-4 text-emerald-600"
                                aria-hidden="true"
                            />
                        }
                        title={
                            threadChannelName
                                ? fillTemplate(t.thread, {
                                      channel: threadChannelName,
                                  })
                                : t.threadNoChannel
                        }
                        help={t.threadHelp}
                    />
                    <SwitchLine
                        id="membership-mention-support"
                        title={t.mention}
                        help={t.mentionHelp}
                        checked={mentionSupportRoles}
                        onChange={(checked) =>
                            onChange({ mentionSupportRoles: checked })
                        }
                    />
                    <SwitchLine
                        id="membership-invite-individually"
                        title={inviteCopy.title}
                        help={inviteCopy.description}
                        checked={inviteIndividually}
                        onChange={(checked) =>
                            onChange({
                                inviteSupportMembersIndividually: checked,
                            })
                        }
                    />
                    <SwitchLine
                        id="membership-auto-recruit"
                        title={t.recruit}
                        help={t.recruitHelp}
                        checked={autoRecruit}
                        onChange={(checked) =>
                            onChange({ autoAssignRecruitOnApply: checked })
                        }
                    />
                    <SwitchLine
                        id="membership-confirmation-dm"
                        title={t.dm}
                        help={t.dmHelp}
                        checked={sendConfirmationDm}
                        onChange={(checked) =>
                            onChange({ sendConfirmationDm: checked })
                        }
                    />
                    <FixedLine
                        icon={
                            <Clock
                                className="text-muted-foreground size-4"
                                aria-hidden="true"
                            />
                        }
                        title={t.keep}
                        help={t.keepHelp}
                    />
                    <div className="space-y-2">
                        <Label>{t.welcome}</Label>
                        <DiscordMarkdownTextarea
                            value={welcome}
                            onChange={(value) =>
                                onChange({ applicationWelcomeMessage: value })
                            }
                            maxLength={1200}
                            className="min-h-20 rounded-xl"
                            rows={3}
                            placeholder={t.welcomePlaceholder}
                        />
                        <p className="text-muted-foreground text-xs">
                            {t.welcomeHelp}
                        </p>
                    </div>
                </div>
                <div className="min-w-0 space-y-3">
                    <h3 className="text-sm font-semibold">
                        {t.decisionPreview}
                    </h3>
                    {decisionCard ? (
                        <DiscordMessagePreview
                            view={decisionCard}
                            language={preview.language}
                            style={preview.style}
                            labels={preview.labels}
                            now={preview.now}
                            timeZone={preview.timeZone}
                            mentions={preview.mentions}
                            author={{ name: "Logi" }}
                        />
                    ) : null}
                    {decisionCategory && policy ? (
                        <div className="relative overflow-x-auto rounded-xl border">
                            <table className="w-full min-w-[24rem] text-sm">
                                <caption className="sr-only">
                                    {fillTemplate(t.tableCaption, {
                                        category:
                                            categoryName(decisionCategory),
                                    })}
                                </caption>
                                <thead className="bg-muted/50 text-left text-xs">
                                    <tr>
                                        <th
                                            scope="col"
                                            className="px-3 py-2 font-semibold"
                                        >
                                            {t.table.button}
                                        </th>
                                        <th
                                            scope="col"
                                            className="px-3 py-2 font-semibold"
                                        >
                                            {t.table.roles}
                                        </th>
                                        <th
                                            scope="col"
                                            className="px-3 py-2 font-semibold"
                                        >
                                            {t.table.applicant}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y align-top">
                                    {rows.map((row) => (
                                        <tr key={row.outcome}>
                                            <th
                                                scope="row"
                                                className="px-3 py-2 text-left font-normal"
                                            >
                                                {t.outcomes[row.outcome]}
                                            </th>
                                            <td className="px-3 py-2">
                                                {policy.roleSync
                                                    ? changes(
                                                          row.add,
                                                          row.remove
                                                      )
                                                    : t.noRoleChange}
                                            </td>
                                            <td className="px-3 py-2">
                                                {row.outcome === "denied"
                                                    ? t.gets.reason
                                                    : t.gets.result}
                                            </td>
                                        </tr>
                                    ))}
                                    <tr>
                                        <th
                                            scope="row"
                                            className="px-3 py-2 text-left font-normal"
                                        >
                                            {t.outcomes.pending}
                                        </th>
                                        <td className="px-3 py-2">
                                            {t.noRoleChange}
                                        </td>
                                        <td className="px-3 py-2">
                                            {t.gets.pending}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    ) : null}
                    {policy && !policy.roleSync ? (
                        <p className="text-muted-foreground text-xs">
                            {t.roleSyncOff}
                        </p>
                    ) : null}
                    <p className="text-muted-foreground text-xs">
                        {t.decisionNote}
                    </p>
                </div>
            </div>
        </SectionCard>
    )
}

/** "Varianta B · vyplnění na webu" (N4-42, N4-43). */
export function WebVariantSection({
    enabled,
    url,
    t,
    onChange,
}: {
    enabled: boolean
    url: string
    t: Copy["web"]
    onChange(enabled: boolean): void
}) {
    return (
        <SectionCard title={t.title}>
            <SwitchLine
                id="membership-web-form"
                title={t.switch}
                help={t.help}
                checked={enabled}
                onChange={onChange}
            />
            <p className="text-muted-foreground flex gap-2 pl-12 text-xs">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                {t.note}
            </p>
            {enabled ? (
                <p className="pl-12 text-xs">
                    <span className="text-muted-foreground">{t.address}: </span>
                    <span className="break-all">{url}</span>
                </p>
            ) : null}
        </SectionCard>
    )
}
