"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import {
  api,
  type HealthResponse,
  type SyncStatus,
  type PdfListResponse,
} from "@/lib/api";
import GlobalAiAssistant from "@/components/GlobalAiAssistant";

export default function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [syncS, setSyncS] = useState<SyncStatus | null>(null);
  const [pdfs, setPdfs] = useState<PdfListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.health(), api.syncStatus(), api.listPdfs("dersler/")])
      .then(([h, s, p]) => {
        setHealth(h);
        setSyncS(s);
        setPdfs(p);
      })
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <main className="min-h-screen p-6 md:p-12 lg:p-24 bg-background">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Sweet Greeting Banner */}
        <div className="glass rounded-xl p-4 md:p-6 border-primary/20 bg-primary/5 flex items-center justify-center text-center animate-in fade-in slide-in-from-top-4 duration-700">
          <p className="text-lg md:text-xl font-medium text-gradient flex items-center gap-2">
            <span>✨</span> İyi çalışmalar sevgilim, her zaman yanındayım seni çok seviyorum <span>❤️</span>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Side: Navigation & Stats */}
          <Card className="w-full lg:col-span-4 glass">
        <CardHeader>
          <CardTitle className="text-xl">İrem'in Hukuk Uygulaması 📚</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Sınav (finals + HMGS) hazırlık asistanı.
          </p>

          {health && (
            <div className="border rounded p-3 space-y-1 text-xs">
              <p>
                <span className="text-green-500">●</span> Worker:{" "}
                <span className="font-mono">{health.status}</span>{" "}
                <span className="text-muted-foreground">({health.region})</span>
              </p>
              {pdfs && (
                <p className="text-muted-foreground">
                  R2: {pdfs.objects.length} PDF
                  {pdfs.truncated ? "+" : ""}
                </p>
              )}
              {syncS?.counts && (
                <p className="text-muted-foreground">
                  D1: {Object.values(syncS.counts).reduce((a, b) => a + b, 0)}{" "}
                  satır
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="border border-red-500/50 bg-red-500/5 rounded p-3 text-red-500 text-xs">
              {error}
            </div>
          )}

          <div className="pt-2">
            <Link
              href="/hmgs"
              className={buttonVariants({ variant: "default", size: "lg" }) + " w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 mb-4 animate-pulse"}
            >
              🎯 HMGS Deneme Simülasyonu
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/ozetler"
              className={buttonVariants({ variant: "secondary" }) + " glass hover-glow border-primary/20 text-primary"}
            >
              ⚡ Son Gece Özetleri
            </Link>
            <Link
              href="/emsal-kararlar"
              className={buttonVariants({ variant: "secondary" }) + " glass hover-glow border-primary/20 text-primary"}
            >
              ⚖️ Emsal Kararlar
            </Link>
            
            <Link
              href="/dashboard"
              className={buttonVariants({ variant: "outline" })}
            >
              ⏱️ Pomodoro
            </Link>
            <Link
              href="/reader"
              className={buttonVariants({ variant: "outline" })}
            >
              📖 Kitaplar
            </Link>
            <Link
              href="/practice"
              className={buttonVariants({ variant: "outline" })}
            >
              📝 Pratik Çöz
            </Link>
            <Link
              href="/kanunlar"
              className={buttonVariants({ variant: "outline" })}
            >
              📜 Kanunlar
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Right Side: İrem'in Asistanı */}
      <div className="w-full lg:col-span-8 h-full min-h-[600px] flex items-stretch">
        <GlobalAiAssistant />
      </div>
        </div>
      </div>
    </main>
  );
}
