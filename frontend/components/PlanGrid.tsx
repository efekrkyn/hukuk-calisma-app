"use client";

import { useState } from "react";
import { Calendar, Zap } from "lucide-react";
import { TaskCell } from "./TaskCell";
import type { Week, Day } from "@/types/plan";
import { addTaskToPlan } from "@/lib/plan-api";

type Props = {
  weeks: Week[];
  completions: Record<string, number>;
};

const WEEKDAY_ORDER = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

export function PlanGrid({ weeks, completions: initial }: Props) {
  const [completions, setCompletions] = useState(initial);
  const [activeWeek, setActiveWeek] = useState(0);

  // Add Task State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addDate, setAddDate] = useState("");
  const [addCourse, setAddCourse] = useState("");
  const [addStart, setAddStart] = useState("10:00");
  const [addEnd, setAddEnd] = useState("11:00");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleToggle(uuid: string, next: boolean) {
    setCompletions((prev) => {
      const cp = { ...prev };
      if (next) cp[uuid] = Date.now();
      else delete cp[uuid];
      return cp;
    });
  }

  async function handleAddTask() {
    if (!addCourse.trim()) return alert("Görev adı giriniz.");
    setIsSubmitting(true);
    try {
      // Elle eklenen görev "serbest": HMGS alanına bağlı değil, hedefi de yok.
      await addTaskToPlan(addDate, {
        uuid: crypto.randomUUID(),
        subject: null,
        topic: addCourse.trim(),
        task_type: "serbest",
        time_start: addStart,
        time_end: addEnd,
      });
      window.location.reload();
    } catch (e) {
      alert("Hata: " + String(e));
      setIsSubmitting(false);
    }
  }

  const week = weeks[activeWeek];
  if (!week) return <p className="text-sm text-muted-foreground text-center p-8 border rounded-xl bg-card">Çalışma planı bulunamadı.</p>;

  // Sort days based on WEEKDAY_ORDER
  const daysByOrder: Day[] = WEEKDAY_ORDER.map(
    (wd) => week.days.find((d) => d.weekday === wd) ?? null
  ).filter((x): x is Day => x !== null);

  const fullWeekDays: { date: string; weekday: string; tasks: any[] }[] = WEEKDAY_ORDER.map((wd, idx) => {
    const existingDay = daysByOrder.find(d => d.weekday === wd);
    if (existingDay) return existingDay;

    const baseDate = new Date(week.start_date);
    baseDate.setDate(baseDate.getDate() + idx);
    const y = baseDate.getFullYear();
    const m = String(baseDate.getMonth() + 1).padStart(2, "0");
    const d = String(baseDate.getDate()).padStart(2, "0");

    return {
      date: `${y}-${m}-${d}`,
      weekday: wd,
      tasks: []
    };
  });

  return (
    <div className="space-y-4 relative">
      {/* Week Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 border-b scrollbar-thin">
        {weeks.map((w, i) => {
          const totalTasks = w.days.reduce((acc, curr) => acc + curr.tasks.length, 0);
          const completedTasks = w.days.reduce((acc, curr) => 
            acc + curr.tasks.filter(t => completions[t.uuid]).length, 0
          );
          const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

          return (
            <button
              key={w.week_index}
              onClick={() => setActiveWeek(i)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 flex flex-col items-center gap-1 min-w-[90px] border ${
                i === activeWeek
                  ? "bg-primary text-white border-primary shadow-sm"
                  : "bg-card text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 border-neutral-200 dark:border-neutral-800"
              }`}
            >
              <span>Hafta {w.week_index}</span>
              <span className={`text-[10px] ${i === activeWeek ? "text-primary-foreground" : "text-muted-foreground"}`}>
                <Zap className="w-4 h-4 shrink-0" aria-hidden />%{progress}
              </span>
            </button>
          );
        })}
      </div>

      {/* Date Range & Summary */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1 bg-neutral-50 dark:bg-neutral-800/40 p-2 rounded-lg">
        <span className="font-semibold">
                <Calendar className="w-4 h-4 shrink-0" aria-hidden />Tarih Aralığı: {week.start_date}  {week.end_date}</span>
        <span className="font-medium text-primary">
          Toplam Görev: {week.days.reduce((acc, curr) => acc + curr.tasks.length, 0)}
        </span>
      </div>

      {/* Grid Layout: Desktop 7 columns, Mobile vertical scroll */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {fullWeekDays.map((day) => {
          const isToday = new Date(day.date).toDateString() === new Date().toDateString();

          return (
            <div
              key={day.date}
              className={`border rounded-xl p-3 flex flex-col space-y-2 transition-all duration-200 ${
                isToday
                  ? "border-primary bg-primary/5 dark:bg-primary/10 ring-2 ring-primary/20"
                  : "border-neutral-200 dark:border-neutral-800 bg-card"
              }`}
            >
              <div className="flex justify-between items-center border-b pb-1.5">
                <span className={`text-xs font-bold ${isToday ? "text-primary" : ""}`}>
                  {day.weekday}
                </span>
                <span className="text-[10px] text-muted-foreground font-medium">
                  {day.date.slice(5)}
                </span>
              </div>

              <div className="flex-1 space-y-2">
                {day.tasks.length === 0 ? (
                  <div className="h-full flex items-center justify-center py-6">
                    <p className="text-[10px] text-muted-foreground italic text-center"> Boş Gün / Dinlenme</p>
                  </div>
                ) : (
                  day.tasks.map((t) => (
                    <TaskCell
                      key={t.uuid}
                      task={t}
                      completed={!!completions[t.uuid]}
                      onToggle={handleToggle}
                    />
                  ))
                )}
              </div>

              <button
                onClick={() => {
                  setAddDate(day.date);
                  setAddCourse("");
                  setShowAddModal(true);
                }}
                className="mt-2 w-full py-1.5 text-[10px] font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-md transition-colors"
              >
                + Görev Ekle
              </button>
            </div>
          );
        })}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-neutral-900 p-5 rounded-xl shadow-xl max-w-sm w-full space-y-4">
            <h3 className="font-bold text-lg border-b pb-2">Yeni Görev Ekle ({addDate})</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold mb-1 block">Görev</label>
                <input
                  type="text"
                  value={addCourse}
                  onChange={e => setAddCourse(e.target.value)}
                  placeholder="Örn: Ders notu yaz, kanun oku..."
                  className="w-full text-sm border p-2 rounded-md bg-transparent"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-semibold mb-1 block">Başlangıç</label>
                  <input 
                    type="time" 
                    value={addStart} 
                    onChange={e => setAddStart(e.target.value)} 
                    className="w-full text-sm border p-2 rounded-md bg-transparent"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-semibold mb-1 block">Bitiş</label>
                  <input 
                    type="time" 
                    value={addEnd} 
                    onChange={e => setAddEnd(e.target.value)} 
                    className="w-full text-sm border p-2 rounded-md bg-transparent"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button 
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 text-sm font-semibold rounded-md border hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                İptal
              </button>
              <button 
                onClick={handleAddTask}
                disabled={isSubmitting}
                className="px-3 py-1.5 text-sm font-semibold rounded-md bg-primary text-white hover:bg-primary disabled:opacity-50"
              >
                {isSubmitting ? "Ekleniyor..." : "Ekle"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
