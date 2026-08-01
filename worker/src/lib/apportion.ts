/**
 * Oransal paylaştırma (en büyük kalan / Hare yöntemi).
 *
 * Alan başına `round(pay)` almak toplamı tutturmuyor: 20 alana 20 soru
 * dağıtırken her alana en az 1 vermek 26 soru üretiyordu — UI "20 soru" deyip
 * sayacı ona göre kurarken. Tam sayı paylar önce aşağı yuvarlanır, artan
 * kontenjan en büyük kesirli kalana sahip alanlara birer birer dağıtılır.
 */
export function apportion(weights: number[], total: number): number[] {
  const sum = weights.reduce((a, w) => a + w, 0);
  if (sum <= 0 || total <= 0) return weights.map(() => 0);

  const exact = weights.map((w) => (w / sum) * total);
  const base = exact.map(Math.floor);
  let left = total - base.reduce((a, n) => a + n, 0);

  const order = exact
    .map((e, i) => ({ i, frac: e - Math.floor(e) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);

  for (let k = 0; left > 0; k++, left--) {
    base[order[k % order.length].i]++;
  }

  return base;
}
