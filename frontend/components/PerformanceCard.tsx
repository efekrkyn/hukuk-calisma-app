"use client";

/**
 * Kendi performansın. Veri baştan beri hmgs_attempts'te duruyordu ama
 * hiçbir yerden okunmuyordu — uygulama her cevabı kaydedip kullanıcıya
 * hiçbir şey göstermiyordu.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { spring } from "@/lib/motion";

type Perf = {
  exams: Array<{ exam_id: string; at: number; total: number; correct: number; score: number }>;
  subjects: Array<{ id: string; name: string; answered: number; correct: number; accuracy: number }>;
  subtopics?: Array<{
    subject: string;
    subject_name: string;
    subtopic: string;
    answered: number;
    accuracy: number;
  }>;
  min_answers_for_ranking: number;
  overall: { exams: number; answered: number; correct: number; accuracy: number; pass_score: number };
  review_due: number;
};

export function PerformanceCard() {
  const [p, setP] = useState<Perf | null>(null);

  useEffect(() => {
    fetch("/api/worker/hmgs/performance")
      .then((r) => r.json())
      .then(setP)
      .catch(() => setP(null));
  }, []);

  if (!p || p.overall.exams === 0) return null;

  const { overall } = p;
  const last = p.exams[0];
  const prev = p.exams[1];
  const delta = prev ? last.score - prev.score : null;
  const passing = overall.accuracy >= overall.pass_score;

  // Az cevaplı alanları sıralamaya sokmak gürültü; eşiğin altındakiler gizli.
  const weak = p.subjects
    .filter((s) => s.answered >= p.min_answers_for_ranking)
    .slice(0, 3);

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="material-thin rounded-2xl p-5 space-y-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="label-academic">Performansın</h2>
        {p.review_due > 0 && (
          <Link href="/tekrar" className="text-xs text-primary shrink-0">
            {p.review_due} soru tekrar bekliyor →
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <div>
          <p
            className={
              "text-3xl font-black nums-tabular " +
              (passing ? "text-green-500" : "text-foreground")
            }
          >
            %{overall.accuracy}
          </p>
          <p className="text-xs text-muted-foreground">
            genel doğruluk · baraj {overall.pass_score}
          </p>
        </div>
        <div>
          <p className="text-lg font-semibold nums-tabular">
            %{last.score}
            {delta !== null && (
              <span
                className={
                  "text-xs ml-1 " + (delta >= 0 ? "text-green-500" : "text-red-500")
                }
              >
                {delta >= 0 ? "+" : ""}
                {delta}
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">son deneme</p>
        </div>
        {/* Deneme sayısı zaten burada duruyordu ama tıklanmıyordu — "hangi
            soruyu yanlış yaptım" sorusunun cevabı geçmiş dökümünde. */}
        <Link href="/denemelerim" className="group">
          <p className="text-lg font-semibold nums-tabular group-hover:text-primary transition-colors">
            {overall.exams}
          </p>
          <p className="text-xs text-muted-foreground">deneme · {overall.answered} cevap</p>
          <p className="text-xs text-primary">Denemelerim →</p>
        </Link>
      </div>

      {weak.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">En zayıf alanların</p>
          {weak.map((s) => (
            <Link
              key={s.id}
              href={`/hmgs?subject=${s.id}`}
              className="flex items-center gap-3 group"
            >
              <span className="text-sm flex-1 leading-tight group-hover:text-primary transition-colors">
                {s.name}
              </span>
              <span className="h-1.5 w-20 rounded-full bg-foreground/10 overflow-hidden shrink-0">
                <span
                  className={
                    "block h-full rounded-full " +
                    (s.accuracy >= 70 ? "bg-green-500" : s.accuracy >= 40 ? "bg-amber-500" : "bg-red-500")
                  }
                  style={{ width: `${Math.max(s.accuracy, 3)}%` }}
                />
              </span>
              <span className="text-xs nums-tabular text-muted-foreground w-10 text-right shrink-0">
                %{s.accuracy}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Alan sıralaması için alan başına en az {p.min_answers_for_ranking} cevap
          gerekiyor — biraz daha deneme çöz.
        </p>
      )}

      {/* Alan-altı kırılım. "Borçlar'da zayıfsın" eyleme dönüşmüyor; hangi
          alt konu olduğunu söylemek doğrudan bir sonraki adımı veriyor —
          bağlantı o konunun anlatımına gidiyor. */}
      {p.subtopics && p.subtopics.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <p className="text-xs text-muted-foreground">Zorlandığın konular</p>
          {p.subtopics.slice(0, 4).map((s) => (
            <Link
              key={`${s.subject}-${s.subtopic}`}
              href={`/konular?subject=${encodeURIComponent(s.subject)}&konu=${encodeURIComponent(s.subtopic)}`}
              className="flex items-baseline gap-2 group"
            >
              <span className="text-sm leading-tight flex-1 group-hover:text-primary transition-colors">
                {s.subtopic}
                <span className="block text-[11px] text-muted-foreground">
                  {s.subject_name} · {s.answered} soru
                </span>
              </span>
              <span className="text-xs nums-tabular text-muted-foreground shrink-0">
                %{s.accuracy}
              </span>
            </Link>
          ))}
        </div>
      )}
    </motion.section>
  );
}
