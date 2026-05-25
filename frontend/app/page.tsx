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
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Navigation & Stats */}
        <Card className="w-full lg:col-span-4">
        <CardHeader>
          <CardTitle>Hukuk Çalışma 📚</CardTitle>
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

          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/reader"
              className={buttonVariants({ variant: "default" })}
            >
              📖 Kitaplar
            </Link>
            <Link
              href="/practice"
              className={buttonVariants({ variant: "outline" })}
            >
              ⚖️ Pratik Olaylar
            </Link>
            <Link
              href="/kanunlar"
              className={
                buttonVariants({ variant: "outline" }) + " col-span-2"
              }
            >
              📜 Kanunlar (16)
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Right Side: Omni AI Assistant */}
      <div className="w-full lg:col-span-8 h-full min-h-[600px] flex items-stretch">
        <GlobalAiAssistant />
      </div>
    </div>
  </main>
  );
}
