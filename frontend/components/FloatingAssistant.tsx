"use client";

/**
 * Yüzen AI asistan — sözlüğün yerine.
 *
 * Eski FloatingDictionary sadece terim arıyordu ve sınavda "Sonraki"
 * butonunun üstüne oturuyordu. Bu asistan:
 *  - bulunduğu sayfayı ve çözülen soruyu biliyor (PageContext)
 *  - konuşmayı hatırlıyor (localStorage, sayfalar arası taşınıyor)
 *  - baloncuk etiketi bağlama göre değişiyor
 *
 * Çakışma: buton alt-sağda kalıyor ama sınav sayfası alt boşluk bırakıyor,
 * ayrıca panel açıkken buton gizleniyor.
 */

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Sparkles, X, Send, Trash2, Loader2 } from "lucide-react";
import { usePageContext } from "@/lib/page-context";
import { hataMetni } from "@/lib/api";

type Msg = { role: "user" | "ai"; content: string };

const STORAGE_KEY = "hmgs_asistan_gecmis_v1";
const MAX_REMEMBERED = 40;

/** Yol → okunur sayfa adı; asistan "neredeyim" bilsin. */
function pageName(path: string): string {
  if (path.startsWith("/hmgs")) return "HMGS deneme sınavı";
  if (path.startsWith("/reader")) return "PDF okuyucu";
  if (path.startsWith("/mevzuat")) return "Mevzuat arama";
  if (path.startsWith("/flashcards")) return "Flashcard tekrarı";
  if (path.startsWith("/emsal")) return "Emsal karar arama";
  if (path.startsWith("/sozluk")) return "Hukuk sözlüğü";
  if (path === "/") return "Ana sayfa";
  return path;
}

