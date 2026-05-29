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

type CourseEntry = {
  selectedId: string;
  customName: string;
  examDate: string;
};

export default function PlanSetupPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [courseCount, setCourseCount] = useState(3);
  const [courses, setCourses] = useState<CourseEntry[]>(
    Array.from({ length: 3 }).map(() => ({
      selectedId: "",
      customName: "",
      examDate: "2026-06-30",
    }))
  );

  const [hoursWeekday, setHoursWeekday] = useState(4);
  const [hoursWeekend, setHoursWeekend] = useState(8);
  const [windowStart, setWindowStart] = useState("09:00");
  const [windowEnd, setWindowEnd] = useState("18:00");
  const [breakMinutes, setBreakMinutes] = useState(15);
  const [notes, setNotes] = useState("");

  function handleCourseCountChange(val: number) {
    if (val < 1 || val > 25) return;
    setCourseCount(val);
    setCourses((prev) => {
      const copy = [...prev];
      if (val > prev.length) {
        for (let i = prev.length; i < val; i++) {
          copy.push({ selectedId: "", customName: "", examDate: "2026-06-30" });
        }
      } else {
        copy.splice(val);
      }
      return copy;
    });
  }

  function updateCourse(index: number, field: keyof CourseEntry, value: string) {
    setCourses((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  }

  function computeWeeksRemaining(): number {
    if (courses.length === 0) return 1;
    let maxDate = new Date();
    for (const c of courses) {
      if (c.examDate) {
        const d = new Date(c.examDate);
        if (d > maxDate) maxDate = d;
      }
    }
    const today = new Date();
    const ms = maxDate.getTime() - today.getTime();
    return Math.max(1, Math.ceil(ms / (7 * 24 * 60 * 60 * 1000)));
  }

  async function submit() {
    setError(null);

    // Validate courses
    const finalCourses: { name: string; exam_date: string }[] = [];
    for (let i = 0; i < courses.length; i++) {
      const c = courses[i];
      const name = c.selectedId === "other" ? c.customName.trim() : (COURSES.find(x => x.id === c.selectedId)?.name || "");
      if (!name) {
        setError(`${i + 1}. dersin adını seçin veya yazın.`);
        return;
      }
      if (!c.examDate) {
        setError(`${name} dersinin final tarihini girin.`);
        return;
      }
      finalCourses.push({ name, exam_date: c.examDate });
    }

    setSubmitting(true);
    try {
      const form: FormInput = {
        courses: finalCourses,
        weeks_remaining: computeWeeksRemaining(),
        weekly_hours_weekday: hoursWeekday,
        weekly_hours_weekend: hoursWeekend,
        study_window_start: windowStart,
        study_window_end: windowEnd,
        break_minutes: breakMinutes,
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
              <CardTitle className="text-base font-semibold">1) Kaç Dersiniz Var?</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                type="number"
                min={1}
                max={25}
                value={courseCount}
                onChange={(e) => handleCourseCountChange(Number(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-2 font-medium">
                Bu sayıya göre aşağıda ders ve tarih seçim alanları açılacaktır.
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-neutral-200/80 dark:border-neutral-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">2) Dersler ve Final Tarihleri</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-h-[400px] overflow-y-auto scrollbar-thin pr-2">
              {courses.map((c, i) => (
                <div key={i} className="p-3 border rounded-lg bg-neutral-50 dark:bg-neutral-900/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-600">Ders {i + 1}</span>
                  </div>
                  <div>
                    <select
                      value={c.selectedId}
                      onChange={(e) => updateCourse(i, "selectedId", e.target.value)}
                      className="w-full text-sm border p-2 rounded-md bg-white dark:bg-black focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Ders Seçiniz --</option>
                      {COURSES.filter(x => x.id !== "kanunlar" && x.id !== "kisisel").map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.name}
                        </option>
                      ))}
                      <option value="other">➕ Diğer (Yeni Ders Ekle)</option>
                    </select>
                  </div>
                  {c.selectedId === "other" && (
                    <div>
                      <Input
                        type="text"
                        placeholder="Ders adını yazınız..."
                        value={c.customName}
                        onChange={(e) => updateCourse(i, "customName", e.target.value)}
                        className="w-full"
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-xs text-muted-foreground font-medium mb-1 block">Final Tarihi</label>
                    <Input
                      type="date"
                      value={c.examDate}
                      onChange={(e) => updateCourse(i, "examDate", e.target.value)}
                      className="w-full"
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
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
              <CardTitle className="text-base font-semibold">4) Çalışma Penceresi & Mola</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-4">
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
              <CardTitle className="text-base font-semibold">5) Özel Kısıtlamalar ve Notlar (Opsiyonel)</CardTitle>
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
