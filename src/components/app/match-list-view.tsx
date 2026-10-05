import { FilePen, Plus, Repeat, ShieldAlert } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import Link from "next/link"

import type { MatchListQueueRow, MatchListRow } from "@/lib/match-list-rows"
import { MatchList, type MatchListTab } from "@/components/app/match-list"
import { MobileActionBar } from "@/components/app/mobile-action-bar"
import { MatchRowList } from "@/components/app/match-row-list"
import { EmptyState } from "@/components/app/empty-state"
import type { Dictionary } from "@/i18n/dictionaries"
import type { GameId } from "@/domain/games/game"
import { Button } from "@/components/ui/button"

type HeaderAction = { href: string; label: string; icon?: LucideIcon }

/** The page frame of the match and training lists: header and content. */
export function MatchListFrame({
    title,
    description,
    secondaryAction,
    primaryAction,
    children,
}: {
    title: string
    description: string
    secondaryAction?: HeaderAction
    /** The main action; on phones it moves to a bar at the bottom. */
    primaryAction?: HeaderAction
    children: ReactNode
}) {
    const Secondary = secondaryAction?.icon
    const Primary = primaryAction?.icon
    return (
        <div className="mx-auto flex w-full max-w-[70rem] flex-col gap-6 px-4 pb-10 lg:px-6">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        {title}
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        {description}
                    </p>
                </div>
                {secondaryAction || primaryAction ? (
                    <div className="flex flex-wrap items-center gap-2">
                        {secondaryAction ? (
                            <Button
                                asChild
                                variant="outline"
                                className="rounded-lg"
                            >
                                <Link href={secondaryAction.href}>
                                    {Secondary ? (
                                        <Secondary
                                            className="size-4"
                                            aria-hidden="true"
                                        />
                                    ) : null}
                                    {secondaryAction.label}
                                </Link>
                            </Button>
                        ) : null}
                        {primaryAction ? (
                            <MobileActionBar>
                                <Button asChild className="rounded-lg">
                                    <Link href={primaryAction.href}>
                                        {Primary ? (
                                            <Primary
                                                className="size-4"
                                                aria-hidden="true"
                                            />
                                        ) : null}
                                        {primaryAction.label}
                                    </Link>
                                </Button>
                            </MobileActionBar>
                        ) : null}
                    </div>
                ) : null}
            </header>
            {children}
        </div>
    )
}

/** Shown instead of a list when the clan context cannot be loaded. */
export function ClanListUnavailable({
    locale,
    dictionary,
}: {
    locale: string
    dictionary: Dictionary
}) {
    const text = dictionary.clanOverview
    return (
        <div className="mx-auto w-full max-w-[70rem] px-4 lg:px-6">
            <EmptyState
                icon={ShieldAlert}
                title={text.unavailableTitle}
                description={text.unavailableDescription}
                actions={
                    <Button asChild variant="outline" className="rounded-lg">
                        <Link href={`/${locale}/dashboard`}>
                            {text.backToClans}
                        </Link>
                    </Button>
                }
            />
        </div>
    )
}

/**
 * The list of a clan's matches or trainings as the page renders it, from the
 * rows of `buildMatchListRows`. With no events and no drafts it shows the
 * empty state instead.
 */
export function MatchListView({
    title,
    description,
    secondaryAction,
    primaryAction,
    rows,
    drafts,
    queue,
    games,
    kinds,
    canAdmin,
    draftsTab = "always",
    initialGame,
    initialTab,
    empty,
    dictionary,
}: {
    title: string
    description: string
    secondaryAction?: HeaderAction
    primaryAction?: HeaderAction
    rows: MatchListRow[]
    drafts: MatchListRow[]
    queue: MatchListQueueRow[]
    games: Array<{ id: GameId; label: string }>
    kinds: ReadonlyArray<MatchListRow["kind"]>
    canAdmin: boolean
    /** Managers see the drafts tab always, or only while there are drafts. */
    draftsTab?: "always" | "whenAny"
    initialGame?: GameId
    initialTab?: MatchListTab
    empty: {
        icon: LucideIcon
        title: string
        description: string
        actions?: ReactNode
    }
    dictionary: Dictionary
}) {
    const text = dictionary.matchList
    return (
        <MatchListFrame
            title={title}
            description={description}
            secondaryAction={secondaryAction}
            primaryAction={primaryAction}
        >
            {rows.length || drafts.length ? (
                <MatchList
                    rows={rows}
                    drafts={drafts}
                    queue={queue}
                    games={games}
                    kinds={kinds}
                    showDrafts={
                        canAdmin &&
                        (draftsTab === "always" || drafts.length > 0)
                    }
                    initialGame={initialGame}
                    initialTab={initialTab}
                    draftsEmpty={
                        <EmptyState
                            icon={FilePen}
                            title={text.noDraftsTitle}
                            description={text.noDrafts}
                        />
                    }
                    dictionary={dictionary}
                />
            ) : (
                <EmptyState
                    icon={empty.icon}
                    title={empty.title}
                    description={empty.description}
                    actions={empty.actions}
                />
            )}
        </MatchListFrame>
    )
}

/**
 * Recurring match series (design E1 list system): each series as a list row
 * whose details start with its schedule, and for managers a shortcut to the
 * series settings.
 */
export function RecurringMatchesView({
    rows,
    canAdmin,
    base,
    dictionary,
}: {
    rows: MatchListRow[]
    canAdmin: boolean
    /** `/{locale}/dashboard/servers/{serverId}` */
    base: string
    dictionary: Dictionary
}) {
    const text = dictionary.matchList
    const createHref = `${base}/matches/create`
    return (
        <MatchListFrame
            title={text.recurringTitle}
            description={text.recurringDescription}
            secondaryAction={{
                href: `${base}/matches`,
                label: text.backToMatches,
            }}
            primaryAction={
                canAdmin
                    ? { href: createHref, label: text.newMatch, icon: Plus }
                    : undefined
            }
        >
            {rows.length ? (
                <div className="flex flex-col gap-2">
                    {canAdmin ? (
                        <p className="text-muted-foreground text-[13px]">
                            {text.recurringStopHint}
                        </p>
                    ) : null}
                    <MatchRowList
                        rows={rows}
                        trailing={
                            canAdmin
                                ? (row) => (
                                      <Button
                                          asChild
                                          variant="outline"
                                          size="sm"
                                          className="mr-4 hidden rounded-lg sm:inline-flex"
                                      >
                                          <Link
                                              href={`${base}/matches/${row.id}#recurrence`}
                                          >
                                              {text.editSeries}
                                          </Link>
                                      </Button>
                                  )
                                : undefined
                        }
                    />
                </div>
            ) : (
                <EmptyState
                    icon={Repeat}
                    title={text.recurringEmptyTitle}
                    description={
                        canAdmin
                            ? text.recurringEmptyAdmin
                            : text.recurringEmptyMember
                    }
                    actions={
                        canAdmin ? (
                            <Button asChild className="rounded-lg">
                                <Link href={createHref}>{text.newMatch}</Link>
                            </Button>
                        ) : undefined
                    }
                />
            )}
        </MatchListFrame>
    )
}
