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

  return (
    <main className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
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
            Yargıtay ve Anayasa Mahkemesi'nin sınavlarda çıkabilecek en kritik içtihatları.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {kararlar.map((karar) => (
          <Card key={karar.id} className="glass hover-glow border-primary/20">
            <CardHeader className="bg-muted/10 pb-3 border-b border-border/10">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-2">
                <CardTitle className="text-xl font-bold text-gradient">
                  {karar.topic}
                </CardTitle>
                <div className="flex flex-col items-end text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground/80">{karar.court}</span>
                  <span>{karar.number}</span>
                  <span className="flex items-center gap-1 mt-1">
                    <Calendar className="w-3 h-3" /> {karar.date}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div>
                <h4 className="text-sm font-semibold flex items-center gap-1.5 text-primary mb-1">
                  <FileText className="w-4 h-4" /> Karar Özeti
                </h4>
                <p className="text-sm leading-relaxed text-foreground/90 bg-muted/20 p-3 rounded-lg border border-border/50">
                  {karar.summary}
                </p>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-destructive/80 mb-1">Hukuki Önemi</h4>
                <p className="text-sm text-muted-foreground">
                  {karar.importance}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
        {kararlar.length === 0 && (
          <div className="text-center py-12 glass rounded-2xl border border-border">
            <Scale className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
            <h3 className="text-lg font-medium">Karar Bulunamadı</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Henüz emsal karar eklenmemiş.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
