"use client";
import "@/lib/pdf-config";
import { useState, useCallback, useEffect, useRef } from "react";
import { Document, Page } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Button } from "@/components/ui/button";

type Props = {
  url: string;
  initialPage?: number;
  onSelection?: (text: string) => void;
};

export function PdfViewer({ url, initialPage = 1, onSelection }: Props) {
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(initialPage);
  const [width, setWidth] = useState(800);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Responsive width
  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setWidth(Math.min(containerRef.current.clientWidth - 16, 1000));
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Text selection
  const handleSelection = useCallback(() => {
    if (!onSelection) return;
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (text && text.length > 5) onSelection(text);
  }, [onSelection]);

  // Hash navigation (#page=42)
  useEffect(() => {
    const m = window.location.hash.match(/page=(\d+)/);
    if (m) setPage(Number(m[1]));
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-2 p-2 border-b bg-muted/30 text-sm">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
        >
          ‹ Önceki
        </Button>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={page}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (n >= 1 && n <= pages) setPage(n);
            }}
            className="w-14 px-2 py-1 rounded border bg-background text-center"
            min={1}
            max={pages || undefined}
          />
          <span className="text-muted-foreground">/ {pages || "?"}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage((p) => Math.min(pages, p + 1))}
          disabled={page >= pages}
        >
          Sonraki ›
        </Button>
      </div>
      <div
        ref={containerRef}
        onMouseUp={handleSelection}
        onTouchEnd={handleSelection}
        className="flex-1 overflow-auto bg-muted/20 p-2 flex justify-center"
      >
        {error ? (
          <div className="text-red-500 p-4">PDF yüklenemedi: {error}</div>
        ) : (
          <Document
            file={url}
            onLoadSuccess={({ numPages }) => setPages(numPages)}
            onLoadError={(e) => setError(e.message)}
            loading={
              <div className="text-muted-foreground p-8">PDF yükleniyor...</div>
            }
          >
            <Page
              pageNumber={page}
              width={width}
              renderAnnotationLayer
              renderTextLayer
            />
          </Document>
        )}
      </div>
    </div>
  );
}
