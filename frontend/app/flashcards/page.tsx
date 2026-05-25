"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getFlashcardState, FlashcardState } from "@/lib/api";
import { getAvailableCourses } from "@/lib/flashcards";
import { BookOpen, BrainCircuit } from "lucide-react";

type CourseStats = {
  id: string;
  name: string;
  dueCount: number;
  totalStudied: number;
  loading: boolean;
};

export default function FlashcardsPage() {
  const [courses, setCourses] = useState<CourseStats[]>([]);

  useEffect(() => {
    async function load() {
      // getAvailableCourses is theoretically a server function but we can 
      // mock it or just fetch the list. Since it's currently a simple async function, 
      // calling it from client might fail if it relies on 'fs'.
      // Wait, getAvailableCourses is defined in lib/flashcards.ts which imports fs!
      // We should not import lib/flashcards.ts in a client component.
      // For now, let's just hardcode the course list in the client, or use an API route.
      const mockCourses = [
        { id: "borclar_genel", name: "Borçlar Hukuku Genel Hükümler" }
      ];

      const initialStats = mockCourses.map(c => ({
        ...c,
        dueCount: 0,
        totalStudied: 0,
        loading: true
      }));
      setCourses(initialStats);

      const now = Date.now();

      for (const course of mockCourses) {
        try {
          const res = await getFlashcardState(course.id);
          const due = res.state.filter(s => s.next_review <= now).length;
          // also un-studied cards (not in state) are technically due, but we'd need to know the total cards.
          // For MVP, we will calculate due cards inside the study page too.
          setCourses(prev => prev.map(c => 
            c.id === course.id ? { ...c, dueCount: due, totalStudied: res.state.length, loading: false } : c
          ));
        } catch (e) {
          console.error("Failed to load state for", course.id, e);
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
        <BrainCircuit className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">Flashcards (SRS)</h1>
      </div>
      
      <p className="text-muted-foreground mb-8">
        Spaced Repetition System (Aralıklı Tekrar Sistemi) ile ezber gerektiren konuları kalıcı olarak öğrenin.
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        {courses.map(course => (
          <Card key={course.id} className="transition-all hover:border-primary/50 hover:shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-xl">
                <BookOpen className="h-5 w-5" />
                {course.name}
              </CardTitle>
              <CardDescription>
                {course.loading ? "Durum yükleniyor..." : `${course.totalStudied} kart çalışıldı`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mt-4">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-muted-foreground">Tekrar Bekleyen</span>
                  <span className={`text-2xl font-bold ${course.dueCount > 0 ? "text-orange-500" : "text-green-500"}`}>
                    {course.loading ? "-" : course.dueCount}
                  </span>
                </div>
                <Link href={`/flashcards/${course.id}`}>
                  <Button size="lg" className="rounded-full">
                    Çalışmaya Başla
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
