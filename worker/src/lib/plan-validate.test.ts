/** `npx tsx src/lib/plan-validate.test.ts` */
import assert from "node:assert/strict";
import { sanitizePlan, canonicalTask, canonicalSubtopic } from "./plan-validate.js";
import { buildDays, subjectShares, phaseFor, daysBetween } from "./plan-prompt.js";
import type { AiOutput, Task } from "./plan-schemas.js";

const base: Task = {
  uuid: "aaaaaaaa-1111",
  time_start: "09:00",
  time_end: "10:00",
  subject: null,
  topic: "test",
  task_type: "konu",
  target_ref: null,
  tip: null,
};

// --- hedef doğrulama ---------------------------------------------------------

// geçerli alan + geçerli alt konu → hedef kanonik biçimde kurulur
{
  const t = canonicalTask({
    ...base,
    subject: "borclar",
    target_ref: "konular?subject=borclar&konu=zamanaşımı ve kesilmesi",
  });
  assert.ok(t);
  assert.equal(t.target_ref, `konular?subject=borclar&konu=${encodeURIComponent("zamanaşımı ve kesilmesi")}`);
}

// alt konu adı büyük harf / fazla boşlukla gelse de listeye oturur
assert.equal(
  canonicalSubtopic("borclar", "  ZAMANAŞIMI   VE  KESİLMESİ "),
  "zamanaşımı ve kesilmesi"
);

// doktrin alt konuları da geçerli sayılır
assert.equal(
  canonicalSubtopic("idare", "idarenin hizmet kusuru sorumluluğu"),
  "idarenin hizmet kusuru sorumluluğu"
);

// uydurma alt konu → görev kalır, hedef alan düzeyine iner
{
  const t = canonicalTask({
    ...base,
    subject: "medeni",
    target_ref: "konular?subject=medeni&konu=uzay hukuku esasları",
  });
  assert.ok(t);
  assert.equal(t.target_ref, "konular?subject=medeni");
}

// uydurma alan → görev düşer
assert.equal(canonicalTask({ ...base, subject: "deniz_ticaret" }), null);
assert.equal(canonicalTask({ ...base, task_type: "soru", subject: "" }), null);

// alan yalnızca target_ref'te yazılmışsa oradan okunur
{
  const t = canonicalTask({ ...base, task_type: "soru", target_ref: "hmgs?subject=ceza" });
  assert.ok(t);
  assert.equal(t.subject, "ceza");
  assert.equal(t.target_ref, "hmgs?subject=ceza");
}

// tekrar / deneme hedefleri modelin yazdığından bağımsız sabitlenir
assert.equal(canonicalTask({ ...base, task_type: "tekrar", target_ref: "/review" })!.target_ref, "tekrar");
assert.equal(
  canonicalTask({ ...base, task_type: "deneme", target_ref: "hmgs?count=99" })!.target_ref,
  "hmgs?count=120"
);
assert.equal(canonicalTask({ ...base, task_type: "serbest", subject: "x" })!.target_ref, null);

// plan düzeyinde sayım
{
  const out: AiOutput = {
    summary: "x",
    weeks: [
      {
        week_index: 1,
        start_date: "2026-08-10",
        end_date: "2026-08-16",
        days: [
          {
            date: "2026-08-10",
            weekday: "Pazartesi",
            tasks: [
              { ...base, subject: "medeni", target_ref: "konular?subject=medeni&konu=vesayet ve kısıtlılık" },
              { ...base, subject: "yok_boyle_bir_alan" },
              { ...base, task_type: "tekrar", target_ref: "yanlislarim" },
            ],
          },
        ],
      },
    ],
  };
  const r = sanitizePlan(out);
  assert.equal(r.dropped, 1);
  assert.equal(r.repaired, 1); // yalnızca "tekrar" görevinin hedefi değişti
  assert.equal(r.output.weeks[0].days[0].tasks.length, 2);
  // girdi mutasyona uğramamalı
  assert.equal(out.weeks[0].days[0].tasks.length, 3);
}

// --- istem yardımcıları ------------------------------------------------------

// 2 hafta = 14 gün, tatil günleri işaretli, tarihler ardışık
{
  const days = buildDays("2026-08-07", 2, ["Pazar"]);
  assert.equal(days.length, 14);
  assert.equal(days[0].date, "2026-08-07");
  assert.equal(days[0].weekday, "Cuma"); // 7 Ağustos 2026 Cuma
  assert.equal(days[13].date, "2026-08-20");
  assert.ok(days.filter((d) => d.off).every((d) => d.weekday === "Pazar"));
  assert.equal(days.filter((d) => d.off).length, 2);
}

// ay ve yıl sınırı
assert.equal(buildDays("2026-12-30", 1, [])[6].date, "2027-01-05");
assert.equal(daysBetween("2026-08-07", "2026-11-15"), 100);

// paylar: toplam 100, ve aynı ağırlıkta zayıf alan güçlü alandan çok pay alır
{
  const shares = subjectShares({
    subjects: [
      { id: "medeni", answered: 40, correct: 36, accuracy: 90, weak_subtopics: [] },
      { id: "borclar", answered: 40, correct: 12, accuracy: 30, weak_subtopics: [] },
    ],
    review_due: 0,
  });
  assert.equal(shares.reduce((a, s) => a + s.share, 0), 100);
  const medeni = shares.find((s) => s.id === "medeni")!;
  const borclar = shares.find((s) => s.id === "borclar")!;
  // Medeni 15 soru / %90, Borçlar 12 soru / %30 → ağırlıkça küçük olan öne geçmeli
  assert.ok(borclar.share > medeni.share, `borclar ${borclar.share} <= medeni ${medeni.share}`);
  // ölçülmemiş alan ne sıfırlanır ne de zayıf alanı geçer
  const ceza = shares.find((s) => s.id === "ceza")!;
  assert.equal(ceza.accuracy, null);
  assert.ok(ceza.share > 0);
}

// faz: sınav yaklaştıkça konu okuma azalır
assert.equal(phaseFor(90).id, "temel");
assert.equal(phaseFor(45).id, "pekiştirme");
assert.equal(phaseFor(10).id, "sınav");

console.log("plan-validate.test.ts OK");
