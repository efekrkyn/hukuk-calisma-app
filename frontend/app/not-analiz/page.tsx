import NotAnalizClient from "./NotAnalizClient";
import Link from "next/link";
import { ArrowLeft, FileSearch } from "lucide-react";

export default function NotAnalizPage() {
  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <Link
              href="/"
              className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Ana sayfa
            </Link>
            <h1 className="text-3xl font-bold flex items-center gap-2 text-gradient">
              <FileSearch className="w-8 h-8 text-primary" />
              Canlı Not Analizi
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Hocanın ders notlarını yapıştır, yapay zeka hemen okusun ve seni sınava hazırlasın.
            </p>
          </div>
        </div>

        <NotAnalizClient />
      </div>
    </main>
  );
}
