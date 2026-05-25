"use client";
import { useState } from "react";
import Link from "next/link";
import { PdfViewer } from "./PdfViewer";
import { ChatPanel } from "./ChatPanel";

type Props = {
  url: string;
  course: string;
  pdfKey: string;
  /** Üst banner'da gösterilecek isim (verilmezse pdfKey'in son segmenti). */
  title?: string;
  /** "← Dersler" linkinin yönü ve etiketi. */
  backHref?: string;
  backLabel?: string;
  /** Sağ panelde gösterilecek alt yazı (verilmezse course adı). */
  subtitle?: string;
  /** ChatPanel modunu zorla. "law" → kanun-açıklama prompt'ları + butonlar. */
  mode?: "default" | "law";
};

export function ReaderShell({
  url,
  course,
  pdfKey,
  title,
  backHref = "/reader",
  backLabel = "← Dersler",
  subtitle,
  mode = "default",
}: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const pdfName = title ?? pdfKey.split("/").pop() ?? pdfKey;
  const subtitleText =
    subtitle ?? `${course} · bge-m3 + Gemini Flash`;

  return (
    <div className="h-full w-full grid grid-cols-1 md:grid-cols-[3fr_2fr] overflow-hidden">
      {/* Sol: PDF Viewer */}
      <div className="flex flex-col h-full min-h-0 min-w-0 overflow-hidden">
        <div className="px-3 py-2 border-b bg-muted/30 flex items-center gap-2 text-xs shrink-0">
          <Link
            href={backHref}
            className="text-muted-foreground hover:text-foreground whitespace-nowrap"
          >
            {backLabel}
          </Link>
          <span className="truncate flex-1 min-w-0" title={pdfName}>
            {pdfName}
          </span>
        </div>
        <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
          <PdfViewer url={url} onSelection={setSelected} />
        </div>
      </div>

      {/* Sağ: AI Asistan */}
      <div className="flex flex-col h-full min-h-0 min-w-0 border-t md:border-t-0 md:border-l overflow-hidden">
        <div className="px-3 py-2 border-b bg-muted/30 shrink-0">
          <h2 className="text-sm font-semibold">
            {mode === "law" ? "AI Asistan · Kanun Modu" : "AI Asistan"}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitleText}</p>
        </div>
        <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
          <ChatPanel
            selectedText={selected}
            course={course}
            pdfKey={pdfKey}
            mode={mode}
          />
        </div>
      </div>
    </div>
  );
}
