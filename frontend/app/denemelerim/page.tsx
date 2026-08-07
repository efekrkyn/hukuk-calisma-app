import Link from "next/link";
import { ArrowLeft, History } from "lucide-react";
import DenemelerimClient from "./DenemelerimClient";

/**
 * Deneme geçmişi.
 *
 * Kart sarmalayıcı yok: içerideki deneme satırları ve soru kartları zaten
 * `material-thin`, saydamı saydamın üstüne koymak okunurluğu bozuyor
 * (globals.css'teki malzeme kuralı). /tekrar tek kart olduğu için sarmalıyor.
 */
export default function DenemelerimPage() {
  return (
    <main className="min-h-dvh bg-background p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Link
            href="/"
            className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Ana sayfa
          </Link>
          <h1 className="type-display flex items-center gap-2">
            <History className="w-7 h-7 text-primary shrink-0" aria-hidden />
            Denemelerim
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Çözdüğün her deneme burada duruyor — hangi soruyu yanlış yaptığını,
            hangi alanda düştüğünü tek tek görebilirsin.
          </p>
        </div>

        <DenemelerimClient />
      </div>
    </main>
  );
}
