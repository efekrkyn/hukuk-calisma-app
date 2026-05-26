import IracClient from "./IracClient";
import Link from "next/link";
import { ArrowLeft, GitBranch } from "lucide-react";

export default function IracPage() {
  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <Link href="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors mb-2">
            <ArrowLeft className="w-4 h-4 mr-1" /> Ana sayfa
          </Link>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-gradient">
            <GitBranch className="w-8 h-8 text-primary" />
            IRAC Olay Çözme Sihirbazı
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Hukuki olayları 4 adımda (Issue → Rule → Analysis → Conclusion) çöz, yapay zeka her adımını puanlasın.
          </p>
        </div>
        <IracClient />
      </div>
    </main>
  );
}
