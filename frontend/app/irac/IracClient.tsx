"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { fetchWorker } from "@/lib/api";
import { Loader2, ArrowRight, CheckCircle2, RotateCcw } from "lucide-react";

const SAMPLE_CASES = [
  {
    id: "irac_1",
    title: "Haksız Fiilde Kusursuz Sorumluluk",
    scenario: "Ahmet'in sahibi olduğu köpek, komşusu Mehmet'in bahçesine girip çocuğunu ısırmış ve ciddi yaralanmasına sebep olmuştur. Ahmet, köpeğinin daha önce hiç kimseyi ısırmadığını ve çocuğun köpeği kışkırttığını iddia etmektedir. Mehmet, Ahmet'e karşı tazminat davası açmak istemektedir."
  },
  {
    id: "irac_2",
    title: "Sözleşmenin Geçersizliği — Gabin",
    scenario: "70 yaşındaki Fatma Hanım, ilaç parası bulamadığı bir dönemde, piyasa değeri 2.000.000 TL olan evini 200.000 TL'ye komşusu Ali'ye satmıştır. Fatma Hanım, 6 ay sonra bu satışı iptal ettirmek istemektedir."
  },
  {
    id: "irac_3",
    title: "Miras Hukukunda Saklı Pay",
    scenario: "Vefat eden Hasan Bey, tüm malvarlığını vasiyetname ile hayır kurumuna bırakmıştır. Hasan Bey'in 2 çocuğu ve eşi, mirastan hiç pay alamadıklarını öğrenince itiraz etmek istiyorlar."
  }
];

const STEPS = [
  { key: "issue", label: "Issue (Hukuki Sorun)", placeholder: "Bu olayda hukuki sorun nedir? Hangi hak ihlal edilmiştir?" },
  { key: "rule", label: "Rule (Uygulanacak Kural)", placeholder: "Bu soruna hangi kanun maddeleri uygulanır? (Örn: TBK m.49, TMK m.505)" },
  { key: "analysis", label: "Analysis (Olaya Uygulama)", placeholder: "Kanun kuralını bu olaya nasıl uygularsın? Tarafların haklılığını analiz et." },
  { key: "conclusion", label: "Conclusion (Sonuç)", placeholder: "Hukuki değerlendirmen sonucunda ne karar verirsin? Dava sonucu ne olmalı?" },
];

type GradeResult = {
  scores: { issue: number; rule: number; analysis: number; conclusion: number };
  feedback: { issue: string; rule: string; analysis: string; conclusion: string };
  overall: number;
  overallFeedback: string;
};

export default function IracClient() {
  const [selectedCase, setSelectedCase] = useState<typeof SAMPLE_CASES[0] | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({ issue: "", rule: "", analysis: "", conclusion: "" });
  const [grading, setGrading] = useState(false);
  const [result, setResult] = useState<GradeResult | null>(null);

  const handleSubmit = async () => {
    if (!selectedCase) return;
    setGrading(true);
    try {
      const res = await fetchWorker<GradeResult>("/ai/irac-grade", {
        method: "POST",
        body: JSON.stringify({ scenario: selectedCase.scenario, answers }),
      });
      setResult(res);
    } catch (e) {
      console.error(e);
      alert("Puanlama sırasında bir hata oluştu.");
    } finally {
      setGrading(false);
    }
  };

  const reset = () => {
    setSelectedCase(null);
    setCurrentStep(0);
    setAnswers({ issue: "", rule: "", analysis: "", conclusion: "" });
    setResult(null);
  };

  // Case selection
  if (!selectedCase) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Bir Olay Seç</h3>
        {SAMPLE_CASES.map((c) => (
          <Card key={c.id} className="glass border-primary/20 hover-glow cursor-pointer transition-all" onClick={() => setSelectedCase(c)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-gradient">{c.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground line-clamp-2">{c.scenario}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Results
  if (result) {
    const stepKeys = ["issue", "rule", "analysis", "conclusion"] as const;
    return (
      <div className="space-y-6">
        <div className="text-center py-6">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl font-black text-primary">{result.overall}</span>
          </div>
          <h2 className="text-2xl font-bold text-gradient">Genel Puan: {result.overall}/100</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-lg mx-auto">{result.overallFeedback}</p>
        </div>

        {stepKeys.map((key, i) => (
          <Card key={key} className={`glass border ${result.scores[key] >= 70 ? "border-green-500/30" : result.scores[key] >= 40 ? "border-yellow-500/30" : "border-red-500/30"}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-md flex items-center justify-between">
                <span>{STEPS[i].label}</span>
                <span className={`text-lg font-bold ${result.scores[key] >= 70 ? "text-green-500" : result.scores[key] >= 40 ? "text-yellow-500" : "text-red-500"}`}>
                  {result.scores[key]}/100
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="bg-muted/30 p-3 rounded-lg text-sm">
                <strong>Senin cevabın:</strong> {answers[key] || "(Boş bırakıldı)"}
              </div>
              <p className="text-sm text-muted-foreground">{result.feedback[key]}</p>
            </CardContent>
          </Card>
        ))}

        <div className="text-center">
          <Button onClick={reset} className="hover-glow">
            <RotateCcw className="w-4 h-4 mr-2" /> Yeni Olay Çöz
          </Button>
        </div>
      </div>
    );
  }

  // Wizard steps
  const step = STEPS[currentStep];
  const stepKey = step.key as keyof typeof answers;

  return (
    <div className="space-y-6">
      {/* Scenario */}
      <Card className="glass border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{selectedCase.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-foreground/90">{selectedCase.scenario}</p>
        </CardContent>
      </Card>

      {/* Progress */}
      <div className="flex gap-2">
        {STEPS.map((s, i) => (
          <div key={s.key} className={`flex-1 h-2 rounded-full transition-all ${i <= currentStep ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>

      {/* Current step */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="w-8 h-8 bg-primary/20 text-primary rounded-full flex items-center justify-center text-sm font-bold">{currentStep + 1}</span>
            {step.label}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            value={answers[stepKey]}
            onChange={(e) => setAnswers((prev) => ({ ...prev, [stepKey]: e.target.value }))}
            placeholder={step.placeholder}
            className="w-full h-40 p-4 rounded-md border bg-background text-sm resize-none"
          />
          <div className="flex justify-between">
            <Button variant="outline" disabled={currentStep === 0} onClick={() => setCurrentStep((i) => i - 1)}>
              ← Önceki Adım
            </Button>
            {currentStep < STEPS.length - 1 ? (
              <Button onClick={() => setCurrentStep((i) => i + 1)} className="hover-glow">
                Sonraki Adım <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={grading} className="hover-glow bg-green-600 hover:bg-green-700">
                {grading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Puanlanıyor...</> : <><CheckCircle2 className="w-4 h-4 mr-2" /> Yapay Zekaya Gönder</>}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
