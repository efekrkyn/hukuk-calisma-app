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
import { Search, FileText, ArrowLeft, BookOpen } from "lucide-react";

export default function ReaderLanding() {
  const [byCourse, setByCourse] = useState<Record<string, PdfListItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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

  // Filter by search query
  const filteredCourses = COURSES.map((c) => {
    const pdfs = byCourse[c.id] ?? [];
    const filteredPdfs = pdfs.filter(
      (pdf) =>
        pdf.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return { ...c, pdfs: filteredPdfs };
  }).filter((c) => c.pdfs.length > 0);

  return (
    <main className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link
            href="/"
            className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Ana sayfa
          </Link>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BookOpen className="w-8 h-8 text-primary" />
            Kütüphane
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tüm ders kitapları, notlar ve pratik çalışmaları
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="PDF veya Ders Ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-card/50 border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all glass"
          />
        </div>
      </div>

      {error && (
        <div className="border border-destructive/50 bg-destructive/10 rounded p-4 text-sm text-destructive">
          Hata: {error}
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="glass animate-pulse h-48" />
          ))}
        </div>
      )}

      {!loading && filteredCourses.length === 0 && (
        <div className="text-center py-12 glass rounded-2xl border border-border">
          <FileText className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
          <h3 className="text-lg font-medium">Sonuç Bulunamadı</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Aramanızla eşleşen bir belge yok.
          </p>
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((c) => (
            <Card key={c.id} className="glass hover-glow border-border/50 flex flex-col h-full">
              <CardHeader className="pb-3 border-b border-border/10 bg-muted/10">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span className="font-semibold text-gradient truncate">{c.name}</span>
                  <span className="text-xs font-medium px-2 py-1 bg-primary/10 text-primary rounded-full shrink-0">
                    {c.pdfs.length} Dosya
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-y-auto max-h-64 custom-scrollbar">
                <div className="divide-y divide-border/10">
                  {c.pdfs.map((pdf) => {
                    const name = pdf.key.split("/").pop() ?? pdf.key;
                    // Format names a bit better if they end in .pdf
                    const cleanName = name.replace(/\.pdf$/i, "");
                    return (
                      <Link
                        key={pdf.key}
                        href={`/reader/${pdf.key}`}
                        className="flex items-start gap-3 p-3 hover:bg-primary/5 transition-colors group"
                      >
                        <div className="bg-primary/10 p-2 rounded-lg text-primary shrink-0 group-hover:scale-110 transition-transform">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                            {cleanName}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {(pdf.size / 1e6).toFixed(1)} MB
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
