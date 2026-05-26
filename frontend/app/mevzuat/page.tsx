"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Newspaper, AlertTriangle, ExternalLink, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";

type MevzuatItem = { title: string; link: string; pubDate: string; description: string };

export default function MevzuatTakip() {
  const [items, setItems] = useState<MevzuatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getMevzuat()
      .then(res => {
        setItems(res.items);
        setLoading(false);
      })
      .catch(e => {
        console.error(e);
        setError("Resmî Gazete verilerine ulaşılamadı.");
        setLoading(false);
      });
  }, []);

  return (
    <main className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
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
            <Newspaper className="w-8 h-8 text-primary" />
            Canlı Mevzuat Takip
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            T.C. Resmî Gazete RSS akışından günlük otomatik alınan güncel değişiklikler.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-10 h-10 animate-spin mb-4 text-primary" />
            Resmî Gazete verileri çekiliyor...
          </div>
        )}

        {error && (
          <div className="p-4 border border-red-500/50 bg-red-500/10 rounded-xl text-red-500">
            {error}
          </div>
        )}

        {!loading && !error && items.map((item, idx) => (
          <Card key={idx} className="glass hover-glow border-primary/20">
            <CardHeader className="bg-muted/10 pb-3 border-b border-border/10">
              <div className="flex justify-between items-start gap-4">
                <CardTitle className="text-base font-semibold leading-tight text-gradient flex-1">
                  {item.title}
                </CardTitle>
                <div className="shrink-0 flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-1 bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded-full">
                    GÜNCEL
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                  {item.description || "Detaylar Resmi Gazete bağlantısındadır."}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-2 font-medium">
                  Yayın Tarihi: {item.pubDate}
                </p>
              </div>
              
              <a
                href={item.link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center shrink-0 px-3 py-1.5 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-colors"
              >
                Gazetede Oku <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            </CardContent>
          </Card>
        ))}
        {!loading && !error && items.length === 0 && (
          <div className="text-center py-10 text-muted-foreground">
            Bugün için veri bulunamadı.
          </div>
        )}
      </div>
    </main>
  );
}
