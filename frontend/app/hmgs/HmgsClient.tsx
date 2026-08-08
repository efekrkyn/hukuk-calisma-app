"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { spring, springSnappy } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { useSetPageContext } from "@/lib/page-context";
import { Card, CardContent } from "@/components/ui/card";
import ReportQuestion from "@/components/ReportQuestion";
import { Check, CheckCircle2, ClipboardList, Clock, Flag, Hash, Loader2, RefreshCw, Rocket, Star, Trophy, XCircle } from "lucide-react";

type QuizQuestion = {
  id: string;
  subject: string;
  subject_name: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  source_pdf?: string;
  source_page?: number;
  verified?: boolean;
};

type Answer = {
  selected: number | null;
  flagged: boolean;
};

/**
 * Gerçek HMGS: 120 soru, 155 dakika → soru başına 77,5 saniye.
 *
 * Önceki hâl 20 soruya 40 dakika veriyordu, yani soru başına 2 dakika —
 * gerçek sınavdan %55 daha cömert. Kısa denemede rahat yetişen tempo,
 * gerçek sınavda yetişmez; bu bir hazırlık uygulamasında yanlış alışkanlık
 * kazandırır. Süre artık soru sayısından türetiliyor, sabit değil.
 */
const REAL_TOTAL_QUESTIONS = 120;
const REAL_DURATION_SECONDS = 155 * 60;
const SECONDS_PER_QUESTION = REAL_DURATION_SECONDS / REAL_TOTAL_QUESTIONS;

/** Alan çalışmasında 10, kısa denemede 20, tam denemede 120. */
function parseCount(raw: string | undefined, subject?: string): number {
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 5) return Math.min(Math.round(n), REAL_TOTAL_QUESTIONS);
  return subject ? 10 : 20;
}

/** Gezinme ızgarasındaki tek soru düğmesi — açık ve kapalı ızgara aynı
 *  görünümü paylaşsın diye ayrıldı. */
function QNavButton({
  i,
  a,
  active,
  onGo,
}: {
  i: number;
  a: Answer;
  active: boolean;
  onGo: (i: number) => void;
}) {
  let cls = "w-8 h-8 text-xs rounded-lg border transition-all ";
  if (active) cls += "ring-2 ring-primary ";
  if (a.selected !== null) cls += "bg-primary/20 border-primary/50 text-primary ";
  else cls += "bg-background ";
  if (a.flagged) cls += "ring-2 ring-yellow-500 ";
  return (
    <button type="button" className={cls} onClick={() => onGo(i)}>
      {i + 1}
    </button>
  );
}

