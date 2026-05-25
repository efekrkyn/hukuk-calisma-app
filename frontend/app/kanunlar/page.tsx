import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LAWS, CATEGORY_NAMES, type LawCategory } from "@/lib/laws";

export const metadata = {
  title: "Kanunlar — Hukuk Çalışma",
  description: "Türkiye Cumhuriyeti'nin temel kanunları, AI destekli açıklama",
};

export default function KanunlarLanding() {
  // Group by category
  const byCategory: Record<LawCategory, typeof LAWS> = {
    anayasal: [],
    medeni: [],
    ceza: [],
    ticaret: [],
    is: [],
    vergi: [],
    usul: [],
    ozel: [],
  };
  LAWS.forEach((l) => byCategory[l.category].push(l));

  return (
    <main className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">📜 Kanunlar</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Türkiye Cumhuriyeti'nin temel kanunları. PDF üzerinden paragraf seç,
            AI'a sade ve detaylı açıklama iste.
          </p>
        </div>
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground whitespace-nowrap"
        >
          ← Ana sayfa
        </Link>
      </div>

      {(Object.keys(byCategory) as LawCategory[]).map((cat) => {
        const items = byCategory[cat];
        if (items.length === 0) return null;
        return (
          <section key={cat} className="space-y-2">
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold pl-1">
              {CATEGORY_NAMES[cat]}
            </h2>
            <div className="grid gap-2 md:grid-cols-2">
              {items.map((law) => (
                <Link key={law.slug} href={`/kanunlar/${law.slug}`}>
                  <Card className="hover:bg-muted/40 transition-colors h-full">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-start gap-2">
                        <span className="text-xl leading-none mt-0.5">
                          {law.emoji}
                        </span>
                        <span className="flex-1">
                          {law.name}
                          {law.number !== "—" && (
                            <span className="ml-1 text-xs font-normal text-muted-foreground">
                              ({law.number})
                            </span>
                          )}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 text-xs text-muted-foreground leading-relaxed">
                      {law.description}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        );
      })}

      <div className="border-t pt-4 mt-6 text-xs text-muted-foreground space-y-1">
        <p>
          <strong>Not:</strong> Her kanun PDF'ini AÇIP üzerinden paragraf seçerek
          AI'a soru sorabilirsin. AI, kanun maddesini SADE + DETAYLI şekilde,
          örneklerle ve diğer kanunlardaki bağlantılı maddelerle birlikte
          açıklar.
        </p>
        <p>
          AÜHF 4. sınıf finalleri + HMGS için kritik kanunlar.{" "}
          {LAWS.length} kanun, ~6.000 vektör chunk.
        </p>
      </div>
    </main>
  );
}
