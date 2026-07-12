export function generateStaticParams() {
  return [{ serverId: "sample-server" }];
}

export default function ServerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