export default function HmgsClient({
  subject,
  count,
  subtopic,
}: {
  subject?: string;
  count?: string;
  subtopic?: string;
}) {
  const examSize = parseCount(count, subject);
  const isFullExam = !subject && examSize >= REAL_TOTAL_QUESTIONS;
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Exam state
  const [started, setStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  // Geçiş yönü — "bir yöne giden bir şey aynı yoldan dönmeli".
  // İleri giderken sağdan, geri dönerken soldan gelir.
  const [dir, setDir] = useState(1);
  const goTo = useCallback((i: number) => {
    setDir((d) => (i > currentIndex ? 1 : i < currentIndex ? -1 : d));
    setCurrentIndex(i);
  }, [currentIndex]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  // Süre GELEN soru sayısından hesaplanıyor, istenenden değil: banka bir
  // alanda eksikse 120 istenip 112 dönebiliyor ve 8 sorunun süresi hediye
  // edilmiş oluyordu. Sorular yüklenince aşağıda düzeltiliyor.
  const [totalSeconds, setTotalSeconds] = useState(
    Math.round(examSize * SECONDS_PER_QUESTION)
  );
  const [timeLeft, setTimeLeft] = useState(totalSeconds);
  const [finished, setFinished] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [examId, setExamId] = useState<string | null>(null);
  const submittedRef = useRef(false);

  // Asistan hangi soruyu çözdüğümüzü bilsin — "bu nedir?" dediğimizde
  // neyi kastettiğimizi anlaması buna bağlı.
  const activeQ = questions[currentIndex];
  useSetPageContext(
    started && !finished && activeQ
      ? {
          label: `Soru ${currentIndex + 1}`,
          detail: [
            `Alan: ${activeQ.subject_name}`,
            `Soru: ${activeQ.question}`,
            "Şıklar:",
            ...activeQ.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`),
          ].join("\n"),
        }
      : null
  );
  const [shortfall, setShortfall] = useState<Array<{ subject: string; needed: number; have: number }>>([]);
  const [verifiedCount, setVerifiedCount] = useState(0);
  const [subjectName, setSubjectName] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // ?subject=X → tek alan çalışması (ana sayfadaki alan kartları)
    const qs = new URLSearchParams({ count: String(examSize) });
    if (subject) qs.set("subject", subject);
    // Alt konu yalnızca alanla birlikte anlamlı — uç de böyle doğruluyor.
    if (subject && subtopic) qs.set("subtopic", subtopic);
    fetch(`/api/worker/hmgs/exam?${qs}`)
      .then((res) => {
        if (!res.ok) throw new Error("Sınav soruları yüklenemedi.");
        return res.json();
      })
      .then((data) => {
        const qs: QuizQuestion[] = data.questions ?? [];
        setQuestions(qs);
        setAnswers(qs.map(() => ({ selected: null, flagged: false })));
        const secs = Math.round(qs.length * SECONDS_PER_QUESTION);
        setTotalSeconds(secs);
        setTimeLeft(secs);
        setExamId(data.exam_id ?? null);
        setShortfall(data.shortfall ?? []);
        setVerifiedCount(data.verified_count ?? 0);
        setSubjectName(data.subject_name ?? null);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [subject]);

  // Sonucu bir kez kaydet (süre dolarak da bitebilir, elle de — ikisinde de çalışsın)
  useEffect(() => {
    if (!finished || submittedRef.current || !examId || questions.length === 0) return;
    submittedRef.current = true;
    fetch("/api/worker/hmgs/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exam_id: examId,
        answers: questions.map((q, i) => ({
          question_id: q.id,
          subject: q.subject,
          selected: answers[i]?.selected ?? null,
          correct: answers[i]?.selected === q.correctAnswer,
        })),
      }),
    }).catch((e) => console.error("HMGS sonucu kaydedilemedi:", e));
  }, [finished, examId, questions, answers]);

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
        <h2 className="type-display text-gradient">
          {subjectName ? `${subjectName} — Alan Çalışması` : "HMGS Zamanlı Deneme Sınavı"}
        </h2>
        <div className="max-w-md mx-auto text-sm text-muted-foreground space-y-2">
          <p> <strong>{questions.length} Soru</strong> — ÖSYM'nin resmî alan dağılımına göre</p>
          <p>
             <strong>{verifiedCount}</strong> soru kanun metnine karşı denetlendi
            {verifiedCount < questions.length && (
              <span className="text-muted-foreground">
                , {questions.length - verifiedCount} tanesi denetlenmedi
              </span>
            )}
          </p>
          <p className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden />
            <span><strong>{Math.round(totalSeconds / 60)} Dakika</strong> — Süre dolunca sınav otomatik biter</span>
          </p>
          <p className="flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 shrink-0" aria-hidden />
            <span>Soruları <strong>işaretleyip</strong> sonra geri dönebilirsin</span>
          </p>
          <p className="flex items-center gap-1.5">
            <Hash className="w-3.5 h-3.5 shrink-0" aria-hidden />
            <span>Soru numaralarına tıklayarak istediğin soruya atlayabilirsin</span>
          </p>
        </div>
        {shortfall.length > 0 && (
          <div className="max-w-md mx-auto text-xs text-amber-500/90 border border-amber-500/25 rounded-lg p-3 text-left">
            <p className="font-medium mb-1">Soru bankası bu alanlarda eksik:</p>
            <p>
              {shortfall.map((s) => `${s.subject} (${s.have}/${s.needed})`).join(", ")}
            </p>
            <p className="mt-1 text-muted-foreground">
              Deneme yine de çalışır ama alan dağılımı gerçek sınavı tam yansıtmaz.
            </p>
          </div>
        )}
        <Button size="lg" className="hover-glow mt-4" onClick={() => setStarted(true)}>
                <Rocket className="w-4 h-4 shrink-0" aria-hidden />Sınava Başla
        </Button>

        {/* Alan çalışmasında mod seçimi anlamsız — orası tek alana odaklı. */}
        {!subject && (
          <div className="pt-2">
            <p className="text-xs text-muted-foreground mb-2">
              {isFullExam
                ? "Gerçek sınav formatı: 120 soru, 155 dakika."
                : "Kısa tur. Gerçek sınav 120 soru ve 155 dakikadır."}
            </p>
            <a
              href={isFullExam ? "/hmgs?count=20" : "/hmgs?count=120"}
              className="text-sm text-primary underline underline-offset-4"
            >
              {isFullExam
                ? "Kısa denemeye geç (20 soru)"
                : "Tam denemeye geç (120 soru · 155 dk)"}
            </a>
          </div>
        )}
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
        <h2 className="type-display text-gradient">Sınav Tamamlandı!</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-lg mx-auto">
          <div className="material-thin rounded-xl p-4">
            <div className="text-3xl font-black text-green-500">{correct}</div>
            <div className="text-xs text-muted-foreground">Doğru</div>
          </div>
          <div className="material-thin rounded-xl p-4">
            <div className="text-3xl font-black text-red-500">{wrong}</div>
            <div className="text-xs text-muted-foreground">Yanlış</div>
          </div>
          <div className="material-thin rounded-xl p-4">
            <div className="text-3xl font-black text-yellow-500">{blank}</div>
            <div className="text-xs text-muted-foreground">Boş</div>
          </div>
          <div className="material-thin rounded-xl p-4 border-primary/30">
            <div className="text-3xl font-black text-primary">{net.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">Net</div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Süre: {formatTime(totalSeconds - timeLeft)} kullanıldı
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => setShowReview(true)}>
                <ClipboardList className="w-4 h-4 shrink-0" aria-hidden />Cevap Anahtarını Gör
          </Button>
          <Button onClick={() => window.location.reload()} className="hover-glow">
                <RefreshCw className="w-4 h-4 shrink-0" aria-hidden />Yeni Deneme
          </Button>
        </div>
      </div>
    );
  }

  // Review screen
  if (finished && showReview) {
    return (
      <div className="space-y-4">
        <p className="text-[11px] text-amber-500/90 border border-amber-500/25 rounded-lg p-2.5">
          Sorular kanun metninden yapay zekâ ile üretiliyor. &quot;Denetlendi&quot; rozeti,
          ikinci bir modelin soruyu kanun metnine karşı kontrol ettiği anlamına gelir —
          insan onayı değildir. Şüphelendiğin soruda kaynak bağlantısından maddeyi kontrol et.
        </p>
        <div className="flex items-center justify-between mb-4">
          <h3 className="type-title text-gradient">Cevap Anahtarı</h3>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Yeni Deneme</Button>
        </div>
        {questions.map((q, i) => {
          const ans = answers[i];
          const isCorrect = ans.selected === q.correctAnswer;
          return (
            <Card key={i} className={`material-thin border ${isCorrect ? "border-green-500/30" : ans.selected === null ? "border-yellow-500/30" : "border-red-500/30"}`}>
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium"><strong>S{i + 1}:</strong> {q.question}</p>
                  {isCorrect ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" /> : ans.selected === null ? <span className="text-yellow-500 text-xs">Boş</span> : <XCircle className="w-5 h-5 text-red-500 shrink-0" />}
                </div>
                {ans.selected !== null && ans.selected !== q.correctAnswer && (
                  <p className="text-xs text-red-500">Senin cevabın: {String.fromCharCode(65 + ans.selected)} — {q.options[ans.selected]}</p>
                )}
                <p className="text-xs text-green-600 dark:text-green-400">Doğru cevap: {String.fromCharCode(65 + q.correctAnswer)} — {q.options[q.correctAnswer]}</p>
                <p className="text-xs text-muted-foreground">{q.explanation}</p>
                {q.verified && (
                  <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-500/15 text-green-600 dark:text-green-400 mr-2">
                <Check className="w-4 h-4 shrink-0" aria-hidden />kaynağa karşı denetlendi
                  </span>
                )}
                {q.source_pdf && (
                  <a
                    href={`/reader/${q.source_pdf}#page=${q.source_page ?? 1}`}
                    className="inline-block text-[11px] text-primary/80 hover:text-primary underline underline-offset-2"
                  >
                    Kaynak: {q.source_pdf.split("/").pop()} s.{q.source_page} →
                  </a>
                )}
                {/* Bildirim düğmesi cevap anahtarında: doğru cevabı ve açıklamayı
                    gördükten sonra "bu yanlış" demek anlamlı. Sınav sürerken
                    kullanıcının elinde karşılaştıracağı bir şey yok. */}
                <ReportQuestion questionId={q.id} className="pt-1" />
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
  const courseName = q.subject_name || q.subject;
  const answeredCount = answers.filter((a) => a.selected !== null).length;
  // Kapalı ızgarada "kaç soruyu işaretledim" bilgisi başlıkta görünmeli,
  // yoksa açmadan bilinmiyor.
  const flaggedCount = answers.filter((a) => a.flagged).length;

  return (
    <div className="space-y-4">
      {/* Top bar: timer + progress */}
      <div className="sticky top-2 z-20 rounded-2xl p-3 material-thick flex items-center justify-between gap-3">
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

      {/* Soru gezinme ızgarası.
          120 soruda 12 satır ediyor ve soruyu katlamanın altına itiyordu —
          gerçek sınavda soruyu görmek için kaydırmak gerekiyordu. 40'tan
          çok soruda varsayılan kapalı; 20'lik turda eskisi gibi açık, orada
          2 satır yer kaplıyor ve kapatmanın faydası yok. */}
      {questions.length > 40 ? (
        <details className="material-thin rounded-xl px-3 py-2">
          <summary className="text-xs text-muted-foreground cursor-pointer list-none flex items-center justify-between">
            <span>Soru listesi</span>
            <span className="nums-tabular">
              {flaggedCount > 0 && `${flaggedCount} işaretli · `}
              {answeredCount}/{questions.length}
            </span>
          </summary>
          <div className="flex flex-wrap gap-1.5 pt-3">
            {questions.map((_, i) => (
              <QNavButton key={i} i={i} a={answers[i]} active={i === currentIndex} onGo={goTo} />
            ))}
          </div>
        </details>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {questions.map((_, i) => (
            <QNavButton key={i} i={i} a={answers[i]} active={i === currentIndex} onGo={goTo} />
          ))}
        </div>
      )}

      {/* Soru bloğu — yay ile, YÖNÜ tutarlı: ileri sağdan, geri soldan.
          "Bir yoldan giden aynı yoldan döner" ilkesi. */}
      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={currentIndex}
            custom={dir}
            initial={{ opacity: 0, x: dir * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -24 }}
            transition={spring}
            className="space-y-4"
          >
      {/* Question */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Soru {currentIndex + 1} / {questions.length}</span>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs">{courseName}</span>
                <button
          type="button"
          // Ekran okuyucuda "düğme" diye okunuyordu; sınav sırasında
          // hangi eylem olduğu anlaşılmıyordu.
          aria-label={ans.flagged ? "Soru işaretini kaldır" : "Soruyu işaretle"}
          aria-pressed={ans.flagged}
          onClick={toggleFlag} className={`p-1 rounded ${ans.flagged ? "text-yellow-500" : "text-muted-foreground/50 hover:text-yellow-500"}`}>
                  <Star className="w-4 h-4" fill={ans.flagged ? "currentColor" : "none"} />
                </button>
              </div>
            </div>

            <h3 className="type-title leading-relaxed">{q.question}</h3>

            <div className="space-y-2">
              {q.options.map((opt, idx) => {
                const isSelected = ans.selected === idx;
                return (
                  // Geri bildirim BASMA anında, bırakışta değil — beklemek ölü hissettirir.
                  // whileTap anlık, seçim durumu yayla oturuyor.
                  <motion.button
                    key={idx}
                    onClick={() => handleSelect(idx)}
                    whileTap={{ scale: 0.985 }}
                    transition={springSnappy}
                    animate={{
                      backgroundColor: isSelected
                        ? "color-mix(in oklab, var(--primary) 12%, transparent)"
                        : "color-mix(in oklab, var(--card) 40%, transparent)",
                    }}
                    className={
                      "w-full text-left rounded-xl py-3 px-4 border " +
                      (isSelected
                        ? "border-primary/60 text-primary"
                        : "border-border/50 text-foreground")
                    }
                  >
                    <div className="flex items-start gap-3 w-full">
                      <motion.span
                        animate={{ scale: isSelected ? 1.08 : 1 }}
                        transition={springSnappy}
                        className={
                          "shrink-0 w-6 h-6 rounded-full border grid place-items-center text-xs font-medium " +
                          (isSelected ? "bg-primary text-primary-foreground border-primary" : "bg-background")
                        }
                      >
                        {String.fromCharCode(65 + idx)}
                      </motion.span>
                      <span className="flex-1 whitespace-normal break-words text-sm type-body">{opt}</span>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {/* Navigation */}

          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex justify-between pt-2 pb-24 sm:pb-4">
        <Button variant="outline" disabled={currentIndex === 0} onClick={() => goTo(currentIndex - 1)}>
          ← Önceki
        </Button>
        <Button disabled={currentIndex === questions.length - 1} onClick={() => goTo(currentIndex + 1)} className="hover-glow">
          Sonraki →
        </Button>
      </div>
    </div>
  );
}
