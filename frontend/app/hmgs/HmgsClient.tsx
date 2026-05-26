"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2, Trophy, Clock, Star, Flag } from "lucide-react";
import { courseById } from "@/lib/courses";

type QuizQuestion = {
  id: string;
  course: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
};

type Answer = {
  selected: number | null;
  flagged: boolean;
};

const EXAM_DURATION_SECONDS = 40 * 60; // 40 dakika (20 soru için orantılı)

export default function HmgsClient() {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Exam state
  const [started, setStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [timeLeft, setTimeLeft] = useState(EXAM_DURATION_SECONDS);
  const [finished, setFinished] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/hmgs")
      .then((res) => {
        if (!res.ok) throw new Error("Sınav soruları yüklenemedi.");
        return res.json();
      })
      .then((data) => {
        setQuestions(data);
        setAnswers(data.map(() => ({ selected: null, flagged: false })));
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Timer
  useEffect(() => {
    if (!started || finished) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setFinished(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [started, finished]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const handleSelect = (idx: number) => {
    if (finished) return;
    setAnswers((prev) => {
      const next = [...prev];
      next[currentIndex] = { ...next[currentIndex], selected: idx };
      return next;
    });
  };

  const toggleFlag = () => {
    setAnswers((prev) => {
      const next = [...prev];
      next[currentIndex] = { ...next[currentIndex], flagged: !next[currentIndex].flagged };
      return next;
    });
  };

  const handleFinish = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setFinished(true);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground animate-pulse">HMGS Simülasyonu Hazırlanıyor...</p>
      </div>
    );
  }

  if (error || questions.length === 0) {
    return <div className="text-center py-10 text-destructive">{error || "Yeterli soru bulunamadı."}</div>;
  }

  // Start screen
  if (!started) {
    return (
      <div className="text-center py-12 space-y-6">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
          <Clock className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-gradient">HMGS Zamanlı Deneme Sınavı</h2>
        <div className="max-w-md mx-auto text-sm text-muted-foreground space-y-2">
          <p>📝 <strong>{questions.length} Soru</strong> — Tüm derslerden karışık</p>
          <p>⏱️ <strong>{Math.floor(EXAM_DURATION_SECONDS / 60)} Dakika</strong> — Süre dolunca sınav otomatik biter</p>
          <p>⭐ Soruları <strong>işaretleyip</strong> sonra geri dönebilirsin</p>
          <p>🔢 Soru numaralarına tıklayarak istediğin soruya atlayabilirsin</p>
        </div>
        <Button size="lg" className="hover-glow mt-4" onClick={() => setStarted(true)}>
          🚀 Sınava Başla
        </Button>
      </div>
    );
  }

  // Results screen
  if (finished && !showReview) {
    const correct = questions.filter((q, i) => answers[i].selected === q.correctAnswer).length;
    const wrong = questions.filter((q, i) => answers[i].selected !== null && answers[i].selected !== q.correctAnswer).length;
    const blank = questions.filter((_, i) => answers[i].selected === null).length;
    const net = correct - wrong * 0.25;

    return (
      <div className="text-center py-8 space-y-6">
        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
          <Trophy className="w-12 h-12 text-primary" />
        </div>
        <h2 className="text-3xl font-bold text-gradient">Sınav Tamamlandı!</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-lg mx-auto">
          <div className="glass rounded-xl p-4">
            <div className="text-3xl font-black text-green-500">{correct}</div>
            <div className="text-xs text-muted-foreground">Doğru</div>
          </div>
          <div className="glass rounded-xl p-4">
            <div className="text-3xl font-black text-red-500">{wrong}</div>
            <div className="text-xs text-muted-foreground">Yanlış</div>
          </div>
          <div className="glass rounded-xl p-4">
            <div className="text-3xl font-black text-yellow-500">{blank}</div>
            <div className="text-xs text-muted-foreground">Boş</div>
          </div>
          <div className="glass rounded-xl p-4 border-primary/30">
            <div className="text-3xl font-black text-primary">{net.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">Net</div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Süre: {formatTime(EXAM_DURATION_SECONDS - timeLeft)} kullanıldı
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => setShowReview(true)}>
            📋 Cevap Anahtarını Gör
          </Button>
          <Button onClick={() => window.location.reload()} className="hover-glow">
            🔄 Yeni Deneme
          </Button>
        </div>
      </div>
    );
  }

  // Review screen
  if (finished && showReview) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gradient">Cevap Anahtarı</h3>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Yeni Deneme</Button>
        </div>
        {questions.map((q, i) => {
          const ans = answers[i];
          const isCorrect = ans.selected === q.correctAnswer;
          return (
            <Card key={i} className={`glass border ${isCorrect ? "border-green-500/30" : ans.selected === null ? "border-yellow-500/30" : "border-red-500/30"}`}>
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium"><strong>S{i + 1}:</strong> {q.question}</p>
                  {isCorrect ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" /> : ans.selected === null ? <span className="text-yellow-500 text-xs">Boş</span> : <XCircle className="w-5 h-5 text-red-500 shrink-0" />}
                </div>
                {ans.selected !== null && ans.selected !== q.correctAnswer && (
                  <p className="text-xs text-red-500">Senin cevabın: {String.fromCharCode(65 + ans.selected)} — {q.options[ans.selected]}</p>
                )}
                <p className="text-xs text-green-600">Doğru cevap: {String.fromCharCode(65 + q.correctAnswer)} — {q.options[q.correctAnswer]}</p>
                <p className="text-xs text-muted-foreground">{q.explanation}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  // Exam UI
  const q = questions[currentIndex];
  const ans = answers[currentIndex];
  const courseName = courseById(q.course)?.name || q.course;
  const answeredCount = answers.filter((a) => a.selected !== null).length;

  return (
    <div className="space-y-4">
      {/* Top bar: timer + progress */}
      <div className="flex items-center justify-between bg-muted/30 rounded-xl p-3 border border-border/20">
        <div className="flex items-center gap-2">
          <Clock className={`w-5 h-5 ${timeLeft < 300 ? "text-red-500 animate-pulse" : "text-primary"}`} />
          <span className={`font-mono text-lg font-bold ${timeLeft < 300 ? "text-red-500" : ""}`}>
            {formatTime(timeLeft)}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">{answeredCount}/{questions.length} cevaplandı</span>
        <Button variant="destructive" size="sm" onClick={handleFinish}>
          <Flag className="w-4 h-4 mr-1" /> Sınavı Bitir
        </Button>
      </div>

      {/* Question navigation */}
      <div className="flex flex-wrap gap-1.5">
        {questions.map((_, i) => {
          const a = answers[i];
          let cls = "w-8 h-8 text-xs rounded-lg border transition-all ";
          if (i === currentIndex) cls += "ring-2 ring-primary ";
          if (a.selected !== null) cls += "bg-primary/20 border-primary/50 text-primary ";
          else cls += "bg-background ";
          if (a.flagged) cls += "ring-2 ring-yellow-500 ";
          return (
            <button key={i} className={cls} onClick={() => setCurrentIndex(i)}>
              {a.flagged ? "⭐" : i + 1}
            </button>
          );
        })}
      </div>

      {/* Question */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Soru {currentIndex + 1} / {questions.length}</span>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs">{courseName}</span>
          <button onClick={toggleFlag} className={`p-1 rounded ${ans.flagged ? "text-yellow-500" : "text-muted-foreground/50 hover:text-yellow-500"}`}>
            <Star className="w-4 h-4" fill={ans.flagged ? "currentColor" : "none"} />
          </button>
        </div>
      </div>

      <h3 className="text-lg font-semibold leading-relaxed">{q.question}</h3>

      <div className="space-y-2">
        {q.options.map((opt, idx) => {
          const isSelected = ans.selected === idx;
          let cls = "w-full justify-start text-left h-auto py-3 px-4 border transition-all ";
          if (isSelected) cls += "border-primary bg-primary/10 text-primary";
          else cls += "hover:bg-muted";
          return (
            <Button key={idx} variant="outline" className={cls} onClick={() => handleSelect(idx)}>
              <div className="flex items-start gap-3 w-full">
                <span className="shrink-0 w-6 h-6 rounded-full bg-background border flex items-center justify-center text-xs">
                  {String.fromCharCode(65 + idx)}
                </span>
                <span className="flex-1 whitespace-normal break-words text-sm">{opt}</span>
              </div>
            </Button>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <Button variant="outline" disabled={currentIndex === 0} onClick={() => setCurrentIndex((i) => i - 1)}>
          ← Önceki
        </Button>
        <Button disabled={currentIndex === questions.length - 1} onClick={() => setCurrentIndex((i) => i + 1)} className="hover-glow">
          Sonraki →
        </Button>
      </div>
    </div>
  );
}
