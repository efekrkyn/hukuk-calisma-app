/**
 * Yakın-tekrar tespiti.
 *
 * Soru üretimi alan başına parti parti çalıştığı ve model bankada ne
 * olduğunu bilmediği için neredeyse birebir aynı soru birden fazla üretilebiliyor
 * (denetimde Medeni Hukuk'ta aynı soru 3 kez çıktı, %97-98 benzerlik).
 *
 * Worker'da ağır bir benzerlik kütüphanesi taşımak istemiyoruz; kelime kümesi
 * üzerinden Jaccard yeterli: bu sorular birkaç kelime dışında aynı.
 */

function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLocaleLowerCase("tr")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

/** Jaccard benzerliği 0..1 */
export function similarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;

  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;

  return inter / (ta.size + tb.size - inter);
}

/**
 * Eşik gerçek bankadan ölçüldü: tekrar çiftleri 0.61 ve 0.94, farklı sorular
 * en fazla 0.33 aldı. 0.5 aradaki boşlukta duruyor — tekrarları yakalarken
 * aynı konudaki ayrı soruları elemiyor.
 */
export function isNearDuplicate(a: string, b: string, threshold = 0.5): boolean {
  return similarity(a, b) >= threshold;
}
