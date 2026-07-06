import { Disc3 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export function DiscordSignInButton({
  redirectTo,
  label,
}: {
  redirectTo: string;
  label: string;
}) {
  return (
    <Button asChild size="lg" className="h-12 w-full rounded-xl bg-[#5865F2] text-white hover:bg-[#4752c4]">
      <Link href={`/api/auth/discord?redirectTo=${encodeURIComponent(redirectTo)}`}>
        <Disc3 className="size-4" />
        {label}
      </Link>
    </Button>
  );
}
