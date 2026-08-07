import Link from "next/link";
import { ArrowLeft, BookText } from "lucide-react";
import KonularClient from "./KonularClient";

/**
 * Konu Anlatımı sayfası.
 *
 * Seçim URL'de taşınıyor (?subject=&konu=); ilk değerler burada, sunucuda
 * okunup istemciye veriliyor. Böylece paylaşılan bir bağlantı doğrudan o
 * konuyu açar ve sayfa yenilenince seçim kaybolmaz.
 *
 * Kart sarmalayıcı bilerek yok: içerideki alan/konu kartları zaten
 * `material-thin`. Saydam yüzeyi saydam yüzeyin üstüne koymak okunurluğu
 * bozuyor (globals.css'teki malzeme kuralı).
 */
export default async function KonularPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; konu?: string }>;
}) {
  const { subject, konu } = await searchParams;

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
            <BookText className="w-7 h-7 text-primary shrink-0" aria-hidden />
            Konu Anlatımı
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Alanı seç, konuyu aç — anlatım kanun metninden çıkarılır, kaynak
            sayfalar altta listelenir.
          </p>
        </div>

        <KonularClient initialSubject={subject} initialKonu={konu} />
      </div>
    </main>
  );
}
