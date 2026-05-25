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
    <main className="min-h-screen p-6 flex items-center justify-center bg-background">
      <Card className="max-w-md w-full">
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

          <Link
            href="/reader"
            className={buttonVariants({ variant: "default" }) + " w-full"}
          >
            📖 Kitaplara Git
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
