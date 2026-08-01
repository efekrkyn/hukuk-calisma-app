/**
 * Şık karıştırma.
 *
 * Üretilen bankada doğru cevap dağılımı A=22 B=52 C=32 D=5 çıktı (beklenen
 * ~28). "Hep B" stratejisi %47 tutturuyordu — ezberlenebilir, gerçek sınavda
 * karşılığı olmayan bir örüntü. Deneme kurulurken karıştırmak hem mevcut
 * soruları hem gelecektekileri düzeltir, yeniden üretim gerektirmez.
 */
export function shuffleOptions<T extends { options: string[]; correctAnswer: number }>(
  q: T,
  rand: () => number = Math.random
): T {
  const idx = q.options.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return {
    ...q,
    options: idx.map((i) => q.options[i]),
    correctAnswer: idx.indexOf(q.correctAnswer),
  };
}
