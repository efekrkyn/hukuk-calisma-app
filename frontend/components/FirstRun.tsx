"use client";

/**
 * Hiç deneme çözmemiş kullanıcıya sırayı gösterir.
 *
 * NEDEN GEREKLİ: Yeni kullanıcıda performans kartı tamamen gizleniyor
 * (gösterecek veri yok), tekrar kuyruğu boş, plan yok. Geriye soru bankası
 * sayısı ve alan listesi kalıyor — nereden başlanacağı hiçbir yerde
 * yazmıyor.
 *
 * NEDEN ÖNCE DENEME, SONRA PLAN: Plan, alan ağırlığını ZAYIFLIKLA çarparak
 * saat dağıtıyor. Hiç ölçüm yoksa her alan 1.5 katsayısı alıyor, yani plan
 * sınav ağırlığından ibaret kalıyor. Bir deneme sonrası aynı plan gerçekten
 * kişiselleşiyor.
 */

import Link from "next/link";
import { motion } from "motion/react";
import { spring } from "@/lib/motion";

const ADIMLAR = [
  {
    n: 1,
    baslik: "Kısa bir deneme çöz",
    aciklama: "20 soru, 26 dakika. Hangi alanlarda zayıf olduğun ölçülsün.",
    href: "/hmgs?count=20",
    cta: "Denemeye başla",
  },
  {
    n: 2,
    baslik: "Planını oluştur",
    aciklama: "Alan ağırlıkları ve ölçülen zayıflığına göre saat dağıtılır.",
    href: "/plan/setup",
    cta: null,
  },
  {
    n: 3,
    baslik: "Çalış ve tekrar et",
    aciklama: "Konu anlatımını oku, soru çöz; bilemediklerin tekrar kuyruğuna düşer.",
    href: "/konular",
    cta: null,
  },
];

export function FirstRun({ hidden }: { hidden: boolean }) {
  if (hidden) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="material-thin rounded-2xl p-5 space-y-4"
    >
      <div>
        <h2 className="type-title">Buradan başla</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Sınava kadar izleyeceğin döngü üç adım.
        </p>
      </div>

      <ol className="space-y-3">
        {ADIMLAR.map((a) => (
          <li key={a.n} className="flex gap-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-primary/12 text-primary text-xs grid place-items-center nums-tabular mt-0.5">
              {a.n}
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium">{a.baslik}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {a.aciklama}
              </p>
              {a.cta && (
                <Link
                  href={a.href}
                  className="inline-block mt-1.5 text-sm text-primary"
                >
                  {a.cta} →
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>
    </motion.section>
  );
}
