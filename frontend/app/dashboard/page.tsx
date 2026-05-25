"use client";

import Link from "next/link";
import { ArrowLeft, LayoutDashboard } from "lucide-react";
import PomodoroTimer from "@/components/PomodoroTimer";
import DailyTasks from "@/components/DailyTasks";
import ExamCountdown from "@/components/ExamCountdown";

export default function DashboardPage() {
  return (
    <main className="min-h-screen p-6 md:p-12 lg:p-24 bg-background">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <Link 
              href="/" 
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Ana Sayfaya Dön
            </Link>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <LayoutDashboard className="w-8 h-8 text-primary" />
              Çalışma Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Sınavlara hazırlık sürecini planla ve Pomodoro ile odaklan.
            </p>
          </div>
        </div>

        {/* Top: Countdowns */}
        <ExamCountdown />

        {/* Bottom: Pomodoro & Tasks Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5 w-full">
            <PomodoroTimer />
          </div>
          
          <div className="lg:col-span-7 w-full h-full min-h-[400px]">
            <DailyTasks />
          </div>
        </div>
      </div>
    </main>
  );
}
