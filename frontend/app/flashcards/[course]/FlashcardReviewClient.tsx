"use client";

import { useState, useEffect, useMemo } from "react";
import { Flashcard } from "@/lib/flashcards";
import { getFlashcardState, submitFlashcardReview, FlashcardState } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function FlashcardReviewClient({
  courseId,
  flashcards,
}: {
  courseId: string;
  flashcards: Flashcard[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [states, setStates] = useState<Record<string, FlashcardState>>({});
  const [dueCards, setDueCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const res = await getFlashcardState(courseId);
        const stateMap: Record<string, FlashcardState> = {};
        res.state.forEach((s) => {
          stateMap[s.card_id] = s;
        });
        setStates(stateMap);

        const now = Date.now();
        // A card is due if it has no state (never seen) or its next_review is past
        const due = flashcards.filter(
          (c) => !stateMap[c.id] || stateMap[c.id].next_review <= now
        );
        
        // Shuffle due cards
        const shuffled = [...due].sort(() => Math.random() - 0.5);
        setDueCards(shuffled);
      } catch (e) {
        console.error("Failed to fetch state:", e);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [courseId, flashcards]);

  const currentCard = dueCards[currentIndex];

  const handleReview = async (grade: number) => {
    if (!currentCard || submitting) return;
    setSubmitting(true);

    try {
      const res = await submitFlashcardReview({
        card_id: currentCard.id,
        course: courseId,
        grade,
      });

      if (res.success) {
        // Optimistic update of local states if needed, but we're moving to next card anyway
        setStates(prev => ({...prev, [currentCard.id]: res.newState}));
      }
    } catch (e) {
      console.error("Failed to submit review:", e);
    } finally {
      setSubmitting(false);
      setIsFlipped(false);
      setCurrentIndex((prev) => prev + 1);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Kartlar hazırlanıyor...</p>
      </div>
    );
  }

  if (dueCards.length === 0 || currentIndex >= dueCards.length) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center">
        <div className="mb-6 rounded-full bg-green-500/20 p-6">
          <CheckCircle2 className="h-16 w-16 text-green-500" />
        </div>
        <h2 className="mb-2 text-2xl font-bold">Bugünlük bu kadar!</h2>
        <p className="mb-8 text-muted-foreground max-w-sm">
          Bu ders için tekrar etmen gereken tüm kartları bitirdin. 
          Öğrenmenin kalıcı olması için yarın tekrar gelmeyi unutma.
        </p>
        <Button variant="outline" size="lg" onClick={() => router.push("/flashcards")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Ders Seçimine Dön
        </Button>
      </div>
    );
  }

  const progress = ((currentIndex) / dueCards.length) * 100;

  return (
    <div className="flex flex-col">
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push("/flashcards")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Geri
        </Button>
        <div className="text-sm font-medium text-muted-foreground">
          {currentIndex + 1} / {dueCards.length}
        </div>
      </div>

      <div className="mb-8 h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div 
          className="h-full bg-primary transition-all duration-300 ease-in-out" 
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="perspective-1000 relative mx-auto w-full max-w-lg">
        <div 
          className={`relative w-full transition-transform duration-500 ${isFlipped ? "[transform:rotateY(180deg)]" : ""}`}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Front */}
          <Card 
            className={`min-h-[300px] w-full cursor-pointer flex items-center justify-center p-8 text-center shadow-lg transition-opacity ${isFlipped ? "opacity-0 pointer-events-none" : "opacity-100 z-10"}`}
            onClick={() => !isFlipped && setIsFlipped(true)}
            style={{ backfaceVisibility: 'hidden' }}
          >
            <h3 className="text-xl font-medium leading-relaxed">
              {currentCard.front}
            </h3>
            <div className="absolute bottom-4 text-xs text-muted-foreground animate-pulse">
              Cevabı görmek için dokun
            </div>
          </Card>

          {/* Back */}
          <Card 
            className={`absolute inset-0 min-h-[300px] w-full flex flex-col items-center justify-center p-8 text-center shadow-lg transition-opacity ${!isFlipped ? "opacity-0 pointer-events-none" : "opacity-100 z-20"} bg-card border-primary/20`}
            style={{ 
              backfaceVisibility: 'hidden', 
              transform: 'rotateY(180deg)' 
            }}
          >
            <div className="flex-1 flex items-center justify-center w-full">
              <p className="text-lg leading-relaxed whitespace-pre-wrap">
                {currentCard.back}
              </p>
            </div>
          </Card>
        </div>
      </div>

      {isFlipped && (
        <div className="mt-12 grid grid-cols-3 gap-4 mx-auto w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Button 
            variant="destructive" 
            size="lg" 
            className="flex flex-col h-16"
            onClick={() => handleReview(0)}
            disabled={submitting}
          >
            <span className="font-bold">Tekrar</span>
            <span className="text-xs opacity-80 font-normal">Bilmedim</span>
          </Button>
          <Button 
            variant="outline" 
            size="lg" 
            className="flex flex-col h-16 border-orange-500/50 hover:bg-orange-500/10 hover:text-orange-600"
            onClick={() => handleReview(1)}
            disabled={submitting}
          >
            <span className="font-bold">Zor</span>
            <span className="text-xs opacity-80 font-normal">Kararsız</span>
          </Button>
          <Button 
            variant="default" 
            size="lg" 
            className="flex flex-col h-16 bg-green-600 hover:bg-green-700 text-white"
            onClick={() => handleReview(2)}
            disabled={submitting}
          >
            <span className="font-bold">İyi</span>
            <span className="text-xs opacity-80 font-normal">Bildim</span>
          </Button>
        </div>
      )}
    </div>
  );
}
