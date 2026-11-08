type Edge = { to: number; reverse: number; capacity: number; cost: bigint }

/** Maximum-cardinality assignment, then rank-maximal preferences, score, and K/D. */
export function optimalAssignment(input: {
    players: Array<{ score: number; kd: number }>
    slotCount: number
    choices: Array<{ player: number; slot: number; rank: number }>
}) {
    const count = input.players.length
    const source = count + input.slotCount
    const sink = source + 1
    const graph: Edge[][] = Array.from({ length: sink + 1 }, () => [])
    function edge(from: number, to: number, cost: bigint) {
        const forward = { to, reverse: graph[to].length, capacity: 1, cost }
        graph[from].push(forward)
        graph[to].push({
            to: from,
            reverse: graph[from].length - 1,
            capacity: 0,
            cost: -cost,
        })
        return forward
    }
    // Preserve score and K/D totals to three decimal places. Splitting the integer
    // and fractional parts avoids overflowing Number before converting to BigInt.
    function statistics(
        read: (player: (typeof input.players)[number]) => number
    ) {
        const values = input.players.map((player) => {
            const value = read(player)
            return Number.isFinite(value)
                ? BigInt(Math.trunc(value)) * BigInt(1000) +
                      BigInt(Math.round((value % 1) * 1000))
                : BigInt(0)
        })
        const minimum = values.reduce(
            (min, value) => (value < min ? value : min),
            BigInt(0)
        )
        return values.map((value) => value - minimum)
    }
    const scores = statistics((player) => player.score)
    const kds = statistics((player) => player.kd)
    const base = BigInt(count + 1)
    const maximum = (values: bigint[]) =>
        values.reduce((max, value) => (value > max ? value : max), BigInt(0))
    const maxRank = Math.max(0, ...input.choices.map((choice) => choice.rank))
    const statisticBound = BigInt(count) * BigInt(maxRank + 1)
    const kdBase = maximum(kds) * statisticBound + BigInt(1)
    const preferenceBase =
        maximum(scores) * statisticBound * kdBase +
        maximum(kds) * statisticBound +
        BigInt(1)
    input.players.forEach((_, index) => edge(source, index, BigInt(0)))
    for (let slot = 0; slot < input.slotCount; slot++)
        edge(count + slot, sink, BigInt(0))
    const candidates = input.choices.map((choice) => ({
        ...choice,
        edge: edge(
            choice.player,
            count + choice.slot,
            -(
                base ** BigInt(maxRank - choice.rank) * preferenceBase +
                (scores[choice.player] * kdBase + kds[choice.player]) *
                    BigInt(maxRank - choice.rank + 1)
            )
        ),
    }))
    // Successive shortest augmenting paths. Residual edges allow previous placements
    // to move when that improves the complete roster instead of greedily taking a slot.
    while (true) {
        const distance: Array<bigint | undefined> = Array(graph.length)
        const previous: Array<{ node: number; edge: number } | undefined> =
            Array(graph.length)
        const queued = Array<boolean>(graph.length).fill(false)
        const queue = [source]
        distance[source] = BigInt(0)
        queued[source] = true
        for (let cursor = 0; cursor < queue.length; cursor++) {
            const node = queue[cursor]
            queued[node] = false
            const current = distance[node]
            if (current === undefined) continue
            graph[node].forEach((candidate, index) => {
                if (!candidate.capacity) return
                const next = current + candidate.cost
                const known = distance[candidate.to]
                if (known !== undefined && known <= next) return
                distance[candidate.to] = next
                previous[candidate.to] = { node, edge: index }
                if (!queued[candidate.to]) {
                    queue.push(candidate.to)
                    queued[candidate.to] = true
                }
            })
        }
        if (distance[sink] === undefined) break
        for (let node = sink; node !== source;) {
            const step = previous[node]
            if (!step) throw new Error("Assignment path is incomplete.")
            const candidate = graph[step.node][step.edge]
            candidate.capacity--
            graph[node][candidate.reverse].capacity++
            node = step.node
        }
    }
    return candidates
        .filter((candidate) => candidate.edge.capacity === 0)
        .map(({ player, slot }) => ({ player, slot }))
}
