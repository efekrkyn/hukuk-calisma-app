"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Loader2, PlusCircle, CheckCircle2, XCircle } from "lucide-react";
import { generateDynamicQuiz, DynamicQuizQuestion } from "@/lib/api";
import { COURSES } from "@/lib/courses";

export default function DinamikTestClient() {
  const [course, setCourse] = useState(COURSES[0].id);
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("Orta");
  const [count, setCount] = useState(5);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [questions, setQuestions] = useState<DynamicQuizQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Quiz state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      alert("Lütfen bir konu girin (Örn: Haksız Fiil Unsurları)");
      return;
    }
    
    setIsGenerating(true);
    setError(null);
    setQuestions(null);
    setCurrentIndex(0);
    setSelectedOpt(null);
    setShowResult(false);
    setScore(0);

    const courseName = COURSES.find(c => c.id === course)?.name || course;

    // Oturum kontrolü Next.js proxy tarafından yapılmaktadır.

    try {
      const result = await generateDynamicQuiz({
        course: courseName,
        topic,
        difficulty,
        count
      });
      if (Array.isArray(result) && result.length > 0) {
        setQuestions(result);
      } else {
        setError("Yapay zeka geçerli soru üretemedi, lütfen tekrar deneyin.");
      }
    } catch (e: any) {
      console.error(e);
      // Auth hatası kontrolü
      if (e?.message?.includes("401") || e?.message?.includes("Authorization") || e?.message?.includes("unauthorized") || e?.message?.includes("required")) {
        setError("Oturumunuzun süresi dolmuş. Yeniden giriş yapılıyor...");
        setTimeout(() => { window.location.href = "/login"; }, 1500);
      } else {
        setError(`Sorular üretilirken hata oluştu: ${e?.message || "Bilinmeyen hata"}. Lütfen tekrar deneyin.`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelect = (idx: number) => {
    if (showResult || !questions) return;
    const q = questions[currentIndex];
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

  if (questions) {
    const isFinished = currentIndex >= questions.length;
    if (isFinished) {
      return (
        <Card className="glass border-primary/20 text-center py-12">
          <CardContent className="space-y-4">
            <h2 className="text-2xl font-bold text-gradient">Test Bitti!</h2>
            <div className="text-5xl font-black">{score} / {questions.length}</div>
            <Button onClick={() => setQuestions(null)} className="mt-4 hover-glow">Yeni Test Üret</Button>
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
            <span className="text-primary">{topic}</span>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <h3 className="text-lg font-semibold leading-relaxed text-foreground/90">
            {q.question}
          </h3>

          <div className="space-y-3">
            {q.options.map((opt, idx) => {
              const isSelected = selectedOpt === idx;
              const isCorrect = idx === q.correctAnswer;
              
              let btnClass = "w-full justify-start text-left h-auto py-3 px-4 border transition-all";
              
              if (showResult) {
                if (isCorrect) {
                  btnClass += " border-green-500 bg-green-500/10 text-green-700 dark:text-green-400";
                } else if (isSelected) {
                  btnClass += " border-red-500 bg-red-500/10 text-red-700 dark:text-red-400";
                } else {
                  btnClass += " opacity-50";
                }
              } else if (isSelected) {
                btnClass += " border-primary bg-primary/10 text-primary";
              } else {
                btnClass += " hover:bg-muted";
              }

              return (
                <Button key={idx} variant="outline" className={btnClass} onClick={() => handleSelect(idx)}>
                  <div className="flex items-start gap-3 w-full">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-background border flex items-center justify-center text-xs">
                      {String.fromCharCode(65 + idx)}
                    </span>
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
              <h4 className="font-semibold text-primary mb-2">Çözüm ve Açıklama</h4>
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

  return (
    <Card className="glass border-primary/20 max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Sınav Parametrelerini Belirle</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">{error}</div>}
        
        <div className="space-y-2">
          <label className="text-sm font-medium">Ders</label>
          <select value={course} onChange={e => setCourse(e.target.value)} className="w-full p-2 border rounded-md bg-background text-sm">
            {COURSES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Spesifik Konu <span className="text-destructive">*</span></label>
          <input 
            type="text" 
            value={topic} 
            onChange={e => setTopic(e.target.value)} 
            placeholder="Örn: Haksız Fiilde Kusur Sorumluluğu" 
            className="w-full p-2 border rounded-md bg-background text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Zorluk</label>
            <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className="w-full p-2 border rounded-md bg-background text-sm">
              <option value="Kolay">Kolay</option>
              <option value="Orta">Orta (Vize seviyesi)</option>
              <option value="Zor">Zor (Final / HMGS seviyesi)</option>
              <option value="Çok Zor">Çok Zor (Hakimlik seviyesi)</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Soru Sayısı</label>
            <select value={count} onChange={e => setCount(Number(e.target.value))} className="w-full p-2 border rounded-md bg-background text-sm">
              <option value={3}>3 Soru (Hızlı Tekrar)</option>
              <option value={5}>5 Soru (Normal)</option>
              <option value={10}>10 Soru (Deneme)</option>
            </select>
          </div>
        </div>

        <Button 
          className="w-full mt-4 hover-glow" 
          size="lg" 
          onClick={handleGenerate} 
          disabled={isGenerating || !topic.trim()}
        >
          {isGenerating ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Yapay Zeka Soruları Yazıyor...</>
          ) : (
            <><PlusCircle className="w-4 h-4 mr-2" /> Testi Üret ve Başla</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
