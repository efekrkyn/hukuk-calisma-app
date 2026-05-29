"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TaskCell } from "./TaskCell";
import { getActivePlan } from "@/lib/plan-api";
import type { Day } from "@/types/plan";

function todayDateStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function TodayCard() {
  const [today, setToday] = useState<Day | null>(null);
  const [completions, setCompletions] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [hasPlan, setHasPlan] = useState(false);

  useEffect(() => {
    getActivePlan()
      .then((r) => {
        if (!r.plan) {
          setHasPlan(false);
          return;
        }
        setHasPlan(true);
        setCompletions(r.completions);
        const todayStr = todayDateStr();
        for (const w of r.plan.ai_output.weeks) {
          for (const d of w.days) {
            if (d.date === todayStr) {
              setToday(d);
              return;
            }
          }
        }
        setToday(null);
      })
      .catch(() => setHasPlan(false))
      .finally(() => setLoading(false));
  }, []);

  function handleToggle(uuid: string, next: boolean) {
    setCompletions((prev) => {
      const cp = { ...prev };
      if (next) cp[uuid] = Date.now();
      else delete cp[uuid];
      return cp;
    });
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 text-xs text-muted-foreground animate-pulse flex items-center justify-between">
        <span>📅 Günlük plan yükleniyor...</span>
        <div className="h-4 w-4 bg-muted rounded-full"></div>
      </div>
    );
  }

  if (!hasPlan) {
    return (
      <Link
        href="/plan/setup"
        className="block rounded-xl border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 p-5 text-sm transition-all duration-200 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <div className="text-2xl">🗓️</div>
          <div>
            <span className="font-bold text-blue-900 dark:text-blue-100 block">İlk Çalışma Planını Oluştur →</span>
            <p className="text-xs text-blue-700/80 dark:text-blue-300/80 mt-1 leading-normal font-medium">
              Yapay zeka sınav tarihine kadar saat-saat çalışma takvimi hazırlar.
            </p>
          </div>
        </div>
      </Link>
    );
  }

  if (!today || today.tasks.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 bg-neutral-50/50 dark:bg-neutral-800/10 space-y-2">
        <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
          📅 Bugün için planlanmış ders yok. (Dinlenme günü)
        </p>
        <Link
          href="/plan"
          className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-500 hover:underline"
        >
          Çalışma programının tamamı →
        </Link>
      </div>
    );
  }

  const done = today.tasks.filter((t) => completions[t.uuid]).length;
  const total = today.tasks.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 space-y-3 bg-card shadow-sm">
      <div className="flex items-center justify-between border-b pb-2">
        <div>
          <span className="font-bold text-sm text-neutral-800 dark:text-neutral-200 block">
            📅 Bugünün Görevleri
          </span>
          <span className="text-[10px] text-muted-foreground font-semibold">
            {today.weekday} · {today.date}
          </span>
        </div>
        <div className="text-right">
          <span className="text-xs font-bold text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded-full">
            ⚡ {done}/{total} (%{progress})
          </span>
        </div>
      </div>
      <div className="space-y-2">
        {today.tasks.map((t) => (
          <TaskCell
            key={t.uuid}
            task={t}
            completed={!!completions[t.uuid]}
            onToggle={handleToggle}
          />
        ))}
      </div>
      <div className="pt-1">
        <Link
          href="/plan"
          className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-500 hover:underline"
        >
          Çalışma programının tamamı →
        </Link>
      </div>
    </div>
  );
}
