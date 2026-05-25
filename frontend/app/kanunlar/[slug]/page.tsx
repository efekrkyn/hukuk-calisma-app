import { notFound } from "next/navigation";
import { ReaderShell } from "@/components/ReaderShell";
import { pdfUrl } from "@/lib/api";
import { lawBySlug } from "@/lib/laws";

// PdfViewer pdf.js'i client-side import ediyor (DOMMatrix vb. gerekiyor).
// Pre-render bu yüzden başarısız oluyor — sayfayı tamamen dynamic yap.
export const dynamic = "force-dynamic";

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const law = lawBySlug(slug);
  if (!law) return { title: "Kanun bulunamadı" };
  return {
    title: `${law.name} — Hukuk Çalışma`,
    description: law.description,
  };
}

export default async function KanunPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const law = lawBySlug(slug);
  if (!law) notFound();

  const url = pdfUrl(law.r2_key);
  const title = `${law.emoji} ${law.name}${
    law.number !== "—" ? ` (${law.number})` : ""
  }`;
  const subtitle = `${law.name}${
    law.number !== "—" ? ` · ${law.number}` : ""
  } · ${law.year} · bge-m3 + Gemini Flash`;

  return (
    <main className="h-screen flex flex-col overflow-hidden">
      <ReaderShell
        url={url}
        course="kanunlar"
        pdfKey={law.r2_key}
        title={title}
        backHref="/kanunlar"
        backLabel="← Kanunlar"
        subtitle={subtitle}
        mode="law"
      />
    </main>
  );
}
