import { LogOut } from "lucide-react";
import Link from "next/link";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

export function SignOutButton({
  label,
}: {
  label: string;
}) {
  return (
    <DropdownMenuItem asChild className="cursor-pointer">
      <Link href="/api/auth/logout">
        <LogOut />
        {label}
      </Link>
    </DropdownMenuItem>
  );
}
