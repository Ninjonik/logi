"use client"

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
import { useEffect, useState, useTransition } from "react"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { toast } from "sonner"

export function SharedMatchPanel({
    serverId,
    eventId,
    invitations,
    incoming = false,
    dictionary,
    locale,
}: {
    serverId: string
    eventId?: string
    invitations: SharedInvitation[]
    incoming?: boolean
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
    const [roles, setRoles] = useState([{ role: "", count: 1 }])
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
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{t.invite}</DialogTitle>
                                <DialogDescription>{t.roles}</DialogDescription>
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
                            <p className="text-sm font-medium">{t.roles}</p>
                            {roles.map((role, index) => (
                                <div key={index} className="flex gap-2">
                                    <Input
                                        aria-label={t.role}
                                        placeholder={t.role}
                                        value={role.role}
                                        onChange={(event) =>
                                            setRoles((current) =>
                                                current.map((item, i) =>
                                                    i === index
                                                        ? {
                                                              ...item,
                                                              role: event.target
                                                                  .value,
                                                          }
                                                        : item
                                                )
                                            )
                                        }
                                    />
                                    <Input
                                        aria-label={t.count}
                                        type="number"
                                        min={1}
                                        max={500}
                                        className="w-24"
                                        value={role.count}
                                        onChange={(event) =>
                                            setRoles((current) =>
                                                current.map((item, i) =>
                                                    i === index
                                                        ? {
                                                              ...item,
                                                              count: Number(
                                                                  event.target
                                                                      .value
                                                              ),
                                                          }
                                                        : item
                                                )
                                            )
                                        }
                                    />
                                    <Button
                                        variant="ghost"
                                        aria-label={
                                            dictionary.sharedMatches.remove
                                        }
                                        onClick={() =>
                                            setRoles((current) =>
                                                current.filter(
                                                    (_, i) => i !== index
                                                )
                                            )
                                        }
                                    >
                                        ×
                                    </Button>
                                </div>
                            ))}
                            <Button
                                variant="outline"
                                disabled={roles.length >= 32}
                                onClick={() =>
                                    setRoles((current) => [
                                        ...current,
                                        { role: "", count: 1 },
                                    ])
                                }
                            >
                                {t.addRole}
                            </Button>
                            <Button
                                disabled={pending || !selected}
                                onClick={() =>
                                    act(async () => {
                                        if (!selected) return
                                        await inviteSharedClan(
                                            serverId,
                                            eventId,
                                            selected.guildId,
                                            roles.filter((role) =>
                                                role.role.trim()
                                            )
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
                                    {item.requestedRoles
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
                                        onClick={() =>
                                            act(async () => {
                                                const id =
                                                    await respondSharedInvitation(
                                                        serverId,
                                                        item.id,
                                                        true
                                                    )
                                                if (id)
                                                    router.push(
                                                        `/${locale}/dashboard/servers/${serverId}/matches/${id}`
                                                    )
                                            })
                                        }
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
