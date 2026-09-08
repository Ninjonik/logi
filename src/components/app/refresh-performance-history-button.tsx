"use client";
import { Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/i18n/dictionaries";

export function RefreshPerformanceHistoryButton({ serverId, dictionary }: { serverId: string; dictionary: Dictionary }) {
  const router = useRouter(); const [pending, startTransition] = useTransition();
  return <Button variant="outline" className="rounded-xl" disabled={pending} onClick={() => startTransition(async () => {
    const response = await fetch(`/api/servers/${serverId}/performance-history`, { method: "POST" });
    if (!response.ok) { toast.error(dictionary.userManagement.refreshPerformanceHistoryError); return; }
    toast.success(dictionary.userManagement.refreshPerformanceHistorySuccess); router.refresh();
  })}>{pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}{dictionary.userManagement.refreshPerformanceHistory}</Button>;
}
