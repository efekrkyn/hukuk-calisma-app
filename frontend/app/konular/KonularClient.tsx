"use client";

/**
 * Konu Anlatımı — alan → alt konu → anlatım, üç kademe tek sayfada.
 *
 * Kademeler ayrı rotalara bölünmedi: konu ağacı tek istekte geliyor, alan ile
 * konu listesi arasında gidip gelmek ağa çıkmadan olsun istendi. Rota bölmek
 * her adımda yeniden veri çekimi demekti.
 *
 * Seçim URL'de duruyor ama `history.replaceState` ile yazılıyor, router ile
 * değil: amaç yalnızca bağlantının paylaşılabilir ve yenilemeye dayanıklı
 * olması; rotayı yeniden çalıştırmak bileşen durumunu (ve üretilmiş anlatımı)
 * boşuna atardı.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, Check, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { spring, springSnappy } from "@/lib/motion";
import { useSetPageContext } from "@/lib/page-context";

type Subtopic = { name: string; ready: boolean };
type Subject = { id: string; name: string; subtopics: Subtopic[] };

type TopicDoc = {
  ok: true;
  subject: string;
  subtopic: string;
  subject_name: string;
  content: string;
  sources: Array<{ pdf: string; page: number }>;
  cached: boolean;
};

/**
 * Markdown biçimlendirmesi.
 *
 * Projede `react-markdown` zaten kurulu (asistan kullanıyor) — kendi
 * dönüştürücümüzü yazmadık. Ama `prose` sınıfları burada işe yaramaz:
 * @tailwindcss/typography bağımlılığı yok, o sınıflar boşa düşüyor. O yüzden
 * her etiket tek tek biçimlendiriliyor.
 *
 * Uzun metin için iki şey belirleyici: satır aralığı ve satır uzunluğu.
 * Gövde 1.75 satır aralığında, kap 68ch ile sınırlı.
 */
const MD: Components = {
  h1: ({ children }) => <h2 className="type-title mt-7 mb-2 first:mt-0">{children}</h2>,
  h2: ({ children }) => <h2 className="type-title mt-7 mb-2 first:mt-0">{children}</h2>,
  h3: ({ children }) => (
    <h3 className="mt-5 mb-1.5 font-semibold text-[0.95rem]">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-4 mb-1 font-semibold text-sm text-muted-foreground">{children}</h4>
  ),
  p: ({ children }) => <p className="my-3 leading-[1.75]">{children}</p>,
  ul: ({ children }) => <ul className="my-3 pl-5 list-disc space-y-1.5">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 pl-5 list-decimal space-y-1.5">{children}</ol>,
  li: ({ children }) => <li className="leading-[1.7] pl-1">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  /* Kanun alıntısı — akademik dizgide alıntı kutuyla değil kenar çizgisiyle
     ayrılır; kart zaten saydam bir yüzey, içine ikinci yüzey konmuyor. */
  blockquote: ({ children }) => (
    <blockquote className="my-4 border-l-2 border-primary/40 pl-4 text-[0.925rem] text-muted-foreground [&>p]:my-2">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded bg-foreground/8 px-1 py-0.5 font-mono text-[0.85em]">
      {children}
    </code>
  ),
  hr: () => <hr className="rule-hairline my-6" />,
  a: ({ href, children }) => (
    <a href={href} className="text-primary underline underline-offset-2">
      {children}
    </a>
  ),
  /* Tablo telefonda taşıyor; sarmalayıcı kendi içinde kaysın, sayfa değil. */
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-foreground/15 px-2 py-1.5 text-left label-academic">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-foreground/8 px-2 py-1.5 align-top">{children}</td>
  ),
};

/** "data/kanunlar/tmk.pdf" → "tmk" — kaynak satırı okunabilir kalsın. */
function pdfLabel(pdf: string) {
  return (pdf.split("/").pop() ?? pdf).replace(/\.pdf$/i, "");
}

