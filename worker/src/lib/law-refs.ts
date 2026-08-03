/**
 * Açıklama metninden kanun referansı çıkarır.
 *
 * Denetimde "unsupported" kalan soruların çoğu korpusta OLMAYAN kanunlara
 * dayanıyordu (FSEK m.75, Avukatlık Kanunu m.58). Referansı çıkarıp canlı
 * mevzuattan çekebilmek için önce hangi kanun olduğunu bilmek gerekiyor.
 */

/** Yaygın kısaltma → kanun numarası. Sadece HMGS kapsamındakiler. */
const ABBREV: Record<string, string> = {
  tbk: "6098",
  tmk: "4721",
  ttk: "6102",
  hmk: "6100",
  cmk: "5271",
  tck: "5237",
  iik: "2004",
  "i̇i̇k": "2004",
  iyuk: "2577",
  "i̇yuk": "2577",
  vuk: "213",
  mohuk: "5718",
  möhuk: "5718",
  fsek: "5846",
  aatuhk: "6183",
};

/** Kanun ADI geçiyorsa numarası. */
const BY_NAME: Array<[RegExp, string]> = [
  [/avukatlık kanunu/i, "1136"],
  [/türk borçlar kanunu/i, "6098"],
  [/türk meden[iî] kanunu/i, "4721"],
  [/türk ticaret kanunu/i, "6102"],
  [/hukuk muhakemeleri kanunu/i, "6100"],
  [/ceza muhakemesi kanunu/i, "5271"],
  [/türk ceza kanunu/i, "5237"],
  [/icra ve iflas kanunu/i, "2004"],
  [/idari yargılama usulü kanunu/i, "2577"],
  [/vergi usul kanunu/i, "213"],
  [/iş kanunu/i, "4857"],
  [/sendikalar/i, "6356"],
  [/fikir ve sanat eserleri kanunu/i, "5846"],
];

export type LawRef = { mevzuatNo: string; madde: string | null };

export function extractLawRefs(text: string): LawRef[] {
  const found = new Map<string, string | null>();

  const remember = (no: string, madde: string | null) => {
    // Aynı kanun birden çok geçerse madde bilgisi olanı tut.
    if (!found.has(no) || (found.get(no) === null && madde !== null)) {
      found.set(no, madde);
    }
  };

  // "5510 sayılı Kanun'un 80. maddesi" / "5271 sayılı ... m.100"
  const numbered = /(\d{3,5})\s*say[ıi]l[ıi][^.;]{0,60}?(?:m\.?\s*(\d+)|(\d+)\s*\.\s*madde)/gi;
  for (const m of text.matchAll(numbered)) {
    remember(m[1], m[2] ?? m[3] ?? null);
  }
  // madde bilgisi olmadan sadece "NNNN sayılı Kanun"
  for (const m of text.matchAll(/(\d{3,5})\s*say[ıi]l[ıi]\s*kanun/gi)) {
    remember(m[1], null);
  }

  // "TBK m.49", "CMK m. 100", "FSEK m.75"
  // \b kullanılamaz: JS'te \b ASCII tabanlı, "İ" kelime karakteri sayılmıyor
  // ve İYUK/İİK gibi kısaltmalar sessizce kaçıyordu. Unicode harf lookbehind.
  const abbrevPat =
    /(?<!\p{L})(TBK|TMK|TTK|HMK|CMK|TCK|İİK|IIK|İYUK|IYUK|VUK|MÖHUK|MOHUK|FSEK|AATUHK)\s*(?:m\.?|madde)\s*(\d+)/giu;
  for (const m of text.matchAll(abbrevPat)) {
    const no = ABBREV[m[1].toLocaleLowerCase("tr")];
    if (no) remember(no, m[2]);
  }

  // Kanun adıyla: "Avukatlık Kanunu m.58"
  for (const [pat, no] of BY_NAME) {
    const idx = text.search(pat);
    if (idx === -1) continue;
    const after = text.slice(idx, idx + 120);
    const mm = /(?:m\.?\s*|madde\s*)(\d+)/i.exec(after);
    remember(no, mm ? mm[1] : null);
  }

  return Array.from(found, ([mevzuatNo, madde]) => ({ mevzuatNo, madde }));
}
