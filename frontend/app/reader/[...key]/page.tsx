import { ReaderShell } from "@/components/ReaderShell";
import { pdfUrl } from "@/lib/api";

type Params = { key: string[] };

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export default async function ReaderPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { key } = await params;
  // Next.js dinamik route params bazen encoded geliyor — defensive decode.
  // pdfUrl içeride tekrar encodeURIComponent yapıyor, bu sayede tek encoded URL.
  const decodedKey = key.map(safeDecode).join("/");
  const url = pdfUrl(decodedKey);
  // dersler/borclar_ozel/foo.pdf → course = "borclar_ozel"
  const course = key[1] ? safeDecode(key[1]) : "(unknown)";

  return (
    <main className="h-screen flex flex-col overflow-hidden">
      <ReaderShell url={url} course={course} pdfKey={decodedKey} />
    </main>
  );
}
