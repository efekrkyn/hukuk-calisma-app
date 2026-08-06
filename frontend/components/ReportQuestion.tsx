"use client";

/**
 * "Bu soru hatalı" bildirimi.
 *
 * Sorular kanun metninden yapay zekâ ile üretiliyor; hmgs_verdicts'teki rozet
 * ikinci bir modelin görüşü, insan onayı değil. Uygulamayı yazan kişinin hukuk
 * bilgisi soruları teyit etmeye yetmediği için gerçek denetim soruyu çözenden
 * gelir — bu düğme o kanalın tek ucu.
 *
 * Deneme (HmgsClient) ve tekrar (TekrarClient) akışlarının ikisinde de aynı iş
 * yapılıyor; tek bileşen. Düğme bilerek küçük ve ikincil: çalışırken dikkat
 * dağıtmamalı, ama şüphe anında elin altında olmalı.
 */

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { spring, springSnappy } from "@/lib/motion";
import { Flag } from "lucide-react";

export default function ReportQuestion({
  questionId,
  className = "",
}: {
  questionId: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);

  const send = async () => {
    setSending(true);
    setFailed(false);
    try {
      const r = await fetch("/api/worker/hmgs/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question_id: questionId, reason: reason.trim() }),
      });
      if (!r.ok) throw new Error(String(r.status));
      setSent(true);
      setOpen(false);
    } catch {
      // Hatayı yutmak "gönderdim" yanılgısı yaratır — bildirim gitmediyse görünsün.
      setFailed(true);
    } finally {
      setSending(false);
    }
  };

  // Gönderildikten sonra düğme geri gelmez: aynı soru için ikinci bildirim
  // yeni bilgi taşımıyor, tekrar tıklanabilir bir düğme ise gitmediğini düşündürür.
  if (sent) {
    return (
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={spring}
        className={"inline-flex items-center gap-1.5 text-[11px] text-muted-foreground " + className}
      >
        <Flag className="w-3 h-3 shrink-0" aria-hidden />
        Bildirildi — bu soru havuzdan düştü
      </motion.span>
    );
  }

  return (
    <div className={className}>
      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        transition={springSnappy}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] text-muted-foreground/70 hover:text-foreground transition-colors"
      >
        <Flag className="w-3 h-3 shrink-0" aria-hidden />
        Bu soru hatalı
      </motion.button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={spring}
            className="mt-2 space-y-2"
          >
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={1000}
              aria-label="Sorunun nesi hatalı"
              placeholder="Nesi hatalı? (isteğe bağlı)"
              className="w-full material-thin rounded-xl border border-border/50 p-2.5 text-sm resize-none outline-none focus-visible:border-primary/50"
            />
            <div className="flex items-center gap-2">
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                transition={springSnappy}
                disabled={sending}
                onClick={send}
                className="rounded-lg border border-border/60 px-2.5 py-1 text-xs disabled:opacity-50"
              >
                {sending ? "Gönderiliyor…" : "Gönder"}
              </motion.button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs text-muted-foreground/70 hover:text-foreground transition-colors"
              >
                Vazgeç
              </button>
              {failed && (
                <span className="text-xs text-red-500">Gönderilemedi, tekrar dene.</span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
