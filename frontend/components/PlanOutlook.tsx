"use client";

/**
 * Ayrıntılı plandan sonraki haftalar — kaba bakış.
 *
 * NEDEN GÜN GÜN DEĞİL: 7 hafta sonrasının saat programını bugünden yapmak
 * anlamsız; o zamana kadar zayıf alanlar değişecek ve plan yeniden
 * üretilecek. Uzak haftada işe yarayan tek bilgi "hangi alana ne kadar".
 */

import type { OutlookWeek } from "@/types/plan";

const EVRE_ADI: Record<string, string> = {
  temel: "Temel — konu ağırlıklı",
  pekiştirme: "Pekiştirme — soru ağırlıklı",
  sınav: "Son düzlük — deneme ve tekrar",
};

function tarihAralik(a: string, b: string): string {
  const f = (iso: string) =>
    new Date(iso + "T00:00:00Z").toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  return `${f(a)} – ${f(b)}`;
}

export function PlanOutlook({ outlook }: { outlook?: OutlookWeek[] }) {
  if (!outlook || outlook.length === 0) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="label-academic">Sonraki haftalar</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Saat dağılımı alan ağırlığına ve zayıflığına göre hesaplandı. Sırası
          gelince gün gün planlanacak.
        </p>
      </div>

      {outlook.map((h) => (
        <div key={h.week_index} className="material-thin rounded-xl p-4 space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold">
              {h.week_index}. hafta
              <span className="font-normal text-muted-foreground ml-2 nums-tabular">
                {tarihAralik(h.start_date, h.end_date)}
              </span>
            </p>
            <p className="text-[11px] text-muted-foreground shrink-0">
              {EVRE_ADI[h.phase] ?? h.phase}
            </p>
          </div>

          <div className="space-y-1">
            {h.focus.map((f) => (
              <div key={f.id} className="flex items-center gap-3">
                <span className="text-sm flex-1 leading-tight">{f.name}</span>
                {/* Çubuk en çok saat alan alana göre ölçekleniyor; mutlak
                    saat zaten sağda yazıyor, çubuk yalnızca kıyas için. */}
                <span className="h-1.5 w-24 rounded-full bg-foreground/10 overflow-hidden shrink-0">
                  <span
                    className="block h-full rounded-full bg-primary/60"
                    style={{
                      width: `${(f.hours / h.focus[0].hours) * 100}%`,
                    }}
                  />
                </span>
                <span className="text-xs nums-tabular text-muted-foreground w-12 text-right shrink-0">
                  {f.hours} sa
                </span>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-muted-foreground pt-1">
            {h.study_hours != null && `${h.study_hours} saat alan çalışması`}
            {h.study_hours != null && h.mock_exams > 0 && " · "}
            {h.mock_exams > 0 && `${h.mock_exams} tam deneme (155 dk)`}
          </p>
          {/* Haftalar arasındaki asıl fark saatler değil işin TÜRÜ;
              yazılmazsa altı hafta birebir aynı görünüyor. */}
          {h.mix && (
            <p className="text-[11px] text-muted-foreground/80">{h.mix}</p>
          )}
        </div>
      ))}
    </section>
  );
}
