"use client";

import { useRouter } from "next/navigation";
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
import { COURSES } from "@/lib/courses";
import { generatePlan } from "@/lib/plan-api";
import type { FormInput } from "@/types/plan";

export default function PlanSetupPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [targetExam, setTargetExam] = useState<FormInput["target_exam"]>("final");
  const [examDate, setExamDate] = useState("2026-06-30");
  const [hoursWeekday, setHoursWeekday] = useState(4);
  const [hoursWeekend, setHoursWeekend] = useState(8);
  const [windowStart, setWindowStart] = useState("09:00");
  const [windowEnd, setWindowEnd] = useState("18:00");
  const [weakCourses, setWeakCourses] = useState<string[]>(["borclar_genel"]);
  const [notes, setNotes] = useState("");

  function toggleWeak(courseId: string) {
    setWeakCourses((prev) =>
      prev.includes(courseId)
        ? prev.filter((x) => x !== courseId)
        : [...prev, courseId]
    );
  }

  function computeWeeksRemaining(): number {
    const exam = new Date(examDate);
    const today = new Date();
    const ms = exam.getTime() - today.getTime();
    return Math.max(1, Math.ceil(ms / (7 * 24 * 60 * 60 * 1000)));
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const form: FormInput = {
        target_exam: targetExam,
        exam_date: examDate,
        weeks_remaining: computeWeeksRemaining(),
        weekly_hours_weekday: hoursWeekday,
        weekly_hours_weekend: hoursWeekend,
        study_window_start: windowStart,
        study_window_end: windowEnd,
        weak_courses: weakCourses,
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
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            🗓️ Çalışma Programı Üreticisi
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Yapay zeka ile kişiselleştirilmiş, saat-saat çalışma takviminizi oluşturun.
          </p>
        </div>
        <Link href="/" className="text-sm font-medium text-blue-600 hover:text-blue-500 hover:underline">
          ← Ana sayfa
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card className="shadow-sm border-neutral-200/80 dark:border-neutral-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">1) Hedef Sınav</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-2">
              {(["final", "hmgs", "both"] as const).map((v) => (
                <Button
                  key={v}
                  variant={targetExam === v ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setTargetExam(v);
                    if (v === "final") {
                      setExamDate("2026-06-30");
                    } else if (v === "hmgs") {
                      setExamDate("2026-09-27");
                    }
                  }}
                  className="flex-1 transition-all duration-200"
                >
                  {v === "final" ? "Final (30 Haz)" : v === "hmgs" ? "HMGS (27 Eyl)" : "İkisi Birden"}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-neutral-200/80 dark:border-neutral-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">2) Sınav Tarihi</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-2 font-medium">
                ⏱️ Kalan Süre: <span className="text-blue-600 font-bold">{computeWeeksRemaining()}</span> hafta
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-neutral-200/80 dark:border-neutral-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">3) Günlük Çalışma Süresi (Saat)</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">Hafta İçi (Saat)</label>
                <Input
                  type="number"
                  min={0}
                  max={12}
                  step={0.5}
                  value={hoursWeekday}
                  onChange={(e) => setHoursWeekday(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">Hafta Sonu (Saat)</label>
                <Input
                  type="number"
                  min={0}
                  max={12}
                  step={0.5}
                  value={hoursWeekend}
                  onChange={(e) => setHoursWeekend(Number(e.target.value))}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-neutral-200/80 dark:border-neutral-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">4) Çalışma Saat Penceresi</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
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
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="shadow-sm border-neutral-200/80 dark:border-neutral-800 h-[calc(100%-88px)] flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">5) Zayıf Dersler (AI bu derslere %30 ağırlık verir)</CardTitle>
            </CardHeader>
            <CardContent className="overflow-y-auto max-h-[320px] pr-2 space-y-2 flex-1 scrollbar-thin">
              {COURSES.filter(c => c.id !== "kanunlar" && c.id !== "kisisel").map((c) => (
                <label
                  key={c.id}
                  className={`flex items-center gap-3 p-2 rounded-lg border text-sm cursor-pointer transition-all duration-150 ${
                    weakCourses.includes(c.id)
                      ? "bg-blue-500/5 border-blue-500/40 text-blue-900 dark:text-blue-100"
                      : "border-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={weakCourses.includes(c.id)}
                    onChange={() => toggleWeak(c.id)}
                    className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-medium">{c.name}</span>
                </label>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-neutral-200/80 dark:border-neutral-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">6) Özel Kısıtlamalar ve Notlar (Opsiyonel)</CardTitle>
            </CardHeader>
            <CardContent>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Örnek: Salı akşamları 18:00 sonrası ders çalışamam, Cuma günleri stajım var vb."
                className="w-full min-h-[90px] p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {error && (
        <div className="border border-red-500/30 bg-red-500/5 dark:bg-red-500/10 rounded-xl p-4 text-sm text-red-600 dark:text-red-400 font-medium">
          ⚠️ Hata oluştu: {error}
        </div>
      )}

      <Button
        onClick={submit}
        disabled={submitting}
        className="w-full py-6 text-base font-bold shadow-md transition-all duration-200"
        size="lg"
      >
        {submitting ? "🤖 Yapay Zeka Programı Oluşturuyor (~10-15 sn)..." : "⚡ Programı Oluştur"}
      </Button>
    </main>
  );
}
