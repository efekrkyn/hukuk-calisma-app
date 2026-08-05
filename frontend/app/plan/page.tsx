"use client";

import { useEffect, useState } from "react";
import { Bot, Calendar, Rocket, Target, Timer, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PlanGrid } from "@/components/PlanGrid";
import { getActivePlan } from "@/lib/plan-api";
import type { ActivePlanResponse } from "@/types/plan";

export default function PlanPage() {
  const [data, setData] = useState<ActivePlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getActivePlan()
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="p-6 text-sm text-muted-foreground flex flex-col items-center justify-center min-h-[300px] space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="font-medium">Plan yükleniyor...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="p-6 max-w-2xl mx-auto space-y-4 text-center">
        <h1 className="type-display text-red-500">
                <TriangleAlert className="w-4 h-4 shrink-0" aria-hidden />Bağlantı Hatası</h1>
        <p className="text-sm text-muted-foreground">
          Sunucuya bağlanırken bir hata oluştu: {error}
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <Button onClick={() => window.location.reload()}>Yeniden Dene</Button>
          <Link href="/">
            <Button variant="outline">Ana Sayfa</Button>
          </Link>
        </div>
      </main>
    );
  }

  if (!data?.plan) {
    return (
      <main className="p-6 max-w-2xl mx-auto space-y-6 text-center py-16">
        <div className="text-4xl sm:text-6xl"></div>
        <h1 className="text-3xl font-extrabold tracking-tight">Aktif Çalışma Planı Yok</h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Sınav dönemine kadar saat-saat çalışma takviminizi oluşturmak için ilk planınızı şimdi oluşturun.
        </p>
        <Link href="/plan/setup">
          <Button size="lg" className="px-8 py-6 font-bold shadow-md">
            İlk Çalışma Planını Oluştur
          </Button>
        </Link>
      </main>
    );
  }

  const { plan, completions } = data;
  const generatedDate = new Date(plan.generated_at).toLocaleString("tr-TR");

  return (
    <main className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-primary to-indigo-600 bg-clip-text text-transparent">
                <Calendar className="w-4 h-4 shrink-0" aria-hidden />Çalışma Planım
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Yapay zeka tarafından üretilen çalışma programınız.
          </p>
        </div>
        <Link href="/" className="text-sm font-medium text-primary hover:text-primary/80 hover:underline">
          ← Ana sayfa
        </Link>
      </div>

      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-muted/40 p-4 space-y-3">
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                <Rocket className="w-4 h-4 shrink-0" aria-hidden />Plan Özeti</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 font-medium leading-relaxed">
            {plan.ai_output.summary}
          </p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground font-medium border-t pt-2">
          <span>
                <Target className="w-4 h-4 shrink-0" aria-hidden />Hedef Dersler: {plan.form_input.courses?.length || 0} adet</span>
          <span>
                <Timer className="w-4 h-4 shrink-0" aria-hidden />Kalan Hafta: {plan.form_input.weeks_remaining}</span>
          <span>
                <Calendar className="w-4 h-4 shrink-0" aria-hidden />Oluşturuldu: {generatedDate}</span>
          <span>
                <Bot className="w-4 h-4 shrink-0" aria-hidden />Model: {plan.ai_model}</span>
        </div>
        <div className="flex gap-2 pt-1 border-t">
          <Link href="/plan/setup">
            <Button size="sm" variant="outline" className="font-semibold">
              Yeni Plan Oluştur
            </Button>
          </Link>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              window.location.href = "/plan/setup";
            }}
            className="font-semibold text-primary hover:text-primary/80"
          >
            Yenile
          </Button>
        </div>
      </div>

      <PlanGrid weeks={plan.ai_output.weeks} completions={completions} />
    </main>
  );
}
