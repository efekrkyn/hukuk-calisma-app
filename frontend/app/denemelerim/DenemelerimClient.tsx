"use client";

/**
 * Deneme geçmişi — liste ve tek deneme dökümü.
 *
 * Detay ayrı bir rota değil, aynı sayfada açılıyor: kullanıcı denemeler
 * arasında gezinirken listeyi kaybetmesin. Açılan denemenin dökümü
 * önbelleğe alınıyor, kapatıp açmak yeniden istek atmıyor.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronRight, CircleSlash, X } from "lucide-react";
import { motion } from "motion/react";
import { spring, springSnappy } from "@/lib/motion";
import { useSetPageContext } from "@/lib/page-context";

type ExamRow = {
  exam_id: string;
  at: number;
  total: number;
  correct: number;
  wrong: number;
  blank: number;
  score: number;
  passed: boolean;
};

type DetailQuestion = {
  question_id: string;
  subject: string;
  subject_name: string;
  subtopic: string | null;
  status: "correct" | "wrong" | "blank";
  /** Soru bankadan silinmişse false — metin ve şıklar yok. */
  available: boolean;
  question: string | null;
  options: string[];
  correct_answer: number | null;
  explanation: string | null;
};

type Detail = {
  exam_id: string;
  at: number;
  total: number;
  correct: number;
  wrong: number;
  blank: number;
  score: number;
  passed: boolean;
  pass_score: number;
  selected_option_known: boolean;
  by_subject: Array<{
    id: string;
    name: string;
    total: number;
    correct: number;
    wrong: number;
    blank: number;
    accuracy: number;
  }>;
  questions: DetailQuestion[];
};

const tarih = (ms: number) =>
  new Date(ms).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const saat = (ms: number) =>
  new Date(ms).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

