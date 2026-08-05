"use client";

/**
 * Ana sayfa — HMGS odaklı.
 *
 * Önceki hâli final dönemine göre kurulmuştu; HMGS diğer araçların arasında
 * bir bağlantıydı. Finaller geçildiği için sayfa HMGS'yi merkeze alıyor:
 * üstte deneme ve bankanın durumu, altında destek araçları.
 *
 * Mobil öncelikli: tek sütun başlar, sm/lg'de genişler.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { TodayCard } from "@/components/TodayCard";

type SubjectStat = {
  id: string;
  name: string;
  needed: number;
  have: number;
  coverable: boolean;
};

type VerifyStats = { total: number; correct: number; unchecked: number };

const TOOLS = [
  { href: "/asistan", label: "AI Asistan", icon: "✨", desc: "Web arama + sınav modu" },
  { href: "/reader", label: "Kütüphane", icon: "📚", desc: "Kanun ve not PDF'leri" },
  { href: "/mevzuat", label: "Mevzuat Arama", icon: "⚖️", desc: "Canlı kanun + madde araması" },
  { href: "/emsal-kararlar", label: "Emsal Kararlar", icon: "🏛️", desc: "Yargıtay / Danıştay" },
  { href: "/flashcards", label: "Flashcard", icon: "🗂️", desc: "Aralıklı tekrar (FSRS)" },
  { href: "/sozluk", label: "Hukuk Sözlüğü", icon: "📖", desc: "Terim arama" },
  { href: "/notlarim", label: "Akıllı Notlar", icon: "📝", desc: "Kendi notların" },
  { href: "/irac", label: "IRAC Olay Çözme", icon: "🧠", desc: "Olay analizi pratiği" },
  { href: "/plan", label: "Çalışma Planı", icon: "📅", desc: "Program üreticisi" },
];

export default function Home() {
  const [subjects, setSubjects] = useState<SubjectStat[] | null>(null);
  const [verify, setVerify] = useState<VerifyStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/worker/hmgs/stats").then((r) => r.json()),
      fetch("/api/worker/hmgs/verify-stats").then((r) => r.json()),
    ])
      .then(([s, v]) => {
        setSubjects(s.subjects ?? []);
        setVerify(v);
      })
      .catch((e) => setError(String(e)));
  }, []);

  const total = subjects?.reduce((a, s) => a + s.have, 0) ?? 0;
  const ready = subjects?.filter((s) => s.have >= s.needed).length ?? 0;

  return (
    <main className="min-h-dvh p-4 sm:p-6 lg:p-10 bg-background">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-gradient">
            HMGS Hazırlık
          </h1>
          <p className="text-sm text-muted-foreground">
            Hukuk Mesleklerine Giriş Sınavı — 120 soru, 20 alan, geçme notu 70.
          </p>
        </header>

        {error && (
          <div className="p-3 border border-red-500/40 bg-red-500/10 rounded-xl text-red-500 text-sm">
            Durum bilgisi alınamadı: {error}
          </div>
        )}

        {/* Ana eylem */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            href="/hmgs"
            className="sm:col-span-2 glass hover-glow rounded-2xl border border-primary/30 p-5 flex flex-col justify-between min-h-32 transition-transform active:scale-[0.99]"
          >
            <div>
              <p className="text-lg font-bold">🎯 Deneme Sınavı</p>
              <p className="text-xs text-muted-foreground mt-1">
                ÖSYM&apos;nin resmî alan dağılımına göre, zamanlı
              </p>
            </div>
            <p className="text-xs text-primary mt-3">Başla →</p>
          </Link>

          <div className="glass rounded-2xl border border-border/40 p-5 space-y-2">
            <p className="text-3xl font-black tabular-nums">{total}</p>
            <p className="text-xs text-muted-foreground">soru bankada</p>
            {verify && (
              <p className="text-xs">
                <span className="text-green-500 font-semibold">{verify.correct}</span>
                <span className="text-muted-foreground"> tanesi kanun metnine karşı denetlendi</span>
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {ready}/20 alan tam kotada
            </p>
          </div>
        </div>

        <TodayCard />

        {/* Alan kapsamı */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Alan kapsamı — tıkla, o alana çalış
          </h2>
          {!subjects && <p className="text-sm text-muted-foreground">Yükleniyor…</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {subjects?.map((s) => {
              const full = s.have >= s.needed;
              return (
                <Link key={s.id} href={`/hmgs?subject=${s.id}`} className="block">
                  <Card className="glass border-border/40 hover-glow transition-transform active:scale-[0.99]">
                  <CardContent className="p-3 flex items-center justify-between gap-3">
                    <span className="text-sm leading-tight">{s.name}</span>
                    <span
                      className={
                        "text-xs font-mono shrink-0 px-1.5 py-0.5 rounded " +
                        (full
                          ? "bg-green-500/15 text-green-500"
                          : "bg-amber-500/15 text-amber-500")
                      }
                    >
                      {s.have}/{s.needed}
                    </span>
                  </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Araçlar */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Çalışma araçları
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {TOOLS.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className={
                  buttonVariants({ variant: "outline" }) +
                  " h-auto py-3 flex flex-col items-start gap-0.5 text-left"
                }
              >
                <span className="text-sm">
                  {t.icon} {t.label}
                </span>
                <span className="text-[11px] text-muted-foreground font-normal">
                  {t.desc}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <p className="text-[11px] text-muted-foreground/70 pt-4">
          Sorular kanun metninden yapay zekâ ile üretilir; &quot;denetlendi&quot; ikinci
          bir modelin kaynağa karşı kontrolüdür, insan onayı değildir.
        </p>
      </div>

    </main>
  );
}
