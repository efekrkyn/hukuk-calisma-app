"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2, Trophy, ArrowRight } from "lucide-react";
import { courseById } from "@/lib/courses";

type QuizQuestion = {
  id: string;
  course: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
};

export default function HmgsClient() {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    fetch("/api/hmgs")
      .then((res) => {
        if (!res.ok) throw new Error("Sınav soruları yüklenemedi.");
        return res.json();
      })
      .then((data) => {
        setQuestions(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground animate-pulse">HMGS Simülasyonu Hazırlanıyor...</p>
      </div>
    );
  }

  if (error || questions.length === 0) {
    return (
      <div className="text-center py-10 text-destructive">
        {error || "Yeterli soru bulunamadı."}
      </div>
    );
  }

  const isFinished = currentIndex >= questions.length;

  if (isFinished) {
    const percentage = Math.round((score / questions.length) * 100);
    return (
      <div className="text-center py-12 space-y-6">
        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <Trophy className="w-12 h-12 text-primary" />
        </div>
        <h2 className="text-3xl font-bold text-gradient">Sınav Tamamlandı!</h2>
        <div className="text-6xl font-black text-foreground">{score} <span className="text-2xl text-muted-foreground">/ {questions.length}</span></div>
        <p className="text-lg text-muted-foreground">Başarı Oranı: %{percentage}</p>
        <Button onClick={() => window.location.reload()} size="lg" className="mt-4 hover-glow">
          Yeni Bir Simülasyon Başlat
        </Button>
      </div>
    );
  }

  const q = questions[currentIndex];
  const courseName = courseById(q.course)?.name || q.course;

  const handleSelect = (idx: number) => {
    if (showResult) return;
    setSelectedOpt(idx);
    setShowResult(true);
    if (idx === q.correctAnswer) {
      setScore((s) => s + 1);
    }
  };

  const handleNext = () => {
    setShowResult(false);
    setSelectedOpt(null);
    setCurrentIndex((i) => i + 1);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between text-sm font-medium text-muted-foreground border-b border-border/20 pb-4">
        <span>Soru {currentIndex + 1} / {questions.length}</span>
        <span className="px-3 py-1 bg-primary/10 text-primary rounded-full">{courseName}</span>
      </div>

      <h3 className="text-xl font-semibold leading-relaxed text-foreground/90">
        {q.question}
      </h3>

      <div className="space-y-3 mt-6">
        {q.options.map((opt, idx) => {
          const isSelected = selectedOpt === idx;
          const isCorrect = idx === q.correctAnswer;
          
          let btnClass = "w-full justify-start text-left h-auto py-4 px-5 border transition-all hover:bg-muted";
          
          if (showResult) {
            if (isCorrect) {
              btnClass = "w-full justify-start text-left h-auto py-4 px-5 border-green-500 bg-green-500/10 text-green-700 dark:text-green-400";
            } else if (isSelected) {
              btnClass = "w-full justify-start text-left h-auto py-4 px-5 border-red-500 bg-red-500/10 text-red-700 dark:text-red-400";
            }
          } else if (isSelected) {
            btnClass = "w-full justify-start text-left h-auto py-4 px-5 border-primary bg-primary/10 text-primary";
          }

          return (
            <Button
              key={idx}
              variant="outline"
              className={btnClass}
              onClick={() => handleSelect(idx)}
            >
              <div className="flex items-start gap-3 w-full">
                <span className="shrink-0 w-6 h-6 rounded-full bg-background border flex items-center justify-center text-xs">
                  {String.fromCharCode(65 + idx)}
                </span>
                <span className="flex-1 whitespace-normal break-words">{opt}</span>
                {showResult && isCorrect && <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />}
                {showResult && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-red-500 shrink-0" />}
              </div>
            </Button>
          );
        })}
      </div>

      {showResult && (
        <div className="mt-6 p-4 rounded-xl bg-muted/30 border border-border/50 animate-in slide-in-from-bottom-2">
          <h4 className="font-semibold text-primary mb-2 flex items-center gap-2">
            💡 Çözüm ve Açıklama
          </h4>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {q.explanation}
          </p>
          <div className="mt-4 flex justify-end">
            <Button onClick={handleNext} className="gap-2 hover-glow">
              Sıradaki Soru <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
