"use client";

import { useState, useEffect } from "react";
import { Play, Pause, RotateCcw, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Mode = "pomodoro" | "shortBreak" | "longBreak";

const TIMES = {
  pomodoro: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
};

export default function PomodoroTimer() {
  const [mode, setMode] = useState<Mode>("pomodoro");
  const [timeLeft, setTimeLeft] = useState(TIMES.pomodoro);
  const [isActive, setIsActive] = useState(false);
  const [sessions, setSessions] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => time - 1);
      }, 1000);
    } else if (isActive && timeLeft === 0) {
      setIsActive(false);
      // Play a sound (if available)
      try {
        const audio = new Audio("https://cdn.freesound.org/previews/333/333629_5865529-lq.mp3");
        audio.play();
      } catch (e) {
        // ignore
      }
      
      if (mode === "pomodoro") {
        const newSessions = sessions + 1;
        setSessions(newSessions);
        if (newSessions % 4 === 0) {
          setMode("longBreak");
          setTimeLeft(TIMES.longBreak);
        } else {
          setMode("shortBreak");
          setTimeLeft(TIMES.shortBreak);
        }
      } else {
        setMode("pomodoro");
        setTimeLeft(TIMES.pomodoro);
      }
    }

    return () => clearInterval(interval);
  }, [isActive, timeLeft, mode, sessions]);

  const toggleTimer = () => setIsActive(!isActive);

  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(TIMES[mode]);
  };

  const changeMode = (newMode: Mode) => {
    setIsActive(false);
    setMode(newMode);
    setTimeLeft(TIMES[newMode]);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const progress = ((TIMES[mode] - timeLeft) / TIMES[mode]) * 100;

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-card border rounded-2xl shadow-sm relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-muted">
        <div 
          className={`h-full transition-all duration-1000 ${mode === 'pomodoro' ? 'bg-primary' : 'bg-green-500'}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex gap-2 mb-8 bg-muted/50 p-1 rounded-full">
        <button
          onClick={() => changeMode("pomodoro")}
          className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${mode === "pomodoro" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          Odak
        </button>
        <button
          onClick={() => changeMode("shortBreak")}
          className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${mode === "shortBreak" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          Kısa Mola
        </button>
        <button
          onClick={() => changeMode("longBreak")}
          className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${mode === "longBreak" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          Uzun Mola
        </button>
      </div>

      <div className="relative flex items-center justify-center w-48 h-48 mb-8">
        <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="transparent"
            stroke="currentColor"
            strokeWidth="2"
            className="text-muted/20"
          />
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="transparent"
            stroke="currentColor"
            strokeWidth="4"
            strokeDasharray="289"
            strokeDashoffset={289 - (289 * progress) / 100}
            className={`transition-all duration-1000 ${mode === "pomodoro" ? "text-primary" : "text-green-500"}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-5xl font-bold tracking-tighter tabular-nums">{formatTime(timeLeft)}</span>
          <span className="text-xs text-muted-foreground mt-2 font-medium tracking-widest uppercase">
            {mode === "pomodoro" ? "ODAKLAN" : "DİNLEN"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button
          onClick={toggleTimer}
          size="lg"
          className={`w-16 h-16 rounded-full shadow-lg transition-transform active:scale-95 ${isActive ? 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200' : 'bg-primary text-primary-foreground'}`}
        >
          {isActive ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
        </Button>
        <Button
          onClick={resetTimer}
          variant="outline"
          size="icon"
          className="w-12 h-12 rounded-full"
        >
          <RotateCcw className="w-5 h-5" />
        </Button>
      </div>

      <div className="mt-8 text-sm text-muted-foreground font-medium">
        Tamamlanan Odak: <span className="text-foreground">{sessions}</span>
      </div>
    </div>
  );
}
