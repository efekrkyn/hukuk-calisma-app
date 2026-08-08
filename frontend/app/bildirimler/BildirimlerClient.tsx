"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { spring } from "@/lib/motion";
import { Check, Loader2, Trash2 } from "lucide-react";

type Report = {
  id: string;
  question_id: string;
  subject_name: string;
  reason: string;
  reported_at: number;
  reported_by: string | null;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  source_pdf: string | null;
  source_page: number | null;
  verdict: string | null;
  verdict_reason: string | null;
};

const tarih = (ms: number) =>
  new Date(ms).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function BildirimlerClient() {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/worker/hmgs/reports")
      .then((r) => {
        if (!r.ok) throw new Error("Bildirimler yüklenemedi.");
        return r.json();
      })
      .then((d) => setReports(d.reports ?? []))
      .catch((e) => setError(e.message));
  }, []);

  async function karar(question_id: string, action: "delete" | "keep") {
    setBusy(question_id);
    try {
      const r = await fetch("/api/worker/hmgs/reports/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question_id, action }),
      });
      if (!r.ok) throw new Error(String(r.status));
      // Karar verilen bildirim kuyruktan çıkar; yeniden çekmeye gerek yok.
      setReports((prev) => (prev ?? []).filter((x) => x.question_id !== question_id));
    } catch {
      setError("Karar kaydedilemedi, tekrar dene.");
    } finally {
      setBusy(null);
    }
  }

  if (error && !reports) {
    return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  }

  if (!reports) {
    return (
      <p className="text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
        Yükleniyor…
      </p>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="material-thin rounded-xl p-6 text-center space-y-1">
        <p className="text-sm font-semibold">Bekleyen bildirim yok</p>
        <p className="text-xs text-muted-foreground">
          Soru çözerken bir soru hatalı görünürse bayrak düğmesiyle bildirilir;
          bildirilenler burada birikir.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      <AnimatePresence initial={false}>
        {reports.map((r) => (
          <motion.article
            key={r.question_id}
            layout
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={spring}
            className="material-thin rounded-xl p-4 space-y-3 overflow-hidden"
          >
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                {r.subject_name}
              </span>
              <span>{tarih(r.reported_at)}</span>
              {r.reported_by ? <span>· {r.reported_by}</span> : null}
            </div>

            {r.reason ? (
              <p className="text-sm border-l-2 border-amber-500/50 pl-3 text-amber-800 dark:text-amber-300">
                {r.reason}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground italic">Gerekçe yazılmamış.</p>
            )}

            <p className="text-sm leading-relaxed">{r.question}</p>

            <ol className="text-sm space-y-1">
              {r.options.map((o, i) => (
                <li
                  key={i}
                  className={
                    i === r.correctAnswer
                      ? "text-green-700 dark:text-green-400 font-medium"
                      : "text-muted-foreground"
                  }
                >
                  {String.fromCharCode(65 + i)}) {o}
                  {i === r.correctAnswer ? " ✓" : ""}
                </li>
              ))}
            </ol>

            <p className="text-xs text-muted-foreground leading-relaxed">{r.explanation}</p>

            {r.verdict_reason ? (
              <p className="text-xs text-muted-foreground leading-relaxed border-t border-neutral-200 dark:border-neutral-800 pt-2">
                <span className="font-semibold">Makine denetimi ({r.verdict}):</span>{" "}
                {r.verdict_reason}
              </p>
            ) : null}

            {r.source_pdf ? (
              <p className="text-[10px] text-muted-foreground">
                Kaynak: {r.source_pdf}
                {r.source_page ? `, s. ${r.source_page}` : ""}
              </p>
            ) : null}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => karar(r.question_id, "delete")}
                disabled={busy === r.question_id}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden />
                Soruyu sil
              </button>
              <button
                type="button"
                onClick={() => karar(r.question_id, "keep")}
                disabled={busy === r.question_id}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20 disabled:opacity-50 transition-colors"
              >
                <Check className="w-3.5 h-3.5" aria-hidden />
                Soru doğru, tut
              </button>
            </div>
          </motion.article>
        ))}
      </AnimatePresence>
    </div>
  );
}
