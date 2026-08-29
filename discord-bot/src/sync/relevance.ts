export function isHistoricalConcludedEvent(event: { status: string; gameEnd?: string }, now = new Date()) {
  if (event.status !== "concluded") return false;
  const gameEnd = event.gameEnd ? new Date(event.gameEnd).getTime() : Number.NaN;
  return Number.isFinite(gameEnd) && gameEnd < now.getTime() - 7 * 24 * 60 * 60 * 1000;
}
