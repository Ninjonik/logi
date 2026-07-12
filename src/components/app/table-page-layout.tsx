export function TablePageLayout({
  header,
  children,
}: {
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden">
      {header}
      <div className="min-h-0 flex-1 px-4 lg:px-6">
        {children}
      </div>
    </div>
  );
}
