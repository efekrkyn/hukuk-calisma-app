/**
 * Hareket ön ayarları — apple-design ilkelerine göre.
 *
 * Temel fikir: hareket süreyle değil YAY ile tanımlanır, çünkü yay her an
 * kesintiye uğrayabilir ve yeni hedefe mevcut hızını taşıyarak geçer.
 * Sabit süreli CSS transition'ı yarıda yakalayıp ters çeviremezsin.
 *
 * Sönümleme (damping) taşmayı belirler:
 *   1.0 = kritik sönümleme, taşma yok — arayüzün varsayılanı olmalı
 *   0.8 = hafif taşma — YALNIZCA jest momentum taşıyorsa (fırlatma, sürükleme)
 *
 * Motion kütüphanesinde `bounce` Apple'ın damping'inin tersi:
 *   damping 1.0 → bounce 0 · damping 0.8 → bounce ~0.2
 */

import type { Transition } from "motion/react";

/** Varsayılan: taşmasız, zarif. Menü, kart, sayfa geçişi. */
export const spring: Transition = { type: "spring", bounce: 0, duration: 0.4 };

/** Hızlı geri bildirim — basma, seçim. */
export const springSnappy: Transition = { type: "spring", bounce: 0, duration: 0.25 };

/**
 * Momentumlu: yalnızca jest hız taşıdığında. Fade ile açılan bir menüde
 * taşma yanlış hissettirir; fırlatılan bir kartta doğru.
 */
export const springBouncy: Transition = { type: "spring", bounce: 0.2, duration: 0.4 };

/** Sayfa/panel — sheet davranışı (Apple: damping 0.8, response 0.3). */
export const springSheet: Transition = { type: "spring", bounce: 0.15, duration: 0.3 };

/**
 * Azalan hareketi tercih edenler için: yay yerine kısa çapraz geçiş.
 * "Hareket yok" demek değil — vestibüler olmayan eşdeğeri.
 */
export const reducedMotion: Transition = { duration: 0.15, ease: "easeOut" };

/**
 * Momentum projeksiyonu — jestin NEREYE gittiğini hesaplar.
 *
 * Bırakma noktasına en yakın hedefe kenetlemek fırlatma hissini öldürür;
 * hızdan varış noktasını kestirip ona en yakın hedefe gitmek gerekiyor.
 * Apple'ın örnek kodundaki üstel sönüm biçimi (v²/2a DEĞİL).
 */
export function project(initialVelocity: number, decelerationRate = 0.998): number {
  return ((initialVelocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/**
 * Lastik bant — sınırda sert durmak yerine artan direnç.
 * Sert duruş "dondu" diye okunur; direnç "buraya kadar" diye.
 */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
