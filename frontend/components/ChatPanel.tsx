"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { streamChat, type ChatSource } from "@/lib/api";
import { Sparkles, HelpCircle, BookOpen, Lightbulb, GraduationCap, RefreshCw, ArrowRight, Loader2 } from "lucide-react";

type Msg = {
  role: "user" | "ai";
  content: string;
  sources?: ChatSource[];
};

type Props = {
  selectedText: string | null;
  course: string;
  pdfKey: string;
  /** "law" → kanun-modu (madde açıklama presets'i + worker tarafında özel system prompt). */
  mode?: "default" | "law";
};

export function ChatPanel({
  selectedText,
  course,
  pdfKey,
  mode = "default",
}: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const renderMessageContent = (content: string) => {
    if (content.includes("<think>") && content.includes("</think>")) {
      const parts = content.split("</think>");
      const thinking = parts[0].replace("<think>", "").trim();
      const answer = parts[1].trim();
      return (
        <div className="space-y-3">
          <details className="group border border-zinc-800 bg-zinc-900/50 rounded-xl p-3 [&_summary::-webkit-details-marker]:hidden" open>
            <summary className="flex items-center justify-between font-semibold text-xs text-zinc-400 cursor-pointer select-none">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
                Düşünme Süreci
              </span>
              <span className="text-zinc-500 transition group-open:rotate-180">
                ▼
              </span>
            </summary>
            <div className="mt-2 text-xs text-zinc-500 font-mono whitespace-pre-wrap border-t border-zinc-800/40 pt-2 leading-relaxed">
              {thinking}
            </div>
          </details>
          <div className="whitespace-pre-wrap leading-relaxed text-[13.5px]">
            {answer}
          </div>
        </div>
      );
    }

    if (content.includes("<think>")) {
      const thinking = content.replace("<think>", "").trim();
      return (
        <div className="space-y-3">
          <div className="border border-zinc-800 bg-zinc-900/50 rounded-xl p-3">
            <div className="flex items-center gap-1.5 font-semibold text-xs text-zinc-400">
              <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
              <span>Düşünme Süreci...</span>
            </div>
            <div className="mt-2 text-xs text-zinc-500 font-mono whitespace-pre-wrap border-t border-zinc-800/40 pt-2 leading-relaxed">
              {thinking}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="whitespace-pre-wrap leading-relaxed text-[13.5px]">
        {content}
      </div>
    );
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  async function send(question: string) {
    if (!question.trim() || loading) return;
    setLoading(true);
    const savedModel = typeof window !== "undefined" ? localStorage.getItem("hukuk_selected_model") : null;
    const selectedModel = savedModel === "gemini-2.5-flash" ? "deepseek-v4-flash" : (savedModel || "deepseek-v4-flash");
    const currentHistory = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    setMessages((m) => [
      ...m,
      { role: "user", content: question },
      { role: "ai", content: "" },
    ]);
    setInput("");
    try {
      for await (const ev of streamChat({
        question,
        selected_text: selectedText ?? undefined,
        course,
        pdf_key: pdfKey,
        mode,
        model: selectedModel,
        history: currentHistory,
      })) {
        if (ev.type === "sources") {
          setMessages((m) => {
            const a = [...m];
            a[a.length - 1] = { ...a[a.length - 1], sources: ev.data };
            return a;
          });
        } else if (ev.type === "token") {
          setMessages((m) => {
            const a = [...m];
            a[a.length - 1] = {
              ...a[a.length - 1],
              content: a[a.length - 1].content + ev.data,
            };
            return a;
          });
        } else if (ev.type === "error") {
          setMessages((m) => {
            const a = [...m];
            a[a.length - 1] = { role: "ai", content: `Hata: ${ev.data}` };
            return a;
          });
        }
      }
    } catch (e) {
      setMessages((m) => {
        const a = [...m];
        a[a.length - 1] = { role: "ai", content: `Bağlantı hatası: ${e}` };
        return a;
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-background/50 backdrop-blur-md">
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto p-3 space-y-3 text-sm min-h-0 scrollbar-thin"
      >
        {messages.length === 0 && (
          <div className="text-muted-foreground text-center py-12 px-4">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <p className="font-semibold text-foreground/80 mb-1">Hukuk AI Asistanına Hoş Geldin</p>
            <p className="text-xs max-w-xs mx-auto">
              {mode === "law"
                ? 'Kanun maddesini seçerek soldaki veya aşağıdaki preset butonlarını kullanabilir, ya da doğrudan soru sorabilirsin.'
                : 'Ders kitabından bir paragraf seçip alt kısımdaki butonlarla analiz ettirebilir ya da genel bir soru yöneltebilirsin.'}
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : ""}>
            <div
              className={`inline-block max-w-[90%] px-3 py-2 rounded-2xl text-left shadow-sm transition-all duration-200 ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground rounded-tr-none"
                  : "bg-muted/80 backdrop-blur-sm rounded-tl-none border border-border/40"
              }`}
            >
              {m.content ? (
                renderMessageContent(m.content)
              ) : (
                m.role === "ai" && loading ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Düşünme/Yanıt oluşturuluyor...</span>
                  </div>
                ) : null
              )}
              {m.sources && m.sources.length > 0 && (
                <div className="mt-2.5 pt-2.5 border-t border-border/30 flex flex-wrap gap-1">
                  {m.sources.map((s, idx) => {
                    const name =
                      s.pdf.split("/").pop()?.replace(/\.pdf$/i, "") ?? "kaynak";
                    return (
                      <Link
                        key={idx}
                        href={`/reader/${s.pdf}#page=${s.page_start}`}
                        className="text-[11px] font-medium inline-flex items-center px-2 py-0.5 rounded bg-background hover:bg-background/70 border transition-colors"
                        title={`${name} s.${s.page_start}-${s.page_end}`}
                      >
                        [{idx + 1}] s.{s.page_start}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedText && (
        <div className="px-3 py-2 border-t bg-yellow-500/5 dark:bg-yellow-500/10 text-xs flex flex-col gap-0.5">
          <span className="text-muted-foreground font-medium">Seçili Metin:</span>{" "}
          <span className="font-mono text-foreground/80 line-clamp-2">
            "{selectedText}"
          </span>
        </div>
      )}

      {/* Preset Stickers/Buttons Panel */}
      <div className="px-2 py-2 border-t bg-muted/20 backdrop-blur-sm flex flex-col gap-1.5">
        {selectedText ? (
          <div className="flex gap-1.5 flex-wrap">
            {mode === "law" ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 gap-1 bg-blue-500/5 text-blue-600 dark:text-blue-400 hover:bg-blue-500/15 border-blue-500/15 rounded-full"
                  onClick={() =>
                    send(
                      "Bu kanun maddesini SADE ve DETAYLI açıkla. Önce yalın bir özet, sonra her cümleyi ve teknik kavramı yorumla. Maddenin hangi durumlarda uygulanacağını pratik örneklerle anlat."
                    )
                  }
                  disabled={loading}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Madde Açıkla
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 gap-1 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15 border-emerald-500/15 rounded-full"
                  onClick={() =>
                    send(
                      "Bu madde için somut bir pratik olay (case) örneği yaz. Olayı kur, çözümü madde madde göster, hangi kanun hükümlerinin uygulanacağını belirt."
                    )
                  }
                  disabled={loading}
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  Pratik Örnek
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 gap-1 bg-amber-500/5 text-amber-600 dark:text-amber-400 hover:bg-amber-500/15 border-amber-500/15 rounded-full"
                  onClick={() =>
                    send(
                      "Bu kanun maddesini açıklamak için alternatif ve farklı pratik örnekler verir misin?"
                    )
                  }
                  disabled={loading}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Başka Örnek Ver
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 gap-1 bg-purple-500/5 text-purple-600 dark:text-purple-400 hover:bg-purple-500/15 border-purple-500/15 rounded-full"
                  onClick={() =>
                    send(
                      "Bu maddeyle ilişkili veya bağlantılı diğer kanun maddelerini (aynı kanun veya başka kanunlar — TBK, TMK, TCK, HMK, CMK, TTK, İK, İYUK, vb.) bul. Her birinin nasıl bağlantılı olduğunu kısaca açıkla."
                    )
                  }
                  disabled={loading}
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  İlgili Maddeler
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 gap-1 bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/15 border-indigo-500/15 rounded-full"
                  onClick={() =>
                    send(
                      "Bu kanun maddesinin uygulanmasındaki istisnalar ve sınırlamalar nelerdir?"
                    )
                  }
                  disabled={loading}
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  İstisnalar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 bg-slate-500/5 text-slate-600 dark:text-slate-400 hover:bg-slate-500/15 border-slate-500/15 rounded-full"
                  onClick={() => send("Bu maddeyi 3-4 bullet ile öğrenci notu gibi özetle.")}
                  disabled={loading}
                >
                  Özet
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 gap-1 bg-blue-500/5 text-blue-600 dark:text-blue-400 hover:bg-blue-500/15 border-blue-500/15 rounded-full"
                  onClick={() => send("Bu metni sade Türkçe ile açıkla.")}
                  disabled={loading}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Anlat
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 gap-1 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15 border-emerald-500/15 rounded-full"
                  onClick={() => send("Bu konuda bir pratik olay (case) örneği ver.")}
                  disabled={loading}
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  Örnek
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 gap-1 bg-amber-500/5 text-amber-600 dark:text-amber-400 hover:bg-amber-500/15 border-amber-500/15 rounded-full"
                  onClick={() => send("Bu açıklanan kavram/konu hakkında farklı pratik örnekler verir misin?")}
                  disabled={loading}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Başka Örnek
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 gap-1 bg-purple-500/5 text-purple-600 dark:text-purple-400 hover:bg-purple-500/15 border-purple-500/15 rounded-full"
                  onClick={() => send("Bu metne dayalı olarak çözmem için bana bir pratik olay sor (cevabımı sonra ben yazacağım).")}
                  disabled={loading}
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  Soru Üret
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 bg-slate-500/5 text-slate-600 dark:text-slate-400 hover:bg-slate-500/15 border-slate-500/15 rounded-full"
                  onClick={() => send("3 bullet ile özetle.")}
                  disabled={loading}
                >
                  Özet
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="flex gap-1.5 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 gap-1 bg-amber-500/5 text-amber-600 dark:text-amber-400 hover:bg-amber-500/15 border-amber-500/15 rounded-full"
              onClick={() => send(`Bu dersle ilgili (${course}) HMGS sınavında en çok hangi konulardan soru çıkıyor? Kritik sınav ipuçları nelerdir?`)}
              disabled={loading}
            >
              <Sparkles className="w-3.5 h-3.5" />
              HMGS İpuçları
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 gap-1 bg-purple-500/5 text-purple-600 dark:text-purple-400 hover:bg-purple-500/15 border-purple-500/15 rounded-full"
              onClick={() => send(`Bu dersin (${course}) en temel 5 kavramını ve kısa hukuki tanımlarını benim için listeler misin?`)}
              disabled={loading}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Önemli Kavramlar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 gap-1 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15 border-emerald-500/15 rounded-full"
              onClick={() => send(`Bana bu dersten (${course}) çözmem için kısa bir pratik olay (case) sorar mısın? Çözümümü yazdıktan sonra beni değerlendir.`)}
              disabled={loading}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              Beni Sına
            </Button>
            {messages.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7 gap-1 bg-rose-500/5 text-rose-600 dark:text-rose-400 hover:bg-rose-500/15 border-rose-500/15 rounded-full"
                onClick={() => setMessages([])}
                disabled={loading}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Temizle
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="p-2 border-t bg-muted/30 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="Sor..."
          disabled={loading}
          className="rounded-xl border-border/50 bg-background/50 focus-visible:ring-primary/50"
        />
        <Button
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
          className="rounded-xl px-4 shadow-sm active:scale-95 transition-transform"
        >
          Sor
        </Button>
      </div>
    </div>
  );
}
