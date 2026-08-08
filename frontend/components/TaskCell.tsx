"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock } from "lucide-react";
import { toggleTask } from "@/lib/plan-api";
import type { Task } from "@/types/plan";

type Props = {
  task: Task;
  completed: boolean;
  onToggle: (uuid: string, next: boolean) => void;
};

/** Her tür, uygulamada gerçekten var olan bir eyleme karşılık gelir. */
const TYPE_BADGES: Record<Task["task_type"], { label: string; cta: string; cls: string }> = {
  konu: { label: "Konu", cta: "Konu anlatımını aç", cls: "bg-primary/10 text-primary" },
  soru: { label: "Soru", cta: "Soru çözmeye başla", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  tekrar: { label: "Tekrar", cta: "Yanlışlarım kuyruğu", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  deneme: { label: "Deneme", cta: "Tam denemeyi başlat (155 dk)", cls: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  serbest: { label: "Serbest", cta: "", cls: "bg-neutral-500/10 text-neutral-600 dark:text-neutral-400" },
};

export function TaskCell({ task, completed, onToggle }: Props) {
  const [pending, setPending] = useState(false);
  const badge = TYPE_BADGES[task.task_type];

  async function handleToggle() {
    setPending(true);
    const next = !completed;
    onToggle(task.uuid, next); // optimistic UI update
    try {
      await toggleTask(task.uuid, next);
    } catch (e) {
      onToggle(task.uuid, !next); // rollback on error
      console.error("Task toggle failed:", e);
    } finally {
      setPending(false);
    }
  }

  // target_ref worker tarafında doğrulanıp kanonik biçimde üretiliyor
  // ("hmgs?subject=ceza", "konular?subject=...&konu=...", "tekrar") — burada
  // eşleme tablosu tutmaya gerek yok, başına "/" koymak yeterli.
  const targetHref = task.target_ref ? `/${task.target_ref}` : null;

  return (
    <div
      className={`border rounded-lg p-3 text-xs space-y-2 transition-all duration-200 ${
        completed
          ? "bg-green-500/5 dark:bg-green-500/10 border-green-500/30 opacity-75 shadow-sm"
          : "bg-card hover:bg-neutral-50 dark:hover:bg-neutral-800/50 border-neutral-200 dark:border-neutral-800 hover:shadow-sm"
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          // Ekran okuyucuda adsız bir kutu "onay kutusu" diye okunuyordu;
          // hangi görev olduğu anlaşılmıyor.
          aria-label={`${task.topic} görevini tamamlandı olarak işaretle`}
          checked={completed}
          onChange={handleToggle}
          disabled={pending}
          className="mt-0.5 h-4 w-4 rounded border-neutral-300 dark:border-neutral-700 text-primary focus:ring-primary cursor-pointer disabled:opacity-50"
        />
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-semibold">
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3 shrink-0" aria-hidden />
              {task.time_start}–{task.time_end}
            </span>
            <span className={`px-1.5 py-0.5 rounded-full ${badge.cls} text-[9px] font-bold uppercase tracking-wider`}>
              {badge.label}
            </span>
          </div>
          <div className={`text-neutral-800 dark:text-neutral-200 leading-snug break-words ${completed ? "line-through text-muted-foreground font-normal" : "font-semibold"}`}>
            {task.topic}
          </div>
          {targetHref ? (
            <Link
              href={targetHref}
              className="inline-flex items-center gap-1 text-primary hover:underline text-[10px] font-medium pt-1"
            >
              {badge.cta} →
            </Link>
          ) : null}
          {task.tip && (
            <div className="text-[10px] text-amber-700 dark:text-amber-400 italic pt-1 border-t border-amber-500/10 mt-1">
               {task.tip}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
