"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { streamChat, type ChatSource } from "@/lib/api";

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

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  async function send(question: string) {
    if (!question.trim() || loading) return;
    setLoading(true);
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
    <div className="flex flex-col h-full min-h-0">
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto p-3 space-y-3 text-sm min-h-0"
      >
        {messages.length === 0 && (
          <div className="text-muted-foreground text-center py-8 text-xs">
            {mode === "law"
              ? 'Kanun PDF\'inden bir maddeyi seç ("Madde Açıkla" / "Örnek" / "İlgili Maddeler"), ya da "TBK 49 nedir?" gibi doğrudan soru yaz.'
              : 'PDF\'den bir paragraf seçip aşağıdaki "Anlat" / "Örnek" / "Özet" butonlarına bas, ya da doğrudan soru yaz.'}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : ""}>
            <div
              className={`inline-block max-w-[90%] px-3 py-2 rounded-lg text-left ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              <div className="whitespace-pre-wrap">
                {m.content || (m.role === "ai" && loading ? "..." : "")}
              </div>
              {m.sources && m.sources.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {m.sources.map((s, idx) => {
                    const name =
                      s.pdf.split("/").pop()?.replace(/\.pdf$/i, "") ?? "kaynak";
                    return (
                      <Link
                        key={idx}
                        href={`/reader/${s.pdf}#page=${s.page_start}`}
                        className="text-xs inline-flex items-center px-2 py-0.5 rounded bg-background hover:bg-background/70 border"
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
        <div className="px-3 py-2 border-t bg-yellow-500/10 text-xs">
          <span className="text-muted-foreground">Seçili:</span>{" "}
          <span className="font-mono">
            {selectedText.slice(0, 100)}
            {selectedText.length > 100 ? "..." : ""}
          </span>
        </div>
      )}

      {selectedText && mode === "law" && (
        <div className="px-2 py-1.5 border-t flex gap-1 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              send(
                "Bu kanun maddesini SADE ve DETAYLI açıkla. Önce yalın bir özet, sonra her cümleyi ve teknik kavramı yorumla. Maddenin hangi durumlarda uygulanacağı pratik örneklerle anlat."
              )
            }
            disabled={loading}
          >
            Madde Açıkla
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              send(
                "Bu madde için somut bir pratik olay (case) örneği yaz. Olayı kur, çözümü madde madde göster, hangi kanun hükümlerinin uygulanacağını belirt."
              )
            }
            disabled={loading}
          >
            Pratik Örnek
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              send(
                "Bu maddeyle ilişkili veya bağlantılı diğer kanun maddelerini (aynı kanun veya başka kanunlar — TBK, TMK, TCK, HMK, CMK, TTK, İK, İYUK, vb.) bul. Her birinin nasıl bağlantılı olduğunu kısaca açıkla."
              )
            }
            disabled={loading}
          >
            İlgili Maddeler
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              send("Bu maddeyi 3-4 bullet ile öğrenci notu gibi özetle.")
            }
            disabled={loading}
          >
            Özet
          </Button>
        </div>
      )}

      {selectedText && mode !== "law" && (
        <div className="px-2 py-1.5 border-t flex gap-1 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => send("Bu metni sade Türkçe ile açıkla.")}
            disabled={loading}
          >
            Anlat
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              send("Bu konuda bir pratik olay (case) örneği ver.")
            }
            disabled={loading}
          >
            Örnek
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => send("3 bullet ile özetle.")}
            disabled={loading}
          >
            Özet
          </Button>
        </div>
      )}

      <div className="p-2 border-t flex gap-2">
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
        />
        <Button
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
        >
          Sor
        </Button>
      </div>
    </div>
  );
}
