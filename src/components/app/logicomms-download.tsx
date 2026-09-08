import { Download } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/i18n/dictionaries";

export function LogicommsDownload({
  dictionary,
  downloadUrl,
}: {
  dictionary: Dictionary;
  downloadUrl: string | null;
}) {
  return (
    <section id="logicomms" className="border-t py-10">
      <div className="grid gap-6 rounded-2xl border bg-card p-6 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="space-y-3">
          <Badge variant="outline" className="rounded-full">{dictionary.home.commsBadge}</Badge>
          <h2 className="text-2xl font-semibold tracking-tight">{dictionary.home.commsTitle}</h2>
          <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">{dictionary.home.commsDescription}</p>
        </div>
        {downloadUrl ? (
          <Button asChild size="lg"><a href={downloadUrl}><Download />{dictionary.home.commsDownload}</a></Button>
        ) : <p className="text-sm text-muted-foreground">{dictionary.home.commsUnavailable}</p>}
      </div>
    </section>
  );
}
