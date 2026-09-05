"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { EntitySelect } from "@/components/app/entity-select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/i18n/dictionaries";

type Clan = { id: string; name: string; isGhost: boolean };

export function MergeCompetitionClans({ clans, dictionary }: { clans: Clan[]; dictionary: Dictionary }) {
  const router = useRouter(); const [primary, setPrimary] = useState(""); const [secondary, setSecondary] = useState(""); const [pending, startTransition] = useTransition();
  function merge() { startTransition(async () => { const response = await fetch("/api/competitions/clans/merge", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ primaryGuildId: primary, secondaryGuildId: secondary }) }); if (!response.ok) { toast.error(dictionary.competition.mergeFailed); return; } toast.success(dictionary.competition.mergeSuccess); setPrimary(""); setSecondary(""); router.refresh(); }); }
  return <div className="rounded-xl border bg-muted/20 p-4 sm:p-5"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>{dictionary.competition.clanToKeep}</Label><EntitySelect value={primary} onChange={(value) => setPrimary(value ?? "")} options={clans} placeholder={dictionary.competition.chooseRealClan} allowNone={false} /></div><div className="space-y-2"><Label>{dictionary.competition.ghostToMerge}</Label><EntitySelect value={secondary} onChange={(value) => setSecondary(value ?? "")} options={clans.filter((clan) => clan.id !== primary)} placeholder={dictionary.competition.chooseDuplicate} allowNone={false} /></div></div><Button className="mt-4" variant="outline" disabled={pending || !primary || !secondary} onClick={merge}>{pending ? dictionary.competition.merging : dictionary.competition.mergeClans}</Button></div>;
}
