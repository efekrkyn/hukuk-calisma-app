"use client";

import { useState } from "react";
import { QuizQuestion } from "@/lib/quiz";
import { submitQuizAttempt } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, XCircle, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

export default function QuizClient({
  courseId,
  questions,
}: {
  courseId: string;
  questions: QuizQuestion[];
}) {
  const router = useRouter();
  
  // We can randomize questions for the session
  const [shuffledQuestions] = useState(() => 
    [...questions].sort(() => Math.random() - 0.5)
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sessionScore, setSessionScore] = useState(0);

  const currentQuestion = shuffledQuestions[currentIndex];

  const handleOptionSelect = (index: number) => {
    if (isSubmitted) return;
    setSelectedOption(index);
  };

  const handleSubmit = async () => {
    if (selectedOption === null || isSubmitted || submitting || !currentQuestion) return;
    setSubmitting(true);

    const isCorrect = selectedOption === currentQuestion.correct_index;
    
    try {
      await submitQuizAttempt({
        course: courseId,
        topic: currentQuestion.topic,
        question_id: currentQuestion.id,
        selected_answer: selectedOption,
        is_correct: isCorrect ? 1 : 0
      });
      
      if (isCorrect) {
        setSessionScore(prev => prev + 1);
      }
      setIsSubmitted(true);
    } catch (error) {
      console.error("Failed to submit attempt:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    setSelectedOption(null);
    setIsSubmitted(false);
    setCurrentIndex(prev => prev + 1);
  };

  if (currentIndex >= shuffledQuestions.length) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center">
        <div className="mb-6 rounded-full bg-primary/20 p-6">
          <CheckCircle2 className="h-16 w-16 text-primary" />
        </div>
        <h2 className="mb-2 text-3xl font-bold">Test Tamamlandı!</h2>
        <p className="mb-8 text-lg text-muted-foreground max-w-md">
          Toplam {shuffledQuestions.length} sorudan {sessionScore} tanesini doğru yanıtladın.
        </p>
        <div className="flex gap-4">
          <Button variant="outline" size="lg" onClick={() => router.push("/quiz")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Derslere Dön
          </Button>
          <Button size="lg" onClick={() => window.location.reload()}>
            Tekrar Çöz
          </Button>
        </div>
      </div>
    );
  }

  const progress = ((currentIndex) / shuffledQuestions.length) * 100;

  return (
    <div className="flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push("/quiz")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Geri
        </Button>
        <div className="text-sm font-medium text-muted-foreground">
          Soru: {currentIndex + 1} / {shuffledQuestions.length}
        </div>
      </div>

      <div className="mb-8 h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div 
          className="h-full bg-primary transition-all duration-300 ease-in-out" 
          style={{ width: `${progress}%` }}
        />
      </div>

      <Card className="w-full shadow-lg border-primary/10">
        <CardHeader className="pb-4">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            {currentQuestion.topic}
          </div>
          <CardTitle className="text-xl leading-relaxed">
            {currentQuestion.question}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 mt-4">
            {currentQuestion.options.map((option, idx) => {
              const isSelected = selectedOption === idx;
              const isCorrectOpt = currentQuestion.correct_index === idx;
              
              let buttonStyle = "justify-start h-auto p-4 text-left font-normal border-2 hover:bg-muted/50 transition-all";
              let icon = null;

              if (isSubmitted) {
                if (isCorrectOpt) {
                  buttonStyle += " border-green-500 bg-green-500/10 hover:bg-green-500/10 text-green-700 dark:text-green-400";
                  icon = <CheckCircle2 className="h-5 w-5 ml-auto text-green-500 shrink-0" />;
                } else if (isSelected && !isCorrectOpt) {
                  buttonStyle += " border-red-500 bg-red-500/10 hover:bg-red-500/10 text-red-700 dark:text-red-400";
                  icon = <XCircle className="h-5 w-5 ml-auto text-red-500 shrink-0" />;
                } else {
                  buttonStyle += " border-transparent opacity-50";
                }
              } else {
                if (isSelected) {
                  buttonStyle += " border-primary bg-primary/5";
                } else {
                  buttonStyle += " border-transparent bg-secondary hover:border-primary/30";
                }
              }

              const letters = ["A", "B", "C", "D", "E"];
              return (
                <Button 
                  key={idx} 
                  variant="outline" 
                  className={buttonStyle}
                  onClick={() => handleOptionSelect(idx)}
                  disabled={isSubmitted || submitting}
                >
                  <span className="mr-3 font-semibold text-muted-foreground shrink-0">{letters[idx]})</span>
                  <span className="flex-1 whitespace-normal break-words">{option}</span>
                  {icon}
                </Button>
              );
            })}
          </div>

          {!isSubmitted ? (
            <div className="mt-8 flex justify-end">
              <Button 
                size="lg" 
                onClick={handleSubmit} 
                disabled={selectedOption === null || submitting}
                className="w-full sm:w-auto"
              >
                Cevapla
              </Button>
            </div>
          ) : (
            <div className="mt-8 space-y-6 animate-in slide-in-from-bottom-2 fade-in duration-300">
              <div className={`p-4 rounded-lg border-l-4 ${selectedOption === currentQuestion.correct_index ? "bg-green-500/10 border-green-500" : "bg-red-500/10 border-red-500"}`}>
                <h4 className={`font-semibold mb-2 ${selectedOption === currentQuestion.correct_index ? "text-green-600" : "text-red-600"}`}>
                  {selectedOption === currentQuestion.correct_index ? "Tebrikler, Doğru Yanıt!" : "Maalesef Yanlış."}
                </h4>
                <p className="text-sm leading-relaxed text-foreground/90">
                  {currentQuestion.explanation}
                </p>
              </div>
              <div className="flex justify-end">
                <Button size="lg" onClick={handleNext} className="w-full sm:w-auto gap-2">
                  Sonraki Soru <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
