import fs from "fs";
import path from "path";
import Link from "next/link";
import { ArrowLeft, BookOpen, AlertCircle } from "lucide-react";
import { courseById } from "@/lib/courses";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type Params = { course: string };

type SummaryData = {
  title: string;
  items: { topic: string; content: string }[];
};

export default async function OzetReader({ params }: { params: Promise<Params> }) {
  const { course } = await params;
  const courseInfo = courseById(course);
  const courseName = courseInfo?.name ?? course;

  let summary: SummaryData | null = null;
  const filePath = path.join(process.cwd(), "data", "summaries", `${course}.json`);
  
  try {
    const fileContent = fs.readFileSync(filePath, "utf-8");
    summary = JSON.parse(fileContent);
  } catch (e) {
    // Summary not found
  }

  return (
    <main className="p-4 md:p-6 max-w-4xl mx-auto space-y-6 min-h-[100dvh]">
      <div className="flex items-center gap-4 border-b border-border/10 pb-4">
        <Link
          href="/ozetler"
          className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-gradient">
            <BookOpen className="w-6 h-6 text-primary" />
            {summary ? summary.title : `${courseName} - Özet`}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Son Gece Özeti Hızlı Tekrar</p>
        </div>
      </div>

      {!summary ? (
        <div className="text-center py-20 glass rounded-2xl border border-border">
          <AlertCircle className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
          <h3 className="text-lg font-medium">Özet Bulunamadı</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Bu ders için henüz bir özet notu eklenmemiş. Lütfen daha sonra tekrar kontrol edin.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {summary.items.map((item, idx) => (
            <Card key={idx} className="glass hover-glow border-primary/20">
              <CardHeader className="bg-primary/5 pb-3 border-b border-primary/10">
                <CardTitle className="text-lg font-semibold text-primary/90 flex items-center gap-2">
                  <span className="bg-primary/20 text-primary w-6 h-6 rounded flex items-center justify-center text-sm">
                    {idx + 1}
                  </span>
                  {item.topic}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 text-sm leading-relaxed text-foreground/90">
                {item.content}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
