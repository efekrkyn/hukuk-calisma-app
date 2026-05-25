"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { COURSES } from "@/lib/courses";
import { api, type PdfListItem } from "@/lib/api";

export default function ReaderLanding() {
  const [byCourse, setByCourse] = useState<Record<string, PdfListItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listPdfs("dersler/")
      .then((r) => {
        const grouped: Record<string, PdfListItem[]> = {};
        r.objects.forEach((o) => {
          const parts = o.key.split("/");
          const course = parts[1];
          if (course) (grouped[course] ??= []).push(o);
        });
        // Sort PDFs within each course alphabetically
        Object.values(grouped).forEach((arr) =>
          arr.sort((a, b) => a.key.localeCompare(b.key, "tr"))
        );
        setByCourse(grouped);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dersler</h1>
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Ana sayfa
        </Link>
      </div>
      {error && (
        <div className="border border-red-500/50 bg-red-500/5 rounded p-3 text-sm text-red-500">
          Hata: {error}
        </div>
      )}
      {loading && (
        <div className="text-sm text-muted-foreground">PDF'ler yükleniyor...</div>
      )}
      {!loading &&
        COURSES.map((c) => {
          const pdfs = byCourse[c.id] ?? [];
          return (
            <Card key={c.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{c.name}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {pdfs.length} dosya
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0.5">
                {pdfs.length === 0 && (
                  <p className="text-xs text-muted-foreground py-1">
                    PDF bulunamadı.
                  </p>
                )}
                {pdfs.map((pdf) => {
                  const name = pdf.key.split("/").pop() ?? pdf.key;
                  return (
                    <Link
                      key={pdf.key}
                      href={`/reader/${pdf.key}`}
                      className="block py-1.5 px-2 -mx-2 text-sm hover:bg-muted rounded transition-colors"
                    >
                      <span className="truncate inline-block max-w-[80%] align-middle">
                        {name}
                      </span>{" "}
                      <span className="text-xs text-muted-foreground">
                        ({(pdf.size / 1e6).toFixed(1)} MB)
                      </span>
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
    </main>
  );
}
