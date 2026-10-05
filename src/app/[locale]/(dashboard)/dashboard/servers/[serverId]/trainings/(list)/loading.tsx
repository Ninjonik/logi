import { MatchListSkeleton } from "@/components/app/match-list-skeleton"

/** Only the list: the route group keeps the training form and detail out of it. */
export default function TrainingListLoading() {
    return <MatchListSkeleton queue={false} />
}
