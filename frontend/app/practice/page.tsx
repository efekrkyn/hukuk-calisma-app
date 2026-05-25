"use client";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { COURSES } from "@/lib/courses";
import { allCases, type PracticeCase } from "@/lib/practice-cases";

const DIFF_STYLES: Record<PracticeCase["difficulty"], string> = {
  kolay: "bg-green-500/15 text-green-600",
  orta: "bg-yellow-500/15 text-yellow-700",
  zor: "bg-red-500/15 text-red-600",
};

export default function PracticeLanding() {
  const cases = allCases();
  const byCourse: Record<string, PracticeCase[]> = {};
  cases.forEach((c) => (byCourse[c.course] ??= []).push(c));

  return (
    <main className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pratik Olaylar ⚖️</h1>
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Ana sayfa
        </Link>
      </div>
      <p className="text-sm text-muted-foreground">
        Olay senaryosunu oku → kendi çözümünü yaz → AI değerlendirir, ideal
        çözümü gösterir, puan verir.
      </p>
      {COURSES.map((c) => {
        const list = byCourse[c.id] ?? [];
        if (list.length === 0) return null;
        return (
          <Card key={c.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span>{c.name}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {list.length} olay
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {list.map((pc) => (
                <Link
                  key={pc.id}
                  href={`/practice/${pc.id}`}
                  className="block py-2 px-2 -mx-2 rounded hover:bg-muted transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium">{pc.title}</span>
                    <span
                      className={
                        "text-xs px-2 py-0.5 rounded shrink-0 " +
                        DIFF_STYLES[pc.difficulty]
                      }
                    >
                      {pc.difficulty}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {pc.topics.slice(0, 4).join(" · ")}
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </main>
  );
}
