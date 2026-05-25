"use client";
import { useState } from "react";
import Link from "next/link";
import { PdfViewer } from "./PdfViewer";
import { ChatPanel } from "./ChatPanel";

type Props = { url: string; course: string; pdfKey: string };

export function ReaderShell({ url, course, pdfKey }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const pdfName = pdfKey.split("/").pop() ?? pdfKey;

  return (
    <div className="h-full grid grid-cols-1 md:grid-cols-[3fr_2fr]">
      <div className="flex flex-col h-full min-h-0">
        <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between text-xs">
          <Link
            href="/reader"
            className="text-muted-foreground hover:text-foreground"
          >
            ← Dersler
          </Link>
          <span className="truncate ml-2">{pdfName}</span>
        </div>
        <div className="flex-1 min-h-0">
          <PdfViewer url={url} onSelection={setSelected} />
        </div>
      </div>
      <div className="flex flex-col h-full min-h-0 border-l">
        <div className="px-3 py-2 border-b bg-muted/30">
          <h2 className="text-sm font-semibold">AI Asistan</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {course} · bge-m3 + Gemini Flash
          </p>
        </div>
        <ChatPanel selectedText={selected} course={course} pdfKey={pdfKey} />
      </div>
    </div>
  );
}
