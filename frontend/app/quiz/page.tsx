"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getQuizStats, QuizStats } from "@/lib/api";
import { COURSES } from "@/lib/courses";
import { GraduationCap, BarChart } from "lucide-react";

type CourseQuizInfo = {
  id: string;
  name: string;
  stats?: QuizStats;
  loading: boolean;
};

export default function QuizLandingPage() {
  const [courses, setCourses] = useState<CourseQuizInfo[]>([]);

  useEffect(() => {
    async function load() {
      // Sadece borclar_genel için mock veri var şimdilik, onu öne çıkaralım.
      const availableIds = ["borclar_genel"];
      
      const initial = availableIds.map(id => {
        const c = COURSES.find(c => c.id === id);
        return {
          id: id,
          name: c?.name || id,
          loading: true,
        };
      });
      setCourses(initial);

      for (const course of initial) {
        try {
          const stats = await getQuizStats(course.id);
          setCourses(prev => prev.map(c => 
            c.id === course.id ? { ...c, stats, loading: false } : c
          ));
        } catch (e) {
          console.error("Failed to load stats for", course.id, e);
          setCourses(prev => prev.map(c => 
            c.id === course.id ? { ...c, loading: false } : c
          ));
        }
      }
    }
    load();
  }, []);

  return (
    <div className="container max-w-4xl py-12">
      <div className="mb-8 flex items-center gap-3">
        <GraduationCap className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">Quiz & Deneme (HMGS)</h1>
      </div>
      
      <p className="text-muted-foreground mb-8">
        Konu bazlı testler çözün, zayıf olduğunuz alanları tespit edin ve çoktan seçmeli HMGS sınavına hazırlanın.
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        {courses.map(course => {
          const acc = course.stats?.total_attempts 
            ? Math.round((course.stats.correct_count / course.stats.total_attempts) * 100) 
            : 0;

          return (
            <Card key={course.id} className="transition-all hover:border-primary/50 hover:shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-xl">
                  {course.name}
                </CardTitle>
                <CardDescription>
                  {course.loading ? "İstatistikler yükleniyor..." : `${course.stats?.total_attempts || 0} soru çözüldü`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!course.loading && course.stats && course.stats.total_attempts > 0 && (
                  <div className="mb-4 flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <BarChart className="h-4 w-4" />
                      Başarı: <span className={`font-bold ${acc > 70 ? "text-green-500" : acc > 40 ? "text-yellow-500" : "text-red-500"}`}>%{acc}</span>
                    </div>
                  </div>
                )}
                
                {!course.loading && course.stats && course.stats.weakTopics?.length > 0 && (
                  <div className="mb-4">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Zayıf Konular:</span>
                    <p className="text-sm mt-1 text-orange-600/80 line-clamp-2">
                      {course.stats.weakTopics.slice(0, 2).join(", ")}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-end mt-4">
                  <Link href={`/quiz/${course.id}`}>
                    <Button size="lg" className="w-full sm:w-auto">
                      Teste Başla
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
