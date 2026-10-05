import { MatchListSkeleton } from "@/components/app/match-list-skeleton"

/** Only the list: the route group keeps the match form and detail out of it. */
export default function MatchListLoading() {
    return <MatchListSkeleton />
}
