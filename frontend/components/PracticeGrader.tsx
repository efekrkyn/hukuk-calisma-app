"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { gradePractice, type GradeResponse } from "@/lib/api";
import type { PracticeCase } from "@/lib/practice-cases";

const DIFF_STYLES: Record<PracticeCase["difficulty"], string> = {
  kolay: "bg-green-500/15 text-green-600",
  orta: "bg-yellow-500/15 text-yellow-700",
  zor: "bg-red-500/15 text-red-600",
};

export function PracticeGrader({ case_: pc }: { case_: PracticeCase }) {
  const [solution, setSolution] = useState("");
  const [grading, setGrading] = useState(false);
  const [result, setResult] = useState<GradeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (solution.trim().length < 20) {
      setError("Çözümün en az 20 karakter olmalı.");
      return;
    }
    setError(null);
    setGrading(true);
    try {
      const r = await gradePractice({
        case_id: pc.id,
        scenario: pc.scenario,
        ideal_solution: pc.ideal_solution,
        key_points: pc.key_points,
        user_solution: solution,
      });
      setResult(r);
    } catch (e) {
      setError(String(e));
    } finally {
      setGrading(false);
    }
  }

  function tryAgain() {
    setResult(null);
    setSolution("");
    setError(null);
  }

  const scoreColor = result
    ? result.score >= 80
      ? "text-green-500"
      : result.score >= 60
      ? "text-yellow-500"
      : "text-red-500"
    : "";

  return (
    <main className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/practice"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Pratikler
        </Link>
        <span
          className={
            "text-xs px-2 py-0.5 rounded " + DIFF_STYLES[pc.difficulty]
          }
        >
          {pc.difficulty}
        </span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{pc.title}</CardTitle>
          <div className="text-xs text-muted-foreground">
            {pc.topics.join(" · ")}
            {pc.source ? ` · ${pc.source}` : ""}
          </div>
        </CardHeader>
        <CardContent>
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            {pc.scenario}
          </div>
        </CardContent>
      </Card>

      {!result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Senin Çözümün</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea
              value={solution}
              onChange={(e) => setSolution(e.target.value)}
              placeholder="Olayı analiz et, ilgili kavramları belirle, hukuki sonucu yaz..."
              disabled={grading}
              className="w-full min-h-[240px] p-3 rounded-md border bg-background text-sm font-mono leading-relaxed"
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button
              onClick={submit}
              disabled={grading}
              className="w-full"
              size="lg"
            >
              {grading ? "Değerlendiriliyor..." : "Değerlendir"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              AI değerlendirmesi 5-15 saniye sürebilir.
            </p>
          </CardContent>
        </Card>
      )}

      {result && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Sonuç</span>
                <span className={"text-3xl font-bold " + scoreColor}>
                  {result.score}/100
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="whitespace-pre-wrap leading-relaxed">
                {result.feedback}
              </div>

              {result.hit_points.length > 0 && (
                <div>
                  <h3 className="font-semibold text-green-600 mb-1">
                    ✓ Yakaladığın
                  </h3>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {result.hit_points.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.missed_points.length > 0 && (
                <div>
                  <h3 className="font-semibold text-yellow-600 mb-1">
                    ⚠ Atladığın
                  </h3>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {result.missed_points.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.errors.length > 0 && (
                <div>
                  <h3 className="font-semibold text-red-500 mb-1">
                    ✗ Hatalı Yorumlar
                  </h3>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {result.errors.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">İdeal Çözüm</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap leading-relaxed text-sm">
                {result.ideal_solution}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Senin Yazdığın</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap leading-relaxed text-sm font-mono">
                {solution}
              </div>
            </CardContent>
          </Card>

          <Button onClick={tryAgain} variant="outline" className="w-full">
            Tekrar Dene
          </Button>
        </>
      )}
    </main>
  );
}
