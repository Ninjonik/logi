import { ArrowLeftRight, CheckCircle2, UserMinus, UserPlus } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { SignupActivity } from "@/lib/signup-activity"
import type { Dictionary } from "@/i18n/dictionaries"

type Props = {
    activity: SignupActivity[]
    userNameById: Map<string, string>
    dictionary: Dictionary
}

const activityMeta = {
    signed_up: { Icon: UserPlus, tone: "text-emerald-600" },
    changed_role: { Icon: ArrowLeftRight, tone: "text-sky-600" },
    unsigned: { Icon: UserMinus, tone: "text-amber-600" },
    declined: { Icon: CheckCircle2, tone: "text-muted-foreground" },
} as const

export function SignupActivityFeed({
    activity,
    userNameById,
    dictionary,
}: Props) {
    return (
        <Card className="border-border/60 overflow-hidden rounded-2xl">
            <CardHeader>
                <CardTitle>{dictionary.signupActivity.title}</CardTitle>
                <p className="text-muted-foreground text-sm">
                    {dictionary.signupActivity.description}
                </p>
            </CardHeader>
            <CardContent>
                {activity.length ? (
                    <ol className="divide-border border-border/60 divide-y overflow-hidden rounded-xl border">
                        {activity.map((entry) => {
                            const { Icon, tone } = activityMeta[entry.action]
                            const userName =
                                userNameById.get(entry.userId) ?? entry.userId
                            const action =
                                dictionary.signupActivity.actions[entry.action]
                            const roleDetail =
                                entry.action === "changed_role"
                                    ? `${entry.previousRole ?? dictionary.signupActivity.noRole} → ${entry.role ?? dictionary.signupActivity.noRole}`
                                    : entry.role
                            return (
                                <li key={entry.id} className="flex gap-3 p-4">
                                    <Icon
                                        className={`mt-0.5 size-5 shrink-0 ${tone}`}
                                        aria-hidden="true"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium">
                                            {userName}{" "}
                                            <span className="text-muted-foreground font-normal">
                                                {action}
                                            </span>
                                        </p>
                                        <p className="text-muted-foreground mt-1 text-sm">
                                            {entry.eventName} ·{" "}
                                            {entry.eventKind === "match"
                                                ? dictionary.sidebar.matches
                                                : dictionary.sidebar.trainings}
                                            {roleDetail
                                                ? ` · ${dictionary.signupActivity.role}: ${roleDetail}`
                                                : ""}
                                        </p>
                                    </div>
                                    <time
                                        className="text-muted-foreground shrink-0 text-right text-xs"
                                        dateTime={entry.occurredAt}
                                    >
                                        {new Intl.DateTimeFormat(undefined, {
                                            dateStyle: "medium",
                                            timeStyle: "short",
                                        }).format(new Date(entry.occurredAt))}
                                    </time>
                                </li>
                            )
                        })}
                    </ol>
                ) : (
                    <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
                        {dictionary.signupActivity.empty}
                    </p>
                )}
            </CardContent>
        </Card>
    )
}
