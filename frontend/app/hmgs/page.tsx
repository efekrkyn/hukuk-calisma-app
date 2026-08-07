import HmgsClient from "./HmgsClient";
import Link from "next/link";
import { ArrowLeft, BookOpenCheck } from "lucide-react";

export default async function HmgsPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; count?: string }>;
}) {
  const { subject, count } = await searchParams;
  return (
    <main className="min-h-dvh bg-background p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <Link
              href="/"
              className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Ana sayfa
            </Link>
            <h1 className="type-display flex items-center gap-2">
              <BookOpenCheck className="w-8 h-8 text-primary" />
              HMGS Simülasyonu
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              ÖSYM'nin resmî alan dağılımına göre deneme çöz, ya da tek bir alana çalış.
            </p>
          </div>
        </div>

        <div className="material-thin rounded-xl p-4 md:p-6 border-primary/20 material-thin">
          <HmgsClient subject={subject} count={count} />
        </div>
      </div>
    </main>
  );
}
