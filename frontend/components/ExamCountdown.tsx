"use client";

import { useEffect, useState } from "react";
import { Calendar, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

// Hedef Tarihler
const FINALS_DATE = new Date("2026-06-30T00:00:00").getTime();
const HMGS_DATE = new Date("2026-09-27T00:00:00").getTime();

export default function ExamCountdown() {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getRemaining = (target: number) => {
    const diff = target - now;
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0 };
    
    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((diff / 1000 / 60) % 60),
    };
  };

  const finals = getRemaining(FINALS_DATE);
  const hmgs = getRemaining(HMGS_DATE);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Finaller */}
      <Card className="border-red-500/20 shadow-sm relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent z-0" />
        <CardContent className="p-6 relative z-10">
          <div className="flex items-center gap-2 text-red-500 font-semibold mb-4">
            <AlertCircle className="w-5 h-5" />
            Finaller (30 Haziran 2026)
          </div>
          
          <div className="flex items-baseline gap-4">
            <div className="flex flex-col items-center">
              <span className="text-4xl font-bold tracking-tighter tabular-nums">{finals.days}</span>
              <span className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Gün</span>
            </div>
            <span className="text-2xl text-muted-foreground/30 font-light">:</span>
            <div className="flex flex-col items-center">
              <span className="text-4xl font-bold tracking-tighter tabular-nums">{finals.hours.toString().padStart(2, '0')}</span>
              <span className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Saat</span>
            </div>
            <span className="text-2xl text-muted-foreground/30 font-light">:</span>
            <div className="flex flex-col items-center">
              <span className="text-4xl font-bold tracking-tighter tabular-nums text-muted-foreground">{finals.minutes.toString().padStart(2, '0')}</span>
              <span className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Dk</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* HMGS */}
      <Card className="border-blue-500/20 shadow-sm relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent z-0" />
        <CardContent className="p-6 relative z-10">
          <div className="flex items-center gap-2 text-blue-500 font-semibold mb-4">
            <Calendar className="w-5 h-5" />
            HMGS (27 Eylül 2026)
          </div>
          
          <div className="flex items-baseline gap-4">
            <div className="flex flex-col items-center">
              <span className="text-4xl font-bold tracking-tighter tabular-nums">{hmgs.days}</span>
              <span className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Gün</span>
            </div>
            <span className="text-2xl text-muted-foreground/30 font-light">:</span>
            <div className="flex flex-col items-center">
              <span className="text-4xl font-bold tracking-tighter tabular-nums">{hmgs.hours.toString().padStart(2, '0')}</span>
              <span className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Saat</span>
            </div>
            <span className="text-2xl text-muted-foreground/30 font-light">:</span>
            <div className="flex flex-col items-center">
              <span className="text-4xl font-bold tracking-tighter tabular-nums text-muted-foreground">{hmgs.minutes.toString().padStart(2, '0')}</span>
              <span className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Dk</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