export default function DenemelerimClient() {
  const [exams, setExams] = useState<ExamRow[] | null>(null);
  const [passScore, setPassScore] = useState(70);
  const [openId, setOpenId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, Detail>>({});
  const [error, setError] = useState<string | null>(null);

  const open = openId ? details[openId] : undefined;

  useSetPageContext(
    open
      ? {
          label: "Deneme dökümü",
          detail: [
            `${tarih(open.at)} tarihli deneme: %${open.score}`,
            `${open.correct} doğru, ${open.wrong} yanlış, ${open.blank} boş`,
            "Yanlış yapılan sorular:",
            ...open.questions
              .filter((q) => q.status !== "correct" && q.available)
              .slice(0, 20)
              .map((q) => `- [${q.subject_name}] ${q.question}`),
          ].join("\n"),
        }
      : { label: "Denemelerim", detail: "Geçmiş denemelerin listesi" }
  );

  useEffect(() => {
    fetch("/api/worker/hmgs/exams")
      .then((r) => r.json())
      .then((d) => {
        setExams(d.exams ?? []);
        if (d.pass_score) setPassScore(d.pass_score);
      })
      .catch((e) => setError(String(e)));
  }, []);

  const toggle = useCallback(
    async (id: string) => {
      if (openId === id) {
        setOpenId(null);
        return;
      }
      setOpenId(id);
      if (details[id]) return;
      try {
        const r = await fetch(`/api/worker/hmgs/exams/${encodeURIComponent(id)}`);
        const d = (await r.json()) as Detail;
        if (!r.ok) throw new Error("deneme okunamadı");
        setDetails((prev) => ({ ...prev, [id]: d }));
      } catch (e) {
        setError(String(e));
        setOpenId(null);
      }
    },
    [openId, details]
  );

  if (error) {
    return <p className="text-sm text-red-500">Deneme geçmişi alınamadı: {error}</p>;
  }
  if (!exams) return <p className="text-sm text-muted-foreground">Yükleniyor…</p>;

  if (exams.length === 0) {
    return (
      <div className="material-thin rounded-xl p-4 md:p-6 space-y-2">
        <p className="type-title">Henüz deneme çözmedin.</p>
        <p className="text-sm text-muted-foreground">
          Bir deneme bitirdiğinde sonucun buraya düşer; soru soru neyi
          bilemediğini buradan takip edersin.
        </p>
        <Link href="/hmgs" className="text-sm text-primary">
          Deneme çöz →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {exams.length} deneme · baraj {passScore}
      </p>

      {exams.map((e, i) => {
        const acik = openId === e.exam_id;
        return (
          <motion.div
            key={e.exam_id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: Math.min(i, 8) * 0.02 }}
            className="material-thin rounded-xl overflow-hidden"
          >
            <motion.button
              type="button"
              whileTap={{ scale: 0.995 }}
              transition={springSnappy}
              onClick={() => toggle(e.exam_id)}
              aria-expanded={acik}
              className="w-full text-left p-4 flex items-center gap-3"
            >
              {acik ? (
                <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden />
              ) : (
                <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden />
              )}

              <span className="flex-1 min-w-0">
                <span className="block text-sm leading-tight">{tarih(e.at)}</span>
                <span className="block text-[11px] text-muted-foreground nums-tabular">
                  {saat(e.at)} · {e.total} soru · {e.correct} doğru · {e.wrong} yanlış
                  {e.blank > 0 && ` · ${e.blank} boş`}
                </span>
              </span>

              <span className="text-right shrink-0">
                <span
                  className={
                    "block text-xl font-black nums-tabular " +
                    (e.passed ? "text-green-500" : "text-foreground")
                  }
                >
                  %{e.score}
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  {e.passed ? "geçti" : "kaldı"}
                </span>
              </span>
            </motion.button>

            {acik && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={spring}
                className="px-4 pb-4"
              >
                {details[e.exam_id] ? (
                  <ExamDetail d={details[e.exam_id]} />
                ) : (
                  <p className="text-sm text-muted-foreground">Döküm yükleniyor…</p>
                )}
              </motion.div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

function ExamDetail({ d }: { d: Detail }) {
  const yanlisVeBos = d.questions.filter((q) => q.status !== "correct");
  const dogrular = d.questions.filter((q) => q.status === "correct");

  return (
    <div className="space-y-5">
      <hr className="rule-hairline" />

      <div>
        <p className="label-academic mb-2">Alan bazlı</p>
        <div className="space-y-1.5">
          {d.by_subject.map((s) => (
            <div key={s.id} className="flex items-center gap-3">
              <span className="text-sm flex-1 leading-tight">{s.name}</span>
              <span className="h-1.5 w-20 rounded-full bg-foreground/10 overflow-hidden shrink-0">
                <span
                  className={
                    "block h-full rounded-full " +
                    (s.accuracy >= 70
                      ? "bg-green-500"
                      : s.accuracy >= 40
                        ? "bg-amber-500"
                        : "bg-red-500")
                  }
                  style={{ width: `${Math.max(s.accuracy, 3)}%` }}
                />
              </span>
              <span className="text-xs nums-tabular text-muted-foreground w-16 text-right shrink-0">
                {s.correct}/{s.total}
              </span>
            </div>
          ))}
        </div>
      </div>

      <hr className="rule-hairline" />

      {/* Şıklar her denemede karıştırılarak sunuluyor ve karıştırma sırası
          kaydedilmiyor; hangi ŞIKKI işaretlediğin geriye dönük çıkarılamıyor.
          Uydurmak yerine söylüyoruz — yanlış şık göstermek hiç göstermemekten kötü. */}
      {!d.selected_option_known && (
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Şıklar her denemede karıştırılarak soruluyor ve karıştırma sırası
          kaydedilmiyor. Bu yüzden hangi şıkkı işaretlediğini değil, doğru mu
          yanlış mı yaptığını ve doğru cevabı görüyorsun.
        </p>
      )}

      {yanlisVeBos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Bu denemede hiç yanlışın ve boşun yok.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="label-academic">
            Yanlış ve boş · {yanlisVeBos.length} soru
          </p>
          {yanlisVeBos.map((q) => (
            <QuestionCard key={q.question_id} q={q} />
          ))}
        </div>
      )}

      {dogrular.length > 0 && (
        <details className="group">
          <summary className="label-academic cursor-pointer list-none flex items-center gap-1.5">
            <ChevronRight
              className="w-3.5 h-3.5 transition-transform group-open:rotate-90"
              aria-hidden
            />
            Doğrular · {dogrular.length} soru
          </summary>
          <div className="space-y-3 mt-3">
            {dogrular.map((q) => (
              <QuestionCard key={q.question_id} q={q} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function QuestionCard({ q }: { q: DetailQuestion }) {
  const kenar =
    q.status === "correct"
      ? "border-green-500/30"
      : q.status === "blank"
        ? "border-yellow-500/30"
        : "border-red-500/30";

  return (
    <div className={"rounded-xl border p-3 space-y-2 " + kenar}>
      <div className="flex items-start justify-between gap-3">
        <span className="label-academic">{q.subject_name}</span>
        <span className="shrink-0 flex items-center gap-1 text-xs">
          {q.status === "correct" && (
            <>
              <Check className="w-4 h-4 text-green-500" aria-hidden />
              <span className="text-green-500">Doğru</span>
            </>
          )}
          {q.status === "wrong" && (
            <>
              <X className="w-4 h-4 text-red-500" aria-hidden />
              <span className="text-red-500">Yanlış</span>
            </>
          )}
          {q.status === "blank" && (
            <>
              <CircleSlash className="w-4 h-4 text-yellow-500" aria-hidden />
              <span className="text-yellow-500">Boş</span>
            </>
          )}
        </span>
      </div>

      {/* Silinen soru satırdan düşmüyor: o gün bu soru sana soruldu ve netine
          işledi. Atlansaydı geçmiş deneme bugün daha az soruluk görünürdü. */}
      {!q.available ? (
        <p className="text-sm text-muted-foreground leading-relaxed">
          Bu soru bankadan kaldırıldı — metni artık yok. Sonucun değişmedi, soru
          o denemede sana sorulmuştu.
        </p>
      ) : (
        <>
          <p className="text-sm leading-relaxed">{q.question}</p>

          <div className="space-y-1">
            {q.options.map((o, i) => {
              const dogru = i === q.correct_answer;
              return (
                <div
                  key={i}
                  className={
                    "rounded-lg border p-2 text-sm flex gap-2 items-start " +
                    (dogru
                      ? "border-green-500/50 bg-green-500/10"
                      : "border-transparent text-muted-foreground")
                  }
                >
                  <span className="font-mono text-xs mt-0.5 shrink-0">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="flex-1">{o}</span>
                  {dogru && (
                    <Check className="w-4 h-4 text-green-500 shrink-0" aria-hidden />
                  )}
                </div>
              );
            })}
          </div>

          {/* Açıklama yalnızca bilemediğin sorularda: doğru yaptığın soruda
              gerekçeyi tekrar okumak 120 soruluk dökümü okunmaz yapıyor. */}
          {q.status !== "correct" && q.explanation && (
            <div className="material-thin rounded-lg p-2.5 space-y-1.5">
              <p className="text-xs label-academic">Doğru cevap</p>
              <p className="text-sm leading-relaxed">{q.explanation}</p>
              {q.subtopic && (
                <Link
                  href={`/konular?subject=${encodeURIComponent(q.subject)}&konu=${encodeURIComponent(q.subtopic)}`}
                  className="inline-block text-xs text-primary"
                >
                  {q.subtopic} konusunu oku →
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
