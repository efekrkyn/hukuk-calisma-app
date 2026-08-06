"use client";

/**
 * Yanlışlarım — denemede bilemediğin sorular FSRS aralıklarıyla geri gelir.
 *
 * HmgsClient yeniden kullanılmadı: orası zamanlı deneme akışı (sayaç, ileri/geri,
 * toplu teslim). Burada tek soru, anında cevap ve 4 zorluk düğmesi var; ortak
 * bileşene indirmek iki akışı da karmaşıklaştırırdı.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, X } from "lucide-react";
import { motion } from "motion/react";
import { spring, springSnappy } from "@/lib/motion";
import { useSetPageContext } from "@/lib/page-context";

type ReviewQuestion = {
  id: string;
  subject: string;
  subject_name: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  reps: number;
  lapses: number;
};

const GRADES = [
  { value: 0, label: "Tekrar", hint: "Hiç bilmedim" },
  { value: 1, label: "Zor", hint: "Zor hatırladım" },
  { value: 2, label: "İyi", hint: "Bildim" },
  { value: 3, label: "Kolay", hint: "Çok kolaydı" },
];

export default function TekrarClient() {
  const [queue, setQueue] = useState<ReviewQuestion[] | null>(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [dueTotal, setDueTotal] = useState(0);
  const [done, setDone] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const active = queue?.[index] ?? null;

  useSetPageContext(
    active
      ? {
          label: "Tekrar",
          detail: [
            `Alan: ${active.subject_name}`,
            `Soru: ${active.question}`,
            "Şıklar:",
            ...active.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`),
          ].join("\n"),
        }
      : { label: "Tekrar", detail: "Yanlışların tekrar kuyruğu" }
  );

  useEffect(() => {
    fetch("/api/worker/hmgs/review?count=20")
      .then((r) => r.json())
      .then((d) => {
        setQueue(d.questions ?? []);
        setDueTotal(d.due_total ?? 0);
      })
      .catch((e) => setError(String(e)));
  }, []);

  const grade = useCallback(
    async (value: number) => {
      if (!active) return;
      try {
        await fetch("/api/worker/hmgs/review/grade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question_id: active.id, grade: value }),
        });
      } catch {
        // Ağ hatası tekrarı bloklamamalı; kart bir sonraki açılışta yine gelir.
      }
      setDone((d) => d + 1);
      setPicked(null);
      setIndex((i) => i + 1);
    },
    [active]
  );

  if (error) {
    return (
      <p className="text-sm text-red-500">Tekrar kuyruğu alınamadı: {error}</p>
    );
  }
  if (!queue) return <p className="text-sm text-muted-foreground">Yükleniyor…</p>;

  if (queue.length === 0) {
    return (
      <div className="space-y-2">
        <p className="type-title">Tekrar bekleyen soru yok.</p>
        <p className="text-sm text-muted-foreground">
          Denemede bilemediğin sorular buraya düşer ve doğru aralıklarla geri gelir.
        </p>
        <Link href="/hmgs" className="text-sm text-primary">
          Deneme çöz →
        </Link>
      </div>
    );
  }

  if (!active) {
    return (
      <div className="space-y-2">
        <p className="type-title">Bu turu bitirdin.</p>
        <p className="text-sm text-muted-foreground">
          {done} soru tekrar edildi. Kalanlar planlanan tarihlerinde geri gelecek.
        </p>
        <Link href="/" className="text-sm text-primary">
          Ana sayfa →
        </Link>
      </div>
    );
  }

  const answered = picked !== null;
  const isRight = picked === active.correctAnswer;

  return (
    <motion.div
      key={active.id}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="space-y-4"
    >
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="label-academic">{active.subject_name}</span>
        <span className="nums-tabular">
          {done + 1} / {Math.min(queue.length, dueTotal || queue.length)}
          {active.lapses > 0 && ` · ${active.lapses}. kez`}
        </span>
      </div>

      <p className="text-base leading-relaxed">{active.question}</p>

      <div className="space-y-2">
        {active.options.map((o, i) => {
          const isCorrect = i === active.correctAnswer;
          const isPicked = i === picked;
          let cls = "material-thin border-transparent";
          if (answered && isCorrect) cls = "border-green-500/50 bg-green-500/10";
          else if (answered && isPicked) cls = "border-red-500/50 bg-red-500/10";

          return (
            <motion.button
              key={i}
              type="button"
              disabled={answered}
              whileTap={answered ? undefined : { scale: 0.99 }}
              transition={springSnappy}
              onClick={() => setPicked(i)}
              className={
                "w-full text-left rounded-xl border p-3 text-sm flex gap-3 items-start transition-colors " +
                cls
              }
            >
              <span className="font-mono text-xs mt-0.5 shrink-0">
                {String.fromCharCode(65 + i)}
              </span>
              <span className="flex-1">{o}</span>
              {answered && isCorrect && (
                <Check className="w-4 h-4 text-green-500 shrink-0" aria-hidden />
              )}
              {answered && isPicked && !isCorrect && (
                <X className="w-4 h-4 text-red-500 shrink-0" aria-hidden />
              )}
            </motion.button>
          );
        })}
      </div>

      {answered && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={spring}
          className="space-y-3"
        >
          <div className="material-thin rounded-xl p-3">
            <p className="text-xs label-academic mb-1">
              {isRight ? "Doğru" : "Doğru cevap"}
            </p>
            <p className="text-sm leading-relaxed">{active.explanation}</p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">
              Ne kadar zorlandın? Sorunun ne zaman geri geleceğini bu belirler.
            </p>
            {/* Sağ alttaki asistan baloncuğu son düğmenin üstüne biniyordu;
                son sütuna baloncuk genişliği kadar boşluk bırakılıyor. */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pb-20 sm:pb-0 sm:pr-20">
              {GRADES.map((g) => (
                <motion.button
                  key={g.value}
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  transition={springSnappy}
                  onClick={() => grade(g.value)}
                  className="material-thin rounded-xl p-3 text-left"
                >
                  <span className="block text-sm">{g.label}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {g.hint}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