export default function KonularClient({
  initialSubject,
  initialKonu,
}: {
  initialSubject?: string;
  initialKonu?: string;
}) {
  const [topics, setTopics] = useState<Subject[] | null>(null);
  const [topicsError, setTopicsError] = useState<string | null>(null);

  const [subjectId, setSubjectId] = useState<string | null>(initialSubject ?? null);
  const [konu, setKonu] = useState<string | null>(initialKonu ?? null);

  const [doc, setDoc] = useState<TopicDoc | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  /** Geçen saniye — 30-60 sn'lik üretimde "takıldı mı?" sorusunu önlüyor. */
  const [elapsed, setElapsed] = useState(0);
  /** Artınca aynı konu `refresh:true` ile yeniden üretilir. */
  const [refreshNonce, setRefreshNonce] = useState(0);

  const subject = useMemo(
    () => topics?.find((s) => s.id === subjectId) ?? null,
    [topics, subjectId]
  );

  // ── Konu ağacı ────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    fetch("/api/worker/hmgs/topics", { credentials: "include" })
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (!r.ok) throw new Error(data?.error ?? `Sunucu ${r.status}`);
        return data;
      })
      .then((d) => {
        if (!alive) return;
        const subs: Subject[] = d?.subjects ?? [];
        setTopics(subs);
        // URL'deki alan listede yoksa (yazım hatası, kaldırılmış alan) seçim
        // sıfırlanır; yoksa kullanıcı hiç açılmayacak bir konuda asılı kalır.
        if (initialSubject && !subs.some((s) => s.id === initialSubject)) {
          setSubjectId(null);
          setKonu(null);
        }
      })
      .catch((e) => {
        if (alive) setTopicsError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      alive = false;
    };
  }, [initialSubject]);

  // ── Anlatım ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!subjectId || !konu) {
      setDoc(null);
      setDocError(null);
      return;
    }
    const ac = new AbortController();
    setDoc(null);
    setDocError(null);
    setElapsed(0);

    const started = Date.now();
    const timer = setInterval(
      () => setElapsed(Math.round((Date.now() - started) / 1000)),
      1000
    );

    (async () => {
      try {
        const r = await fetch("/api/worker/hmgs/topic", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: subjectId,
            subtopic: konu,
            ...(refreshNonce > 0 ? { refresh: true } : {}),
          }),
          signal: ac.signal,
        });
        const data = await r.json().catch(() => null);
        // Uç hata gövdesini { error } olarak veriyor; boş yakalayıp
        // "bir şeyler ters gitti" demek yerine gerçek sebebi gösteriyoruz.
        if (!r.ok || !data?.ok) {
          throw new Error(data?.error ?? `Sunucu ${r.status}`);
        }
        setDoc(data as TopicDoc);
        // Üretim bitti; listedeki "hazırlanacak" ipucu artık yanlış.
        setTopics((prev) =>
          prev?.map((s) =>
            s.id === subjectId
              ? {
                  ...s,
                  subtopics: s.subtopics.map((t) =>
                    t.name === konu ? { ...t, ready: true } : t
                  ),
                }
              : s
          ) ?? prev
        );
      } catch (e) {
        if (ac.signal.aborted) return;
        setDocError(e instanceof Error ? e.message : String(e));
      } finally {
        clearInterval(timer);
      }
    })();

    return () => {
      ac.abort();
      clearInterval(timer);
    };
  }, [subjectId, konu, refreshNonce]);

  // ── URL eşitleme ──────────────────────────────────────────────────────
  useEffect(() => {
    const p = new URLSearchParams();
    if (subjectId) p.set("subject", subjectId);
    if (konu) p.set("konu", konu);
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [subjectId, konu]);

  // ── Asistan bağlamı ───────────────────────────────────────────────────
  // Anlatımın kendisi de gidiyor ki "bunu özetler misin" çalışsın. Uzun
  // metin baştan kırpılıyor; tüm bağlam penceresini tek konuya vermenin
  // anlamı yok.
  useSetPageContext(
    doc
      ? {
          label: doc.subtopic,
          detail: [
            `Alan: ${doc.subject_name}`,
            `Konu: ${doc.subtopic}`,
            "Anlatım:",
            doc.content.slice(0, 6000),
            doc.content.length > 6000 ? "…(kısaltıldı)" : "",
          ]
            .filter(Boolean)
            .join("\n"),
        }
      : {
          label: "Konu Anlatımı",
          detail: subject
            ? `Konu anlatımı — ${subject.name} alanının konu listesi açık.`
            : "Konu anlatımı — alan seçim ekranı açık.",
        }
  );

  const openKonu = useCallback((name: string) => {
    setKonu(name);
    setRefreshNonce(0);
  }, []);

  // ── 1. kademe: alanlar ────────────────────────────────────────────────
  if (!subject) {
    if (topicsError) {
      return (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-500">
          Konu listesi alınamadı: {topicsError}
        </div>
      );
    }
    if (!topics) {
      return <p className="text-sm text-muted-foreground">Yükleniyor…</p>;
    }
    if (topics.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">
          Henüz tanımlı konu yok.
        </p>
      );
    }

    return (
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="space-y-2"
      >
        <h2 className="label-academic">Alanlar — sağdaki sayı: hazır / toplam konu</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {topics.map((s) => {
            const ready = s.subtopics.filter((t) => t.ready).length;
            return (
              <motion.button
                key={s.id}
                type="button"
                whileTap={{ scale: 0.98 }}
                transition={springSnappy}
                onClick={() => setSubjectId(s.id)}
                className="material-thin rounded-xl p-3 text-left flex items-center justify-between gap-3"
              >
                <span className="text-sm leading-tight">{s.name}</span>
                <span className="shrink-0 text-[11px] font-mono nums-tabular text-muted-foreground">
                  {ready}/{s.subtopics.length}
                </span>
              </motion.button>
            );
          })}
        </div>
      </motion.section>
    );
  }

  // ── 2. kademe: alt konular ────────────────────────────────────────────
  if (!konu) {
    return (
      <motion.section
        key={subject.id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="space-y-3"
      >
        <button
          type="button"
          onClick={() => setSubjectId(null)}
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Alanlar
        </button>

        <div>
          <h2 className="type-title">{subject.name}</h2>
          <p className="text-sm text-muted-foreground mt-0.5 nums-tabular">
            {subject.subtopics.length} konu
          </p>
        </div>

        {subject.subtopics.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Bu alan için tanımlı konu yok.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {subject.subtopics.map((t) => (
              <motion.button
                key={t.name}
                type="button"
                whileTap={{ scale: 0.98 }}
                transition={springSnappy}
                onClick={() => openKonu(t.name)}
                className="material-thin rounded-xl p-3 text-left flex items-start justify-between gap-3"
              >
                <span className="min-w-0">
                  <span className="block text-sm leading-tight">{t.name}</span>
                  {!t.ready && (
                    <span className="block text-[11px] text-muted-foreground mt-0.5">
                      İlk açılışta hazırlanır — yaklaşık bir dakika
                    </span>
                  )}
                </span>
                {t.ready ? (
                  <Check className="w-4 h-4 mt-0.5 shrink-0 text-green-500" aria-label="Hazır" />
                ) : (
                  <ChevronRight
                    className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                )}
              </motion.button>
            ))}
          </div>
        )}
      </motion.section>
    );
  }

  // ── 3. kademe: anlatım ────────────────────────────────────────────────
  return (
    <motion.section
      key={`${subject.id}/${konu}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="space-y-3"
    >
      <button
        type="button"
        onClick={() => setKonu(null)}
        className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        {subject.name}
      </button>

      {docError && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-500 space-y-2">
          <p>Anlatım alınamadı: {docError}</p>
          <button
            type="button"
            onClick={() => setRefreshNonce((n) => n + 1)}
            className="inline-flex items-center gap-1 text-xs underline underline-offset-2"
          >
            <RefreshCw className="w-3 h-3" aria-hidden />
            Yeniden dene
          </button>
        </div>
      )}

      {!doc && !docError && (
        /* Boş ekran bırakmıyoruz: ne olduğu, ne kadar sürdüğü ve metnin
           şekli birlikte gösteriliyor — 60 saniye beklerken "dondu mu?"
           sorusunu doğuran tek şey belirsizlik. */
        <div className="material-thin rounded-xl p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 shrink-0 animate-spin text-primary" aria-hidden />
            <p className="type-title">{konu}</p>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Kanun metni taranıyor ve anlatım yazılıyor. İlk üretim 30-60 saniye
            sürebilir; bu konu bir daha açıldığında anında gelir.
          </p>
          <p className="text-xs text-muted-foreground nums-tabular" aria-live="polite">
            {elapsed} saniye
          </p>
          <div className="space-y-2.5 pt-1" aria-hidden>
            {[92, 100, 78, 100, 96, 64].map((w, i) => (
              <div
                key={i}
                className="h-3 rounded bg-foreground/8 animate-pulse"
                style={{ width: `${w}%`, animationDelay: `${i * 90}ms` }}
              />
            ))}
          </div>
        </div>
      )}

      {doc && (
        <article className="material-thin rounded-xl p-4 sm:p-6">
          <header className="space-y-1">
            <p className="label-academic">{doc.subject_name}</p>
            <h2 className="type-title">{doc.subtopic}</h2>
          </header>

          <hr className="rule-hairline my-4" />

          <div className="max-w-[68ch] type-body text-[0.95rem]">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD}>
              {doc.content}
            </ReactMarkdown>
          </div>

          <hr className="rule-hairline my-5" />

          {/* Okuma → çözme köprüsü. Anlatımı bitiren kişinin bir sonraki
              adımı aramak zorunda kalmaması, çalışma döngüsünü kapatıyor:
              oku → çöz → bilemediklerin tekrar kuyruğuna düşer. */}
          <a
            href={`/hmgs?subject=${encodeURIComponent(doc.subject)}&subtopic=${encodeURIComponent(doc.subtopic)}&count=10`}
            className="material-thin rounded-xl px-4 py-3 flex items-center justify-between gap-3 mb-5 hover:border-primary/40 transition-colors"
          >
            <span className="text-sm">
              Bu konudan soru çöz
              <span className="block text-[11px] text-muted-foreground">
                10 soru, sadece {doc.subtopic}
              </span>
            </span>
            <span className="text-primary text-sm shrink-0">→</span>
          </a>

          <footer className="space-y-2">
            {doc.sources?.length > 0 && (
              <div>
                <p className="label-academic mb-1">Kaynak</p>
                <ul className="text-[11px] text-muted-foreground space-y-0.5">
                  {doc.sources.map((s, i) => (
                    <li key={`${s.pdf}-${s.page}-${i}`} className="nums-tabular">
                      {pdfLabel(s.pdf)} · s. {s.page}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* Asistan baloncuğu sağ altta duruyor; alt satır onun altında
                kalmasın diye telefonda ekstra boşluk. */}
            <div className="flex items-center justify-between gap-3 pt-1 pb-16 sm:pb-0">
              <p className="text-[11px] text-muted-foreground/70">
                Anlatım kanun metninden yapay zekâ ile çıkarılır; kaynak
                sayfalardan doğrulanmalıdır.
              </p>
              <button
                type="button"
                onClick={() => setRefreshNonce((n) => n + 1)}
                className="inline-flex items-center gap-1 shrink-0 text-[11px] text-muted-foreground hover:text-primary transition-colors"
              >
                <RefreshCw className="w-3 h-3" aria-hidden />
                Yeniden üret
              </button>
            </div>
          </footer>
        </article>
      )}
    </motion.section>
  );
}
