export default function ServerWorkspaceLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" aria-live="polite" aria-label="Loading workspace">
      <div className="size-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
    </div>
  );
}
