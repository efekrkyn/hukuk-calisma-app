/** `npx tsx src/lib/srs.test.ts` */
import assert from "node:assert/strict";
import { schedule, toRating, toCard } from "./srs.js";
import { Rating, State } from "ts-fsrs";

const NOW = new Date("2026-08-01T10:00:00Z");
const DAY = 86400_000;

// not eşlemesi — arayüz 0/1/2 gönderiyor, 3 (Kolay) da desteklenmeli
assert.equal(toRating(0), Rating.Again);
assert.equal(toRating(1), Rating.Hard);
assert.equal(toRating(2), Rating.Good);
assert.equal(toRating(3), Rating.Easy);
// bilinmeyen not sessizce Good'a düşmeli, patlamamalı
assert.equal(toRating(99), Rating.Good);

// kaydı olmayan kart yeni kart olarak başlar
const fresh = toCard(null, NOW);
assert.equal(fresh.state, State.New);
assert.equal(fresh.reps, 0);

// eksik stability/difficulty da yeni karta düşmeli (eski SM-2 satırları böyle)
const legacy = toCard(
  { stability: null, difficulty: null, elapsed_days: null, scheduled_days: null,
    reps: null, lapses: null, fsrs_state: null, last_review: null },
  NOW
);
assert.equal(legacy.state, State.New);

// ASIL DAVRANIS: iyi cevap ileri atar, "tekrar" geri ceker
const good = schedule(null, 2, NOW);
const again = schedule(null, 0, NOW);
assert.ok(good.next_review > NOW.getTime(), "iyi cevap geleceğe planlanmalı");
assert.ok(
  good.next_review > again.next_review,
  `İyi (${good.next_review}) Tekrar'dan (${again.next_review}) sonra olmalı`
);

// Kolay, İyi'den daha uzağa atmalı
const easy = schedule(null, 3, NOW);
assert.ok(easy.next_review >= good.next_review, "Kolay en az İyi kadar uzağa atmalı");

// tekrarlanan basarili tekrar araligi buyutmeli (SM-2'de de vardi, korunmali)
let row = schedule(null, 2, NOW);
const first = row.scheduled_days;
row = schedule(
  { stability: row.stability, difficulty: row.difficulty, elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days, reps: row.reps, lapses: row.lapses,
    fsrs_state: row.fsrs_state, last_review: row.last_review },
  2,
  new Date(NOW.getTime() + first * DAY)
);
assert.ok(row.scheduled_days >= first, `aralık büyümeli: ${first} -> ${row.scheduled_days}`);
assert.ok(row.reps > 1, "reps artmalı");

// unutma lapses sayacini artirmali
const lapsed = schedule(
  { stability: 10, difficulty: 5, elapsed_days: 10, scheduled_days: 10,
    reps: 3, lapses: 0, fsrs_state: State.Review, last_review: NOW.getTime() - 10 * DAY },
  0,
  NOW
);
assert.equal(lapsed.lapses, 1, "Tekrar denildiğinde lapses artmalı");

// alanlar D1'e yazilabilir tipte olmali (NaN/undefined yazilirsa satir bozulur)
for (const [k, v] of Object.entries(good)) {
  assert.ok(typeof v === "number" && Number.isFinite(v), `${k} sonlu sayı olmalı, ${v} geldi`);
}

console.log(
  `srs: Tekrar +${((again.next_review - NOW.getTime()) / 60000).toFixed(0)}dk · ` +
  `İyi +${good.scheduled_days}g · Kolay +${easy.scheduled_days}g — kontroller geçti`
);
