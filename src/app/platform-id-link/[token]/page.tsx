import { redirect } from "next/navigation";

export default async function PlatformIdLinkRedirectPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  redirect(`/en/platform-id-link/${token}`);
}
