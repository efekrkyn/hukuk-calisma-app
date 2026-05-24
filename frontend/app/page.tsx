"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
          <CardTitle>Merhaba Efe 👋</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Hukuk çalışma uygulaması — Sprint 0 iskeleti.
          </p>

          {health && (
            <div className="border rounded p-3 space-y-1">
              <p>
                <span className="text-green-500">●</span> Worker:{" "}
                <span className="font-mono">{health.status}</span>{" "}
                <span className="text-muted-foreground">({health.region})</span>
              </p>
              {syncS && (
                <p className="text-muted-foreground">
                  D1 tabloları:{" "}
                  {Object.entries(syncS.counts)
                    .map(([t, n]) => `${t}=${n}`)
                    .join(", ")}
                </p>
              )}
              {pdfs && (
                <p className="text-muted-foreground">
                  R2: {pdfs.objects.length} PDF
                  {pdfs.truncated ? "+ (daha var)" : ""}
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="border border-red-500/50 bg-red-500/5 rounded p-3 text-red-500">
              {error}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
