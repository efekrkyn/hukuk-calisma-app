"use client";

import { useState, useEffect } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Task = {
  id: string;
  text: string;
  completed: boolean;
};

export default function DailyTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("hukuk_daily_tasks");
    if (saved) {
      try {
        setTasks(JSON.parse(saved));
      } catch (e) {
        // ignore
      }
    } else {
      setTasks([
        { id: "1", text: "Borçlar Genel: 50 Soru Çöz", completed: false },
        { id: "2", text: "Medeni Hukuk: Flashcard Tekrarı", completed: false },
      ]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("hukuk_daily_tasks", JSON.stringify(tasks));
  }, [tasks]);

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    
    setTasks([
      ...tasks,
      { id: Date.now().toString(), text: newTask.trim(), completed: false },
    ]);
    setNewTask("");
  };

  const toggleTask = (id: string) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const removeTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const progress = tasks.length === 0 ? 0 : Math.round((completedCount / tasks.length) * 100);

  return (
    <div className="flex flex-col bg-card border rounded-2xl shadow-sm overflow-hidden">
      <div className="p-5 border-b bg-muted/30">
        <h3 className="font-semibold text-lg flex items-center justify-between">
          Bugünün Hedefleri
          <span className="text-sm font-normal text-muted-foreground bg-background px-2 py-0.5 rounded-full border">
            {completedCount} / {tasks.length}
          </span>
        </h3>
        
        <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-500" 
            style={{ width: `${progress}%` }} 
          />
        </div>
      </div>

      <div className="flex-1 p-5 overflow-y-auto max-h-[300px] space-y-2">
        {tasks.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            Harika! Bugün için planlanmış bir görev yok.
          </div>
        ) : (
          tasks.map(task => (
            <div 
              key={task.id} 
              className={`group flex items-center gap-3 p-3 rounded-xl border transition-all ${task.completed ? 'bg-muted/50 border-transparent' : 'bg-background hover:border-primary/30'}`}
            >
              <button
                onClick={() => toggleTask(task.id)}
                className={`w-6 h-6 shrink-0 rounded-full border-2 flex items-center justify-center transition-all ${task.completed ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/30 hover:border-primary/50'}`}
              >
                {task.completed && <Check className="w-3.5 h-3.5" />}
              </button>
              
              <span className={`flex-1 text-sm transition-all ${task.completed ? 'text-muted-foreground line-through' : 'text-foreground font-medium'}`}>
                {task.text}
              </span>
              
              <button
                onClick={() => removeTask(task.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t bg-muted/10">
        <form onSubmit={addTask} className="flex items-center gap-2">
          <input
            type="text"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Yeni görev ekle..."
            className="flex-1 h-10 px-4 text-sm rounded-xl border bg-background focus:ring-2 focus:ring-primary focus:outline-none transition-all"
          />
          <Button type="submit" size="icon" className="h-10 w-10 rounded-xl shrink-0" disabled={!newTask.trim()}>
            <Plus className="w-5 h-5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
