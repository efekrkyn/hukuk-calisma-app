import Link from "next/link";
import { ArrowLeft, RotateCcw } from "lucide-react";
import TekrarClient from "./TekrarClient";

export default function TekrarPage() {
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
            <RotateCcw className="w-7 h-7 text-primary" />
            Yanlışlarım
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Denemede bilemediğin sorular, unutmadan hemen önce geri gelir.
          </p>
        </div>

        <div className="material-thin rounded-xl p-4 md:p-6">
          <TekrarClient />
        </div>
      </div>
    </main>
  );
}
