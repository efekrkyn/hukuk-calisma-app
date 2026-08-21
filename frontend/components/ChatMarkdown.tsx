"use client";

/**
 * Sohbet balonlarında markdown.
 *
 * NEDEN VAR: Asistan cevaplarını markdown yazıyor (`**kalın**`, numaralı
 * liste, ara sıra madde imi) ama üç sohbet yüzeyi de metni `whitespace-pre-wrap`
 * ile ham basıyordu. Ekranda "**NET CEVAP: B**" görünüyordu — yıldızlarıyla
 * birlikte. Sınava hazırlanan biri bu cevapları okuyarak çalışıyor;
 * vurgunun kaybolması okumayı yavaşlatıyor.
 *
 * `react-markdown` projede ZATEN kurulu (konu anlatımı kullanıyor), yeni
 * bağımlılık eklenmedi.
 *
 * NEDEN KONU ANLATIMININ HARİTASI KULLANILMADI: oradaki ölçüler makale için
 * — 1.75 satır aralığı, 68ch kap, `type-title` başlıklar. Sohbet balonu dar
 * ve kısa; aynı ölçüler balonu şişiriyor. Burada aralıklar sıkı.
 */

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const SOHBET: Components = {
  // Balon içinde ilk ve son paragrafın dış boşluğu balonun kendi dolgusuyla
  // çakışıyordu; first/last ile sıfırlanıyor.
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="my-2 pl-4 list-disc space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 pl-4 list-decimal space-y-1">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  // Başlıklar balonda büyük durmasın: cevap içi başlık, bölüm başlığı değil.
  h1: ({ children }) => <p className="mt-3 mb-1 font-semibold first:mt-0">{children}</p>,
  h2: ({ children }) => <p className="mt-3 mb-1 font-semibold first:mt-0">{children}</p>,
  h3: ({ children }) => <p className="mt-3 mb-1 font-semibold first:mt-0">{children}</p>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-primary/40 pl-3 text-[0.95em] [&>p]:my-1">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded bg-foreground/8 px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
  ),
  // Kaynak bağlantısı yeni sekmede: sohbeti kaybettirmesin.
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
      {children}
    </a>
  ),
  // Tablolar dar balonda taşıyor; kendi içinde kaydırılıyor.
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="text-[0.9em] border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-foreground/15 px-2 py-1 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border border-foreground/15 px-2 py-1">{children}</td>,
};

export default function ChatMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown components={SOHBET} remarkPlugins={[remarkGfm]}>
      {children}
    </ReactMarkdown>
  );
}
