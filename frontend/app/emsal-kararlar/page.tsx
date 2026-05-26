import Link from "next/link";
import { ArrowLeft, Scale, Calendar, FileText } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import fs from "fs";
import path from "path";

type Karar = {
  id: string;
  court: string;
  date: string;
  number: string;
  category: string;
  topic: string;
  summary: string;
  importance: string;
};

export default async function EmsalKararlar() {
  let kararlar: Karar[] = [];
  try {
    const filePath = path.join(process.cwd(), "data", "kararlar.json");
    const fileContent = fs.readFileSync(filePath, "utf-8");
    kararlar = JSON.parse(fileContent);
  } catch (e) {
    // If not found, list is empty
  }

  // Group by category
  const grouped: Record<string, Karar[]> = {};
  kararlar.forEach((k) => {
    const cat = k.category || "Diğer";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(k);
  });

  const categories = Object.keys(grouped).sort();

  return (
    <main className="p-4 md:p-6 max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link
            href="/"
            className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Ana sayfa
          </Link>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Scale className="w-8 h-8 text-primary" />
            Emsal Kararlar
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Yargıtay ve Anayasa Mahkemesi'nin sınavlarda çıkabilecek en kritik 100+ içtihadı.
          </p>
        </div>
      </div>

      {kararlar.length === 0 && (
        <div className="text-center py-12 glass rounded-2xl border border-border">
          <Scale className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
          <h3 className="text-lg font-medium">Karar Bulunamadı</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Henüz emsal karar eklenmemiş.
          </p>
        </div>
      )}

      {categories.map((cat) => (
        <div key={cat} className="space-y-4">
          <div className="flex items-center gap-2 border-b border-border/50 pb-2">
            <h2 className="text-xl font-bold text-gradient">{cat}</h2>
            <span className="text-xs font-medium px-2 py-0.5 bg-primary/10 text-primary rounded-full">
              {grouped[cat].length} Karar
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {grouped[cat].map((karar) => (
              <Card key={karar.id} className="glass hover-glow border-primary/10 flex flex-col h-full">
                <CardHeader className="bg-muted/5 pb-3 border-b border-border/5">
                  <div className="flex flex-col gap-2">
                    <CardTitle className="text-base font-bold leading-tight">
                      {karar.topic}
                    </CardTitle>
                    <div className="flex justify-between items-center text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                      <span>{karar.court}</span>
                      <span>{karar.date}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 flex flex-col gap-3 flex-1">
                  <div className="flex-1">
                    <p className="text-sm leading-relaxed text-foreground/80 line-clamp-4">
                      {karar.summary}
                    </p>
                  </div>
                  <div className="mt-auto pt-3 border-t border-border/10">
                    <p className="text-xs font-medium text-destructive/80">
                      Önemi: <span className="text-muted-foreground font-normal">{karar.importance}</span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </main>
  );
}
