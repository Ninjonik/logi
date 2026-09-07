export default async function PublicRosterPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return <main className="min-h-dvh bg-slate-950 p-3 sm:p-6"><img src={`/api/discord/roster-image/${eventId}`} alt="Published roster" className="mx-auto h-auto w-full max-w-[1920px] rounded-xl" /></main>;
}
