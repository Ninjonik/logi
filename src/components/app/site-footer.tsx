import type { Dictionary } from "@/i18n/dictionaries";

export function SiteFooter({ dictionary }: { dictionary: Dictionary }) {
  return (
    <footer className="border-t bg-background">
      <div className="px-4 py-4 text-xs text-muted-foreground lg:px-6">
        {dictionary.app.name} keeps events, briefings, rosters, and future Discord automation in one place.
      </div>
    </footer>
  );
}
