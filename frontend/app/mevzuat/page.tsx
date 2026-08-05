"use client";

/**
 * Mevzuat arama — mevzuat.gov.tr / bedesten.adalet.gov.tr üzerinden canlı.
 *
 * Önceki hâli Resmî Gazete RSS akışını gösteriyordu; o akışa ne worker'dan
 * ne Vercel'den erişilebiliyor (ikisi de bağlantı zaman aşımına uğruyor),
 * yani özellik çalışmıyordu. Arama hem çalışıyor hem sınav çalışmasında
 * daha işe yarıyor: kanunu bul, içinde maddeyi ara.
 */

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Scale, Search, Loader2, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Kanun = {
  mevzuat_no: string;
  title: string;
  tur: string;
  mevzuat_id: string;
  rg_tarihi: string | null;
};

export default function MevzuatArama() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Kanun[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [openNo, setOpenNo] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [articleText, setArticleText] = useState<string | null>(null);
  const [articleLoading, setArticleLoading] = useState(false);

  async function search() {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setResults(null);
    setOpenNo(null);
    setArticleText(null);
    try {
      const r = await fetch("/api/worker/mevzuat/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setResults(d.results ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Arama başarısız");
    } finally {
      setLoading(false);
    }
  }

  async function searchWithin(no: string) {
    const k = keyword.trim();
    if (!k) return;
    setArticleLoading(true);
    setArticleText(null);
    try {
      const r = await fetch("/api/worker/mevzuat/within", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mevzuat_no: no, keyword: k }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      const res = d.result;
      setArticleText(
        typeof res?.raw === "string" ? res.raw : JSON.stringify(res, null, 2)
      );
    } catch (e) {
      setArticleText(
        `Madde araması başarısız: ${e instanceof Error ? e.message : String(e)}`
      );
    } finally {
      setArticleLoading(false);
    }
  }

  return (
    <main className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <Link
          href="/"
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors mb-2"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Ana sayfa
        </Link>
        <h1 className="type-display flex items-center gap-2">
          <Scale className="w-8 h-8 text-primary" />
          Mevzuat Arama
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Güncel mevzuata canlı erişim — uygulamadaki PDF korpusuyla sınırlı değil.
          Kanunu adıyla ara, sonra içinde madde ara.
        </p>
      </div>

      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Kanun adı — ör. gelir vergisi, ceza muhakemesi, türk medeni"
          className="rounded-xl"
        />
        <Button onClick={search} disabled={loading || !query.trim()} className="rounded-xl px-5">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground -mt-3">
        Numarayla değil, adıyla aranıyor: &quot;3065&quot; değil &quot;katma değer vergisi&quot;.
      </p>

      {error && (
        <div className="p-4 border border-red-500/50 bg-red-500/10 rounded-xl text-red-500 text-sm">
          {error}
        </div>
      )}

      {results?.length === 0 && (
        <div className="text-center py-10 text-muted-foreground text-sm">
          Sonuç bulunamadı. Daha genel bir ifade dene.
        </div>
      )}

      <div className="space-y-3">
        {results?.map((k) => (
          <Card key={k.mevzuat_id} className="material-thin border-primary/20">
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold leading-snug">{k.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Kanun no <strong>{k.mevzuat_no}</strong>
                    {k.rg_tarihi ? ` · RG ${k.rg_tarihi}` : ""} · {k.tur}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => {
                    setOpenNo(openNo === k.mevzuat_no ? null : k.mevzuat_no);
                    setArticleText(null);
                  }}
                >
                  <FileText className="w-3.5 h-3.5 mr-1" />
                  Madde ara
                </Button>
              </div>

              {openNo === k.mevzuat_no && (
                <div className="space-y-2 border-t border-border/40 pt-3">
                  <div className="flex gap-2">
                    <Input
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && searchWithin(k.mevzuat_no)}
                      placeholder="Madde içinde ara — ör. zamanaşımı, fesih"
                      className="rounded-lg h-9 text-sm"
                    />
                    <Button
                      size="sm"
                      onClick={() => searchWithin(k.mevzuat_no)}
                      disabled={articleLoading || !keyword.trim()}
                    >
                      {articleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ara"}
                    </Button>
                  </div>
                  {articleText && (
                    <pre className="text-xs whitespace-pre-wrap bg-muted/30 rounded-lg p-3 max-h-96 overflow-y-auto leading-relaxed">
                      {articleText}
                    </pre>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
