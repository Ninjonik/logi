"use client";

import { Link2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/i18n/dictionaries";

export function PublicShareLinkButton({ href, dictionary }: { href: string; dictionary: Dictionary }) {
  async function copyPublicLink() {
    try {
      await navigator.clipboard.writeText(new URL(href, window.location.origin).toString());
      toast.success(dictionary.common.publicLinkCopied);
    } catch {
      toast.error(dictionary.common.publicLinkCopyFailed);
    }
  }

  return (
    <Button type="button" variant="outline" className="rounded-xl" onClick={() => void copyPublicLink()}>
      <Link2 className="size-4" />
      {dictionary.common.getPublicLink}
    </Button>
  );
}
