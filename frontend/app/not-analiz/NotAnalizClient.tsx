"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Loader2, FileSearch, CheckCircle2, XCircle } from "lucide-react";
import { fetchWorker, DynamicQuizQuestion } from "@/lib/api";

export default function NotAnalizClient() {
  const [notesText, setNotesText] = useState("");
  const [count, setCount] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<DynamicQuizQuestion[] | null>(null);

  // Quiz state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);

  const handleAnalyze = async () => {
    if (notesText.trim().length < 50) {
      alert("Lütfen en az 50 karakter uzunluğunda bir ders notu yapıştırın.");
      return;
    }
    setIsGenerating(true);
    setError(null);
    setQuestions(null);
    setCurrentIndex(0);
    setSelectedOpt(null);
    setShowResult(false);
    setScore(0);

    try {
      const result = await fetchWorker<DynamicQuizQuestion[]>("/ai/analyze-notes", {
        method: "POST",
        body: JSON.stringify({ notesText, count }),
      });
      if (Array.isArray(result) && result.length > 0) {
        setQuestions(result);
      } else {
        setError("Notlardan soru üretilemedi, lütfen daha detaylı bir not yapıştırın.");
      }
    } catch (e) {
      console.error(e);
      setError("Sunucu hatası oluştu. Lütfen tekrar deneyin.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelect = (idx: number) => {
    if (showResult || !questions) return;
    setSelectedOpt(idx);
    setShowResult(true);
    if (idx === questions[currentIndex].correctAnswer) setScore((s) => s + 1);
  };

  const handleNext = () => {
    setShowResult(false);
    setSelectedOpt(null);
    setCurrentIndex((i) => i + 1);
  };

  // Quiz UI
  if (questions) {
    const isFinished = currentIndex >= questions.length;
    if (isFinished) {
      return (
        <Card className="glass border-primary/20 text-center py-12">
          <CardContent className="space-y-4">
            <h2 className="text-2xl font-bold text-gradient">Not Testi Bitti!</h2>
            <div className="text-5xl font-black">{score} / {questions.length}</div>
            <p className="text-muted-foreground text-sm">Notlarından üretilen sorularda başarın bu kadar.</p>
            <Button onClick={() => setQuestions(null)} className="mt-4 hover-glow">Yeni Not Analiz Et</Button>
          </CardContent>
        </Card>
      );
    }
    const q = questions[currentIndex];
    return (
      <Card className="glass border-primary/20 animate-in fade-in">
        <CardHeader className="border-b border-border/10 bg-primary/5">
          <div className="flex justify-between text-sm font-medium text-muted-foreground">
            <span>Soru {currentIndex + 1} / {questions.length}</span>
            <span className="text-primary">Not Analizi</span>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <h3 className="text-lg font-semibold leading-relaxed">{q.question}</h3>
          <div className="space-y-3">
            {q.options.map((opt, idx) => {
              const isSelected = selectedOpt === idx;
              const isCorrect = idx === q.correctAnswer;
              let cls = "w-full justify-start text-left h-auto py-3 px-4 border transition-all";
              if (showResult) {
                if (isCorrect) cls += " border-green-500 bg-green-500/10 text-green-700 dark:text-green-400";
                else if (isSelected) cls += " border-red-500 bg-red-500/10 text-red-700 dark:text-red-400";
                else cls += " opacity-50";
              } else if (isSelected) cls += " border-primary bg-primary/10 text-primary";
              else cls += " hover:bg-muted";
              return (
                <Button key={idx} variant="outline" className={cls} onClick={() => handleSelect(idx)}>
                  <div className="flex items-start gap-3 w-full">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-background border flex items-center justify-center text-xs">{String.fromCharCode(65 + idx)}</span>
                    <span className="flex-1 whitespace-normal break-words text-sm">{opt}</span>
                    {showResult && isCorrect && <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />}
                    {showResult && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-red-500 shrink-0" />}
                  </div>
                </Button>
              );
            })}
          </div>
          {showResult && (
            <div className="p-4 rounded-xl bg-muted/30 border border-border/50 animate-in slide-in-from-bottom-2">
              <h4 className="font-semibold text-primary mb-2">Açıklama</h4>
              <p className="text-sm text-muted-foreground">{q.explanation}</p>
              <div className="mt-4 flex justify-end">
                <Button onClick={handleNext} className="hover-glow">Sıradaki Soru</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Input UI
  return (
    <Card className="glass border-primary/20 max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSearch className="w-5 h-5 text-primary" /> Ders Notunu Yapıştır
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">{error}</div>}
        <textarea
          value={notesText}
          onChange={(e) => setNotesText(e.target.value)}
          placeholder="Hocanın ders slaytını, notlarını veya kitaptan bir bölümü buraya yapıştır. Yapay zeka bu metni okuyup sana özel sınav soruları yazacak..."
          className="w-full h-64 p-4 rounded-md border bg-background text-sm resize-none font-mono"
          disabled={isGenerating}
        />
        <div className="flex items-center gap-4">
          <div className="space-y-1 flex-1">
            <label className="text-sm font-medium">Soru Sayısı</label>
            <select value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-full p-2 border rounded-md bg-background text-sm">
              <option value={3}>3 Soru</option>
              <option value={5}>5 Soru</option>
              <option value={10}>10 Soru</option>
            </select>
          </div>
          <div className="flex-1 pt-5">
            <Button className="w-full hover-glow" size="lg" onClick={handleAnalyze} disabled={isGenerating || notesText.trim().length < 50}>
              {isGenerating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analiz Ediliyor...</> : "Notu Analiz Et ve Soru Üret"}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground text-center">Minimum 50 karakter gerekir. Not ne kadar detaylıysa sorular o kadar kaliteli olur.</p>
      </CardContent>
    </Card>
  );
}
