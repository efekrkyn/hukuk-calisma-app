import { ReaderShell } from "@/components/ReaderShell";
import { pdfUrl } from "@/lib/api";

type Params = { key: string[] };

export default async function ReaderPage({ params }: { params: Promise<Params> }) {
  const { key } = await params;
  const fullKey = key.join("/");
  const url = pdfUrl(fullKey);
  // dersler/borclar_ozel/foo.pdf → course = "borclar_ozel"
  const course = key[1] ?? "(unknown)";

  return (
    <main className="h-screen flex flex-col">
      <ReaderShell url={url} course={course} pdfKey={fullKey} />
    </main>
  );
}
