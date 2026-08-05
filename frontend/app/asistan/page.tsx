import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import GlobalAiAssistant from "@/components/GlobalAiAssistant";

/**
 * Tam ekran asistan.
 *
 * Yüzen asistan hızlı soru için ("bu nedir?"); bu sayfa uzun oturumlar için —
 * web araması, sınav modu ve sesli giriş burada. Ana sayfada gömülüydü ama
 * yüzen asistan gelince iki asistan yan yana görünüyordu.
 */
export default function AsistanPage() {
  return (
    <main className="min-h-dvh p-4 sm:p-6 bg-background">
      <div className="max-w-3xl mx-auto space-y-4">
        <div>
          <Link
            href="/"
            className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Ana sayfa
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-primary" />
            AI Asistan
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Web araması, sınav modu ve sesli giriş burada. Soru çözerken hızlı
            soru sormak için sağ alttaki baloncuğu kullan.
          </p>
        </div>
        <GlobalAiAssistant />
      </div>
    </main>
  );
}
