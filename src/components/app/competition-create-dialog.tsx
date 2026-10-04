"use client"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    COMPETITION_NAME_MAX,
    COMPETITION_SEASON_MAX,
    competitionCreateSchema,
} from "@/domain/competitions/competition"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { sendCompetitionCommand } from "@/lib/competitions/competition-client"
import { suggestCompetitionSlug } from "@/lib/competitions/competition-form"
import { TEAM_GAMES, type TeamGame } from "@/domain/teams/team"
import { useId, useState, type FormEvent } from "react"
import type { Dictionary } from "@/i18n/dictionaries"
import { GAME_LABELS } from "@/domain/games/game"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"

/** Create a competition; the administrator lands on its management page. */
export function CompetitionCreateDialog({
    dictionary,
    managePath,
}: {
    dictionary: Dictionary
    /** Builds the management URL for a created competition. */
    managePath: string
}) {
    const t = dictionary.competitionAdmin
    const [open, setOpen] = useState(false)
    return (
        <>
            <Button onClick={() => setOpen(true)}>
                <Plus className="size-4" aria-hidden />
                {t.newCompetition}
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-lg">
                    {open ? (
                        <CreateForm
                            dictionary={dictionary}
                            managePath={managePath}
                            onCancel={() => setOpen(false)}
                        />
                    ) : null}
                </DialogContent>
            </Dialog>
        </>
    )
}

function CreateForm({
    dictionary,
    managePath,
    onCancel,
}: {
    dictionary: Dictionary
    managePath: string
    onCancel(): void
}) {
    const t = dictionary.competitionAdmin
    const id = useId()
    const router = useRouter()
    const [gameId, setGameId] = useState<TeamGame>("hell_let_loose")
    const [name, setName] = useState("")
    const [season, setSeason] = useState("")
    const [slug, setSlug] = useState("")
    const [slugEdited, setSlugEdited] = useState(false)
    const [pending, setPending] = useState(false)
    const [failure, setFailure] = useState<string | null>(null)
    const shownSlug = slugEdited ? slug : suggestCompetitionSlug(name, season)

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const input = competitionCreateSchema.safeParse({
            gameId,
            name,
            season,
            slug: shownSlug,
        })
        if (!input.success) {
            setFailure(t.errors.invalid_competition)
            return
        }
        setPending(true)
        setFailure(null)
        const result = await sendCompetitionCommand({
            action: "create",
            input: input.data,
        })
        setPending(false)
        if (!result.ok) {
            setFailure(t.errors[result.code])
            return
        }
        router.push(
            managePath.replace(
                "{id}",
                encodeURIComponent(String(result.result.competitionId))
            )
        )
    }

    return (
        <form onSubmit={submit} className="space-y-5" noValidate>
            <DialogHeader>
                <DialogTitle>{t.createTitle}</DialogTitle>
                <DialogDescription>{t.createDescription}</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
                <Label htmlFor={`${id}-game`}>{t.game}</Label>
                <Select
                    value={gameId}
                    onValueChange={(value) => setGameId(value as TeamGame)}
                    disabled={pending}
                >
                    <SelectTrigger id={`${id}-game`} className="w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {TEAM_GAMES.map((game) => (
                            <SelectItem key={game} value={game}>
                                {GAME_LABELS[game]}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
                <div className="space-y-2">
                    <Label htmlFor={`${id}-name`}>{t.name}</Label>
                    <Input
                        id={`${id}-name`}
                        value={name}
                        maxLength={COMPETITION_NAME_MAX}
                        required
                        autoFocus
                        autoComplete="off"
                        disabled={pending}
                        onChange={(event) => setName(event.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor={`${id}-season`}>{t.season}</Label>
                    <Input
                        id={`${id}-season`}
                        value={season}
                        maxLength={COMPETITION_SEASON_MAX}
                        required
                        autoComplete="off"
                        disabled={pending}
                        onChange={(event) => setSeason(event.target.value)}
                    />
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor={`${id}-slug`}>{t.slug}</Label>
                <Input
                    id={`${id}-slug`}
                    value={shownSlug}
                    maxLength={64}
                    required
                    autoComplete="off"
                    spellCheck={false}
                    disabled={pending}
                    aria-describedby={`${id}-slug-help`}
                    onChange={(event) => {
                        setSlugEdited(true)
                        setSlug(event.target.value)
                    }}
                />
                <p
                    id={`${id}-slug-help`}
                    className="text-muted-foreground text-xs"
                >
                    {t.slugHelp}
                </p>
            </div>
            <p className="text-muted-foreground text-xs">{t.publishedHelp}</p>
            {failure ? (
                <p role="alert" className="text-destructive text-sm">
                    {failure}
                </p>
            ) : null}
            <DialogFooter>
                <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={onCancel}
                >
                    {t.cancel}
                </Button>
                <Button type="submit" disabled={pending}>
                    {pending ? t.creating : t.create}
                </Button>
            </DialogFooter>
        </form>
    )
}
