"use client"

import { MAX_SIGNUP_GROUP_LIMIT } from "@/domain/events/signup-limits"

import { SHARED_INVITATIONS_CHANGED } from "@/hooks/use-pending-match-invitations"

import {
    inviteSharedClan,
    respondSharedInvitation,
    revokeSharedInvitation,
    searchSharedClans,
    type SharedInvitation,
} from "@/lib/gateways/shared-matches"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Command,
    CommandInput,
    CommandItem,
    CommandList,
    CommandEmpty,
} from "@/components/ui/command"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { SharedSignupGroup } from "@/domain/events/shared-match"
import { useEffect, useState, useTransition } from "react"
import { GroupInlineIcons } from "./group-inline-icons"
import type { Dictionary } from "@/i18n/dictionaries"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import type { Group } from "@/types/domain"
import { Plus } from "lucide-react"
import { toast } from "sonner"

export function SharedMatchPanel({
    serverId,
    eventId,
    invitations,
    incoming = false,
    groups = [],
    dictionary,
    locale,
}: {
    serverId: string
    eventId?: string
    invitations: SharedInvitation[]
    incoming?: boolean
    groups?: Group[]
    dictionary: Dictionary
    locale: string
}) {
    const t = dictionary.sharedMatches
    const router = useRouter()
    const [pending, start] = useTransition()
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState("")
    const [clans, setClans] = useState<{ guildId: string; name: string }[]>([])
    const [selected, setSelected] = useState<{
        guildId: string
        name: string
    } | null>(null)
    const [signupGroups, setSignupGroups] = useState<SharedSignupGroup[]>(() =>
        groups.map((group) => ({ groupId: group.id }))
    )
    useEffect(() => {
        let active = true
        const timer = setTimeout(() => {
            if (search.trim().length < 2) {
                setClans([])
                return
            }
            void searchSharedClans(serverId, search)
                .then((items) => {
                    if (active) setClans(items)
                })
                .catch(() => {
                    if (active) setClans([])
                })
        }, 250)
        return () => {
            active = false
            clearTimeout(timer)
        }
    }, [search, serverId])
    const act = (operation: () => Promise<unknown>) =>
        start(async () => {
            try {
                await operation()
                window.dispatchEvent(new Event(SHARED_INVITATIONS_CHANGED))
                router.refresh()
            } catch (error) {
                toast.error(error instanceof Error ? error.message : t.error)
            }
        })
    if (incoming && !invitations.length) return null
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle>{incoming ? t.incoming : t.title}</CardTitle>
                {eventId && !incoming ? (
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                                <Plus className="size-4" />
                                {t.invite}
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-h-[85vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>{t.invite}</DialogTitle>
                                <DialogDescription>
                                    {t.signupGroupsHelp}
                                </DialogDescription>
                            </DialogHeader>
                            <Command shouldFilter={false}>
                                <CommandInput
                                    placeholder={t.search}
                                    value={search}
                                    onValueChange={(value) => {
                                        setSearch(value)
                                        setSelected(null)
                                    }}
                                />
                                <CommandList>
                                    <CommandEmpty>
                                        {dictionary.userManagement.noResults}
                                    </CommandEmpty>
                                    {clans.map((clan) => (
                                        <CommandItem
                                            key={clan.guildId}
                                            value={clan.guildId}
                                            onSelect={() => {
                                                setSelected(clan)
                                                setSearch(clan.name)
                                            }}
                                        >
                                            {clan.name}
                                            {selected?.guildId === clan.guildId
                                                ? " ✓"
                                                : ""}
                                        </CommandItem>
                                    ))}
                                </CommandList>
                            </Command>
                            {selected ? (
                                <Badge variant="secondary">
                                    {selected.name}
                                </Badge>
                            ) : null}
                            <p className="text-sm font-medium">
                                {dictionary.event.fields.signupGroupIds}
                            </p>
                            {groups.map((group) => {
                                const selectedGroup = signupGroups.find(
                                    (entry) => entry.groupId === group.id
                                )
                                return (
                                    <div
                                        key={group.id}
                                        className="flex items-center gap-3"
                                    >
                                        <Checkbox
                                            id={`invite-group-${group.id}`}
                                            checked={Boolean(selectedGroup)}
                                            onCheckedChange={(checked) =>
                                                setSignupGroups((current) =>
                                                    checked
                                                        ? [
                                                              ...current,
                                                              {
                                                                  groupId:
                                                                      group.id,
                                                              },
                                                          ]
                                                        : current.filter(
                                                              (entry) =>
                                                                  entry.groupId !==
                                                                  group.id
                                                          )
                                                )
                                            }
                                        />
                                        <Label
                                            htmlFor={`invite-group-${group.id}`}
                                            className="flex flex-1 items-center gap-2"
                                        >
                                            <GroupInlineIcons
                                                groupsById={
                                                    new Map([[group.id, group]])
                                                }
                                                signupGroupName={group.name}
                                            />
                                            {group.name}
                                        </Label>
                                        {selectedGroup ? (
                                            <Input
                                                type="number"
                                                min={1}
                                                max={MAX_SIGNUP_GROUP_LIMIT}
                                                className="w-28"
                                                aria-label={dictionary.newMatch.signups.capLabel.replace(
                                                    "{name}",
                                                    group.name
                                                )}
                                                placeholder={
                                                    dictionary.newMatch.signups
                                                        .noLimit
                                                }
                                                value={selectedGroup.max ?? ""}
                                                onChange={(event) =>
                                                    setSignupGroups((current) =>
                                                        current.map((entry) =>
                                                            entry.groupId ===
                                                            group.id
                                                                ? {
                                                                      groupId:
                                                                          entry.groupId,
                                                                      ...(event
                                                                          .target
                                                                          .value
                                                                          ? {
                                                                                max: Number(
                                                                                    event
                                                                                        .target
                                                                                        .value
                                                                                ),
                                                                            }
                                                                          : {}),
                                                                  }
                                                                : entry
                                                        )
                                                    )
                                                }
                                            />
                                        ) : null}
                                    </div>
                                )
                            })}
                            <Button
                                disabled={
                                    pending ||
                                    !selected ||
                                    (groups.length > 0 && !signupGroups.length)
                                }
                                onClick={() =>
                                    act(async () => {
                                        if (!selected) return
                                        await inviteSharedClan(
                                            serverId,
                                            eventId,
                                            selected.guildId,
                                            [],
                                            signupGroups
                                        )
                                        setOpen(false)
                                    })
                                }
                            >
                                {t.invite}
                            </Button>
                        </DialogContent>
                    </Dialog>
                ) : null}
            </CardHeader>
            <CardContent className="space-y-3">
                {!invitations.length ? (
                    <p className="text-muted-foreground text-sm">{t.empty}</p>
                ) : (
                    invitations.map((item) => (
                        <div
                            key={item.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                        >
                            <div>
                                <p className="font-medium">
                                    {incoming
                                        ? `${item.matchName} · ${item.hostName}`
                                        : item.guestName}
                                </p>
                                <p className="text-muted-foreground text-sm">
                                    {item.signupGroups
                                        ?.map(
                                            (group) =>
                                                `${group.name}${group.max === undefined ? "" : ` × ${group.max}`}`
                                        )
                                        .join(" · ") ||
                                        item.requestedRoles
                                            .map(
                                                (role) =>
                                                    `${role.role} × ${role.count}`
                                            )
                                            .join(" · ")}
                                </p>
                            </div>
                            {incoming ? (
                                <div className="flex gap-2">
                                    <Button
                                        disabled={pending}
                                        variant="outline"
                                        onClick={() =>
                                            act(() =>
                                                respondSharedInvitation(
                                                    serverId,
                                                    item.id,
                                                    false
                                                )
                                            )
                                        }
                                    >
                                        {t.decline}
                                    </Button>
                                    <Button
                                        disabled={pending}
                                        onClick={() => {
                                            router.push(
                                                `/${locale}/dashboard/servers/${serverId}/matches/accept/${item.id}`
                                            )
                                        }}
                                    >
                                        {t.accept}
                                    </Button>
                                </div>
                            ) : (
                                <Badge variant="secondary">
                                    {t[item.status]}
                                </Badge>
                            )}
                            {!incoming &&
                            eventId &&
                            item.status !== "revoked" ? (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={pending}
                                    onClick={() =>
                                        act(() =>
                                            revokeSharedInvitation(
                                                serverId,
                                                item.id,
                                                eventId
                                            )
                                        )
                                    }
                                >
                                    {t.remove}
                                </Button>
                            ) : null}
                        </div>
                    ))
                )}
            </CardContent>
        </Card>
    )
}
