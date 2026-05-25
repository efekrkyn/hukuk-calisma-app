"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calendar, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type Task = {
  id: string;
  text: string;
  date: string;
  done: boolean;
};

export default function TakvimPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState("");
  const [newDate, setNewDate] = useState("");

  const addTask = () => {
    if (!newTask.trim() || !newDate) return;
    setTasks((prev) => [
      ...prev,
      { id: crypto.randomUUID(), text: newTask, date: newDate, done: false },
    ]);
    setNewTask("");
    setNewDate("");
  };

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  };

  const removeTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const sortedTasks = [...tasks].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const today = new Date().toISOString().split("T")[0];

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Link
            href="/"
            className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Ana sayfa
          </Link>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-gradient">
            <Calendar className="w-8 h-8 text-primary" />
            Sınav Takvimi & Görev Yöneticisi
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sınavlarını ve günlük çalışma görevlerini buradan takip et.
          </p>
        </div>

        {/* Add Task */}
        <Card className="glass border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Yeni Görev Ekle</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                placeholder="Görev: Anayasa Hukuku 3 test çöz"
                className="flex-1 p-2 border rounded-md bg-background text-sm"
                onKeyDown={(e) => e.key === "Enter" && addTask()}
              />
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="p-2 border rounded-md bg-background text-sm"
              />
              <Button onClick={addTask} disabled={!newTask.trim() || !newDate} className="hover-glow">
                <Plus className="w-4 h-4 mr-1" /> Ekle
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Task List */}
        <div className="space-y-3">
          {sortedTasks.length === 0 && (
            <div className="text-center py-16 glass rounded-2xl border border-border">
              <Calendar className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
              <h3 className="text-lg font-medium">Henüz görev eklenmemiş</h3>
              <p className="text-sm text-muted-foreground mt-1">Yukarıdan yeni görevler ekleyerek çalışma planını oluştur.</p>
            </div>
          )}
          {sortedTasks.map((task) => {
            const isOverdue = !task.done && task.date < today;
            return (
              <Card
                key={task.id}
                className={`glass border transition-all ${
                  task.done
                    ? "border-green-500/30 bg-green-500/5 opacity-70"
                    : isOverdue
                    ? "border-red-500/30 bg-red-500/5"
                    : "border-primary/20"
                }`}
              >
                <CardContent className="flex items-center gap-3 py-3 px-4">
                  <button
                    onClick={() => toggleTask(task.id)}
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                      task.done
                        ? "bg-green-500 border-green-500 text-white"
                        : "border-muted-foreground/50 hover:border-primary"
                    }`}
                  >
                    {task.done && <CheckCircle2 className="w-4 h-4" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${task.done ? "line-through text-muted-foreground" : ""}`}>
                      {task.text}
                    </p>
                    <p className={`text-xs ${isOverdue ? "text-red-500 font-semibold" : "text-muted-foreground"}`}>
                      {isOverdue ? "⚠️ Gecikmiş — " : ""}{task.date}
                    </p>
                  </div>
                  <button
                    onClick={() => removeTask(task.id)}
                    className="text-muted-foreground/50 hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </main>
  );
}
