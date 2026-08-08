import Link from "next/link";

/**
 * Özel 404.
 *
 * Varsayılan Next.js sayfası İngilizce, biçimsiz ve uygulamanın dizgisine
 * hiç benzemiyordu. Silinen eski sayfalara (quiz, flashcards, practice,
 * irac) yer imi kalmış olabilir; oraya düşen kişi ne olduğunu anlamalı ve
 * elinde bir çıkış olmalı.
 */
export default function NotFound() {
  return (
    <main className="min-h-dvh bg-background p-4 md:p-8 grid place-items-center">
      <div className="max-w-md space-y-4 text-center">
        <p className="label-academic">404</p>
        <h1 className="type-display">Sayfa bulunamadı</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Aradığın sayfa taşınmış ya da kaldırılmış olabilir. Eski bir bağlantıya
          tıkladıysan sebebi budur.
        </p>
        <div className="flex flex-wrap gap-3 justify-center pt-2">
          <Link href="/" className="text-sm text-primary">
            Ana sayfa →
          </Link>
          <Link href="/hmgs?count=120" className="text-sm text-muted-foreground underline underline-offset-4">
            Deneme sınavı
          </Link>
          <Link href="/konular" className="text-sm text-muted-foreground underline underline-offset-4">
            Konu anlatımı
          </Link>
        </div>
      </div>
    </main>
  );
}
