import type { Dictionary } from "@/i18n/dictionaries";

export function SiteFooter({ dictionary }: { dictionary: Dictionary }) {
  return (
    <footer className="border-t bg-background">
      <div className="px-4 py-6 text-xs text-muted-foreground lg:px-6">
        &copy; {dictionary.app.name} {new Date().getFullYear()}
      </div>
    </footer>
  );
}
