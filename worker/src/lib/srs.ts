/**
 * FSRS tabanlı tekrar planlama.
 *
 * Önceki hâli basitleştirilmiş SM-2 idi: interval = interval × ease. Tek
 * çarpan hafızayı modellemiyor — zor ama iyi hatırlanan kartla kolay ama
 * yeni öğrenilen kartı ayıramıyordu. FSRS stabilite (ne kadar dayanır) ve
 * zorluk (ne kadar zahmetli) değerlerini ayrı tutuyor.
 *
 * Not derecelendirmesi 4'e çıktı; arayüz 3 buton gönderiyordu (0/1/2),
 * geriye dönük uyum için ikisi de kabul ediliyor.
 */
import { fsrs, generatorParameters, createEmptyCard, Rating, State, type Card, type Grade } from "ts-fsrs";

const scheduler = fsrs(generatorParameters({ enable_fuzz: true }));

export type StoredSrs = {
  stability: number | null;
  difficulty: number | null;
  elapsed_days: number | null;
  scheduled_days: number | null;
  reps: number | null;
  lapses: number | null;
  fsrs_state: number | null;
  last_review: number | null;
};

/** 0=Tekrar 1=Zor 2=İyi 3=Kolay → FSRS Rating */
export function toRating(grade: number): Grade {
  switch (grade) {
    case 0:
      return Rating.Again;
    case 1:
      return Rating.Hard;
    case 3:
      return Rating.Easy;
    default:
      return Rating.Good;
  }
}

/** D1 satırını FSRS kartına çevirir; kayıt yoksa/eksikse yeni kart üretir. */
export function toCard(row: StoredSrs | null, now: Date): Card {
  if (!row || row.stability == null || row.difficulty == null) {
    return createEmptyCard(now);
  }
  return {
    due: now,
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsed_days ?? 0,
    scheduled_days: row.scheduled_days ?? 0,
    reps: row.reps ?? 0,
    lapses: row.lapses ?? 0,
    state: (row.fsrs_state ?? State.New) as State,
    last_review: row.last_review ? new Date(row.last_review) : undefined,
  } as Card;
}

export type ScheduleResult = {
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  fsrs_state: number;
  next_review: number;
  last_review: number;
};

export function schedule(row: StoredSrs | null, grade: number, now = new Date()): ScheduleResult {
  const card = toCard(row, now);
  const next = scheduler.next(card, now, toRating(grade)).card;

  return {
    stability: next.stability,
    difficulty: next.difficulty,
    elapsed_days: next.elapsed_days,
    scheduled_days: next.scheduled_days,
    reps: next.reps,
    lapses: next.lapses,
    fsrs_state: next.state,
    next_review: next.due.getTime(),
    last_review: now.getTime(),
  };
}
