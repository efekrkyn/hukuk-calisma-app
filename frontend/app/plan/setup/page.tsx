"use client";

import { useRouter } from "next/navigation";
import { Calendar, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { generatePlan } from "@/lib/plan-api";
import { WEEKDAYS, type FormInput, type Weekday } from "@/types/plan";

/**
 * Plan formu — HMGS sürümü.
 *
 * Ders seçimi yok: HMGS'nin 20 alanı sabit ve ağırlıkları kılavuzdan geliyor.
 * Kullanıcıdan yalnızca takvimi kuran bilgiler isteniyor.
 */
export default function PlanSetupPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [examDate, setExamDate] = useState("");
  const [dailyHours, setDailyHours] = useState(4);
  const [windowStart, setWindowStart] = useState("09:00");
  const [windowEnd, setWindowEnd] = useState("18:00");
  const [breakMinutes, setBreakMinutes] = useState(15);
  const [daysOff, setDaysOff] = useState<Weekday[]>([]);
  const [notes, setNotes] = useState("");

  function toggleDayOff(d: Weekday) {
    setDaysOff((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  const daysLeft = examDate
    ? Math.ceil((new Date(examDate).getTime() - Date.now()) / 86_400_000)
    : null;

  async function submit() {
    setError(null);
    if (!examDate) {
      setError("HMGS tarihini girin.");
      return;
    }
    if (daysLeft !== null && daysLeft < 1) {
      setError("Sınav tarihi bugünden sonra olmalı.");
      return;
    }
    if (daysOff.length >= 7) {
      setError("Haftanın tamamını tatil seçerseniz plan kuracak gün kalmıyor.");
      return;
    }
    if (windowEnd <= windowStart) {
      setError("Çalışma penceresinin bitişi başlangıcından sonra olmalı.");
      return;
    }

    setSubmitting(true);
    try {
      const form: FormInput = {
        exam_date: examDate,
        daily_hours: dailyHours,
        study_window_start: windowStart,
        study_window_end: windowEnd,
        break_minutes: breakMinutes,
        days_off: daysOff,
        notes,
      };
      const r = await generatePlan(form);
      if (r.plan_id) {
        router.push("/plan");
      } else {
        setError("Beklenmedik cevap");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <Calendar className="w-7 h-7 text-primary shrink-0" aria-hidden />
            HMGS Çalışma Programı
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            20 alanın sınav ağırlığı ve senin doğruluk oranların dikkate alınarak
            iki haftalık, saat-saat takvim üretilir.
          </p>
        </div>
        <Link href="/" className="text-sm font-medium text-primary hover:text-primary/80 hover:underline">
          ← Ana sayfa
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card className="shadow-sm border-neutral-200/80 dark:border-neutral-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">1) Sınav Tarihi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground font-medium">
                {daysLeft !== null && daysLeft > 0
                  ? `Sınava ${daysLeft} gün kaldı. Kalan süreye göre konu / soru / deneme dengesi değişir.`
                  : "HMGS'nin yapılacağı tarihi girin."}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-neutral-200/80 dark:border-neutral-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">2) Günlük Çalışma Süresi</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                type="number"
                min={0.5}
                max={14}
                step={0.5}
                value={dailyHours}
                onChange={(e) => setDailyHours(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground mt-2 font-medium">
                Çalışma günü başına hedef saat (mola hariç).
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-neutral-200/80 dark:border-neutral-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">3) Tatil Günleri</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {WEEKDAYS.map((d) => {
                const on = daysOff.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleDayOff(d)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      on
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="shadow-sm border-neutral-200/80 dark:border-neutral-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">4) Çalışma Penceresi & Mola</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">Başlangıç</label>
                <Input
                  type="time"
                  value={windowStart}
                  onChange={(e) => setWindowStart(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">Bitiş</label>
                <Input
                  type="time"
                  value={windowEnd}
                  onChange={(e) => setWindowEnd(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">Mola (dk)</label>
                <Input
                  type="number"
                  min={0}
                  max={120}
                  step={5}
                  value={breakMinutes}
                  onChange={(e) => setBreakMinutes(Number(e.target.value))}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-neutral-200/80 dark:border-neutral-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">5) Özel Kısıtlamalar (Opsiyonel)</CardTitle>
            </CardHeader>
            <CardContent>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Örnek: Salı akşamları 18:00 sonrası çalışamam, Cuma günleri stajım var vb."
                className="w-full min-h-[90px] p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {error && (
        <div className="border border-red-500/30 bg-red-500/5 dark:bg-red-500/10 rounded-xl p-4 text-sm text-red-600 dark:text-red-400 font-medium flex items-center gap-2">
          <TriangleAlert className="w-4 h-4 shrink-0" aria-hidden />
          {error}
        </div>
      )}

      <Button
        onClick={submit}
        disabled={submitting}
        className="w-full py-6 text-base font-bold shadow-md transition-all duration-200"
        size="lg"
      >
        {submitting ? "Program oluşturuluyor (~15 sn)..." : "Programı Oluştur"}
      </Button>
    </main>
  );
}
