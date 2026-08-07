"use client";

/**
 * Sınava kalan gün.
 *
 * Tarih zaten çalışma planının formunda duruyordu ama yalnızca /plan
 * sayfasında görünüyordu. Hazırlıkta en çok motive eden sayı bu; her
 * açılışta görülen yerde olmalı.
 *
 * Plan yoksa hiçbir şey göstermiyor — "sınav tarihi belirsiz" demek
 * boşluğu doldurmaz, sadece gürültü ekler.
 */

import { useEffect, useState } from "react";

export function ExamCountdown() {
  const [gun, setGun] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/worker/plan/active")
      .then((r) => r.json())
      .then((d) => {
        const tarih = d?.plan?.form_input?.exam_date;
        if (!tarih) return;
        // Gün farkı UTC gün başlarından hesaplanıyor: yerel saat dilimiyle
        // hesaplayınca gece yarısı civarı bir gün oynuyordu.
        const hedef = Date.parse(`${tarih}T00:00:00Z`);
        if (Number.isNaN(hedef)) return;
        const bugun = new Date();
        const bugunUTC = Date.UTC(
          bugun.getFullYear(),
          bugun.getMonth(),
          bugun.getDate()
        );
        setGun(Math.round((hedef - bugunUTC) / 86400000));
      })
      .catch(() => setGun(null));
  }, []);

  if (gun === null || gun < 0) return null;

  return (
    <span className="text-sm text-muted-foreground">
      {" · "}
      <span className="nums-tabular font-semibold text-foreground">
        {gun === 0 ? "Sınav bugün" : `${gun} gün`}
      </span>
      {gun > 0 && " kaldı"}
    </span>
  );
}
