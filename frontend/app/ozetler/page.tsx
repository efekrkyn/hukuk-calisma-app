import Link from "next/link";
import { COURSES } from "@/lib/courses";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { FileText, ArrowLeft, Zap } from "lucide-react";
import fs from "fs";
import path from "path";

export default async function OzetlerLanding() {
  // Check which summaries exist
  const summariesDir = path.join(process.cwd(), "data", "summaries");
  let existingFiles: string[] = [];
  try {
    existingFiles = fs.readdirSync(summariesDir);
  } catch (e) {
    // Directory might not exist yet
  }

  const coursesWithSummaries = COURSES.map((c) => {
    const hasSummary = existingFiles.includes(`${c.id}.json`);
    return { ...c, hasSummary };
  });

  return (
    <main className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
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
            <Zap className="w-8 h-8 text-yellow-500" />
            Son Gece Özetleri
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sınava girmeden hemen önce göz atabileceğin hap bilgiler.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {coursesWithSummaries.map((c) => (
          <Link href={`/ozetler/${c.id}`} key={c.id} className="block group">
            <Card className={`h-full transition-all duration-300 ${c.hasSummary ? "glass hover-glow border-primary/20" : "bg-card/30 opacity-70 border-dashed"}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className={`p-2 rounded-lg shrink-0 transition-transform group-hover:scale-110 ${c.hasSummary ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    <FileText className="w-5 h-5" />
                  </div>
                  <span className={`truncate ${c.hasSummary ? "font-semibold text-gradient" : "font-medium"}`}>
                    {c.name}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {c.hasSummary 
                    ? "Özet hazır! Hemen çalışmaya başla." 
                    : "Bu dersin özeti henüz hazırlanmadı."}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