export default function FloatingAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const path = usePathname();
  const ctx = usePageContext();

  // Geçmişi geri yükle — "konuşmalarımızı hafızasına eklesin"
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setMsgs(JSON.parse(raw));
    } catch {
      /* bozuk kayıt varsa boş başla */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-MAX_REMEMBERED)));
    } catch {
      /* kota dolmuşsa sessiz geç, sohbet çalışmaya devam etsin */
    }
  }, [msgs]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, open]);

  // Sabit baloncuk kaydırılan içerikte hep bir şeyin üstüne denk geliyor —
  // simülatörde şıkların üzerinde durduğu görüldü, yanlış dokunma riski var.
  // Kaydırırken gizle, durunca geri getir.
  const [scrolling, setScrolling] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      setScrolling(true);
      clearTimeout(timer);
      timer = setTimeout(() => setScrolling(false), 500);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(timer);
    };
  }, []);

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", content: q }, { role: "ai", content: "" }]);
    setLoading(true);

    try {
      const res = await fetch("/api/worker/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          // Bağlam: hangi sayfadayız + hangi soruyu çözüyoruz.
          // "bu nedir?" sorusunun neye işaret ettiği buradan anlaşılıyor.
          selected_text: [
            `Kullanıcı şu an: ${pageName(path)}`,
            ctx?.detail ? `Ekrandaki içerik:\n${ctx.detail}` : "",
          ]
            .filter(Boolean)
            .join("\n\n"),
          history: msgs.slice(-8).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok || !res.body) throw new Error(await hataMetni(res));

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "ok" || payload.startsWith("[")) continue;
          try {
            const tok = JSON.parse(payload);
            if (typeof tok === "string") {
              setMsgs((m) => {
                const n = [...m];
                n[n.length - 1] = { role: "ai", content: n[n.length - 1].content + tok };
                return n;
              });
            }
          } catch {
            /* sources/done gibi satırlar */
          }
        }
      }
    } catch (e) {
      setMsgs((m) => {
        const n = [...m];
        n[n.length - 1] = { role: "ai", content: e instanceof Error ? e.message : `Bağlantı hatası: ${String(e).slice(0, 120)}` };
        return n;
      });
    } finally {
      setLoading(false);
    }
  }

  /**
   * Reasoner'ın <think> bloğunu gizler.
   *
   * Akış sırasında </think> henüz gelmemiş oluyor; sadece son kapanışa
   * bakmak yetmiyordu ve modelin iç düşüncesi ekrana akıyordu (simülatörde
   * görüldü). Kapanmamış <think> varsa hiçbir şey gösterme — çağıran
   * "düşünüyor" göstergesini koyar.
   */
  const clean = (s: string) => {
    const close = s.lastIndexOf("</think>");
    if (close !== -1) return s.slice(close + 8).trim();
    return s.includes("<think>") ? "" : s.trim();
  };

  const bubbleLabel = ctx?.label ?? "Asistan";

  // Giriş ekranında asistanın işi yok — hem anlamsız hem de API çağrısı
  // yetkisiz döner.
  if (path === "/login") return null;

  return (
    <>
      {/* Baloncuk — panel açıkken gizleniyor ki hiçbir şeyi kapatmasın */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label={`AI asistanı aç${ctx?.label ? ` — ${ctx.label}` : ""}`}
          title={bubbleLabel}
          className={
            "fixed right-4 z-40 grid place-items-center h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-2xl active:scale-95 transition-all duration-200 " +
            (scrolling ? "opacity-0 translate-y-4 pointer-events-none" : "opacity-100")
          }
          style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        >
          <Sparkles className="w-6 h-6" />
          {/* Bağlam rozeti — hangi soruda olduğumuz baloncukta görünsün */}
          {ctx?.label && (
            <span className="absolute -top-1 -left-1 max-w-[5rem] truncate rounded-full bg-background text-foreground border border-primary/40 px-1.5 py-0.5 text-[10px] font-semibold shadow">
              {ctx.label}
            </span>
          )}
        </button>
      )}

      {open && (
        <div
          className="fixed inset-x-0 bottom-0 z-50 sm:inset-x-auto sm:right-4 sm:w-[400px]"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="mx-2 mb-2 flex flex-col rounded-2xl border border-primary/25 bg-background/95 backdrop-blur-xl shadow-2xl overflow-hidden h-[70dvh] max-h-[560px]">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-muted/30">
              <Sparkles className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">AI Asistan</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {pageName(path)}
                  {ctx?.label ? ` · ${ctx.label}` : ""}
                </p>
              </div>
              <button
                onClick={() => setMsgs([])}
                aria-label="Geçmişi temizle"
                className="p-1.5 text-muted-foreground hover:text-red-500"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setOpen(false)}
                aria-label="Kapat"
                className="p-1.5 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
              {msgs.length === 0 && (
                <div className="text-xs text-muted-foreground space-y-2">
                  <p>Ekranda ne varsa onu biliyorum. Deneyebilirsin:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {["Bu nedir?", "Bu soruyu açıkla", "Neden bu şık doğru?", "Hangi maddeye dayanıyor?"].map(
                      (s) => (
                        <button
                          key={s}
                          onClick={() => send(s)}
                          className="px-2 py-1 rounded-full border border-primary/30 text-primary text-[11px] active:scale-95"
                        >
                          {s}
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}
              {msgs.map((m, i) => (
                <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
                  <div
                    className={
                      "inline-block max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap text-left " +
                      (m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/60")
                    }
                  >
                    {m.role === "ai" && !clean(m.content) ? (
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-xs">düşünüyor…</span>
                      </span>
                    ) : (
                      clean(m.content)
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-2 border-t border-border/50 flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send(input)}
                placeholder="Bu soru hakkında sor…"
                className="flex-1 rounded-xl bg-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <button
                onClick={() => send(input)}
                disabled={loading || !input.trim()}
                aria-label="Gönder"
                className="rounded-xl bg-primary text-primary-foreground px-3 disabled:opacity-40 active:scale-95"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
