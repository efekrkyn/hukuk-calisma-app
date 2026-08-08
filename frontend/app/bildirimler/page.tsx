import Link from "next/link";
import { ArrowLeft, Flag } from "lucide-react";
import BildirimlerClient from "./BildirimlerClient";

/**
 * Hatalı soru bildirimlerinin karar ekranı.
 *
 * Worker'da /hmgs/report, /hmgs/reports ve /hmgs/reports/resolve zaten vardı
 * ama hiçbir arayüz bildirimleri OKUMUYORDU: bildirim gönderiliyor, D1'e
 * yazılıyor ve orada kalıyordu. Bildirimi kimse görmüyorsa hatalı soru
 * havuzda kalmaya devam eder — düğme de kullanıcıyı boşuna oyalar.
 */
export default function BildirimlerPage() {
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
            <Flag className="w-7 h-7 text-primary shrink-0" aria-hidden />
            Hata Bildirimleri
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            &quot;Bu soru hatalı&quot; denen sorular. Kaynağıyla karşılaştır; hatalıysa sil,
            doğruysa havuzda tut. Silinen soru herkesin bankasından çıkar.
          </p>
        </div>

        <BildirimlerClient />
      </div>
    </main>
  );
}
