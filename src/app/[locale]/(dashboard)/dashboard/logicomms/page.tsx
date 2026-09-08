import { PageHeader } from "@/components/app/page-header";
import { LogicommsDownload } from "@/components/app/logicomms-download";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getLatestLogiCommsWindowsDownload } from "@/lib/logicomms";

export default async function LogicommsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const safeLocale = isLocale(locale) ? locale : "en";
  const dictionary = getDictionary(safeLocale);
  const downloadUrl = await getLatestLogiCommsWindowsDownload();

  return (
    <>
      <PageHeader title={dictionary.sidebar.logiComms} description={dictionary.home.commsDescription} />
      <div className="px-4 lg:px-6">
        <LogicommsDownload dictionary={dictionary} downloadUrl={downloadUrl} />
      </div>
    </>
  );
}
