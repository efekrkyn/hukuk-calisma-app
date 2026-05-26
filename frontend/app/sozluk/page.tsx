import Link from "next/link";
import { ArrowLeft, Search, BookA } from "lucide-react";
import SozlukClient from "./SozlukClient";

export default function SozlukPage() {
  return (
    <main className="min-h-[100dvh] bg-background p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <Link
            href="/"
            className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Ana sayfa
          </Link>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-gradient">
            <BookA className="w-8 h-8 text-primary" />
            Hukuk Sözlüğü
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Hukuk terimlerini, Latince deyimleri ve Osmanlıca kavramları anında ara.
          </p>
        </div>

        <SozlukClient />
      </div>
    </main>
  );
}
