/**
 * Türkiye Cumhuriyeti'nde yürürlükteki temel kanunların manifest'i.
 *
 * Her kanun için:
 *  - slug: URL parça (latinize, kısa)
 *  - name: Tam kanun adı
 *  - number: Kanun numarası (sayısı)
 *  - year: Kabul / yürürlük yılı
 *  - emoji: UI'da görünür
 *  - description: Kısa açıklama (2-3 cümle)
 *  - r2_key: R2 bucket'taki PDF anahtarı (dersler/kanunlar/<file>.pdf)
 *  - category: Gruplama için
 */

export type LawCategory =
  | "anayasal"
  | "medeni"
  | "ceza"
  | "ticaret"
  | "is"
  | "vergi"
  | "usul"
  | "ozel";

export type Law = {
  slug: string;
  name: string;
  number: string;
  year: number;
  emoji: string;
  description: string;
  r2_key: string;
  category: LawCategory;
};

export const LAWS: Law[] = [
  {
    slug: "anayasa",
    name: "Türkiye Cumhuriyeti Anayasası",
    number: "—",
    year: 1982,
    emoji: "🇹🇷",
    description:
      "Türkiye Cumhuriyeti'nin temel kuruluş belgesi. Devletin nitelikleri, temel hak ve özgürlükler, yasama-yürütme-yargı kuvvetlerinin yapısı. Tüm diğer kanunların üzerinde, en üst hukuk normu.",
    r2_key: "dersler/kanunlar/anayasa.pdf",
    category: "anayasal",
  },
  {
    slug: "tbk",
    name: "Türk Borçlar Kanunu",
    number: "6098",
    year: 2011,
    emoji: "📜",
    description:
      "Sözleşmeler, haksız fiil, sebepsiz zenginleşme; satım, kira, vekalet, eser, hizmet vb. tüm özel hukuk borç ilişkilerinin temel kaynağı. 1926'daki eski BK'nın yerini aldı.",
    r2_key: "dersler/kanunlar/borclar-kanunu-6098.pdf",
    category: "medeni",
  },
  {
    slug: "tmk",
    name: "Türk Medeni Kanunu",
    number: "4721",
    year: 2001,
    emoji: "⚖️",
    description:
      "Kişiler, aile, miras ve eşya hukukunun temel kaynağı. Doğum, evlilik, boşanma, vesayet, mülkiyet, zilyetlik, miras paylaşımı vb. konuları düzenler. İsviçre Medeni Kanunu kökenli.",
    r2_key: "dersler/kanunlar/medeni-kanun-4721.pdf",
    category: "medeni",
  },
  {
    slug: "tck",
    name: "Türk Ceza Kanunu",
    number: "5237",
    year: 2004,
    emoji: "🚨",
    description:
      "Suç ve cezaların temel kaynağı. Genel hükümler (kasıt, taksir, iştirak, içtima) ve özel hükümler (kasten öldürme, hırsızlık, dolandırıcılık, cinsel suçlar, devlete karşı suçlar). 765 sayılı eski TCK'nın yerini aldı.",
    r2_key: "dersler/kanunlar/ceza-kanunu-5237.pdf",
    category: "ceza",
  },
  {
    slug: "cmk",
    name: "Ceza Muhakemesi Kanunu",
    number: "5271",
    year: 2004,
    emoji: "🔎",
    description:
      "Ceza yargılamasının usulü: soruşturma, kovuşturma, tutuklama, koruma tedbirleri, deliller, kanun yolları. CMUK'un (1412 sayılı) yerine geldi.",
    r2_key: "dersler/kanunlar/ceza-muhakemesi-5271.pdf",
    category: "usul",
  },
  {
    slug: "hmk",
    name: "Hukuk Muhakemeleri Kanunu",
    number: "6100",
    year: 2011,
    emoji: "🏛️",
    description:
      "Hukuk davalarının usulü: görev, yetki, dava açma, ispat, hüküm, istinaf, temyiz, ihtiyati tedbir. 1086 sayılı HUMK'un yerine geldi.",
    r2_key: "dersler/kanunlar/hukuk-muhakemeleri-6100.pdf",
    category: "usul",
  },
  {
    slug: "ttk",
    name: "Türk Ticaret Kanunu",
    number: "6102",
    year: 2011,
    emoji: "🏢",
    description:
      "Ticari işletme, ticaret şirketleri (AŞ, limited, kollektif, komandit), kıymetli evrak (bono, çek, poliçe), taşıma, deniz ticareti ve sigorta hukuku. 6762 sayılı eski TTK'nın yerine geldi.",
    r2_key: "dersler/kanunlar/ticaret-kanunu-6102.pdf",
    category: "ticaret",
  },
  {
    slug: "ik",
    name: "İş Kanunu",
    number: "4857",
    year: 2003,
    emoji: "👷",
    description:
      "İşçi-işveren ilişkilerinin temel kaynağı: iş sözleşmesi, fesih, ihbar, kıdem tazminatı, çalışma süreleri, fazla mesai, yıllık izin, iş güvencesi. 1475 sayılı eski İş Kanunu'nun (kıdem tazminatı dışında) yerine geldi.",
    r2_key: "dersler/kanunlar/is-kanunu-4857.pdf",
    category: "is",
  },
  {
    slug: "iik",
    name: "İcra ve İflas Kanunu",
    number: "2004",
    year: 1932,
    emoji: "📋",
    description:
      "Para alacaklarının cebren tahsili (ilamsız/ilamlı icra, haciz, satış), iflas ve konkordato. En eski yürürlükteki kanunlarımızdan, defalarca değiştirilerek günümüze ulaştı.",
    r2_key: "dersler/kanunlar/icra-iflas-2004.pdf",
    category: "usul",
  },
  {
    slug: "iyuk",
    name: "İdari Yargılama Usulü Kanunu",
    number: "2577",
    year: 1982,
    emoji: "🏛️",
    description:
      "Danıştay, bölge idare mahkemeleri ve idare/vergi mahkemelerinde idari davaların usulü: iptal davası, tam yargı davası, yürütmenin durdurulması, kanun yolları.",
    r2_key: "dersler/kanunlar/idari-yargilama-2577.pdf",
    category: "usul",
  },
  {
    slug: "mohuk",
    name: "Milletlerarası Özel Hukuk ve Usul Hukuku Kanunu",
    number: "5718",
    year: 2007,
    emoji: "🌍",
    description:
      "Yabancı unsurlu özel hukuk uyuşmazlıklarında uygulanacak hukuk (kanunlar ihtilafı) ve yabancı mahkeme kararlarının tanınması/tenfizi. 2675 sayılı eski MÖHUK'un yerine geldi.",
    r2_key: "dersler/kanunlar/mohuk-5718.pdf",
    category: "ozel",
  },
  {
    slug: "vuk",
    name: "Vergi Usul Kanunu",
    number: "213",
    year: 1961,
    emoji: "💰",
    description:
      "Vergilendirmenin genel usulü: tarh, tebliğ, tahakkuk, tahsil, vergi incelemesi, ceza, uzlaşma, vergi suçları. Tüm vergi kanunlarının çatısı.",
    r2_key: "dersler/kanunlar/vergi-usul-213.pdf",
    category: "vergi",
  },
  {
    slug: "avukatlik",
    name: "Avukatlık Kanunu",
    number: "1136",
    year: 1969,
    emoji: "👨‍⚖️",
    description:
      "Avukatlık mesleğinin nitelikleri, ruhsata kabul, baro, görev ve sorumluluklar, disiplin. Hukuk fakültesi mezunlarının meslek yaşamını düzenler.",
    r2_key: "dersler/kanunlar/avukatlik-1136.pdf",
    category: "ozel",
  },
  {
    slug: "fsek",
    name: "Fikir ve Sanat Eserleri Kanunu",
    number: "5846",
    year: 1951,
    emoji: "🎨",
    description:
      "Telif hakları: ilim-edebiyat, musiki, güzel sanatlar ve sinema eserleri üzerinde maddi/manevi haklar. Eser sahibinin korunması, intifa ve devir, ihlal yaptırımları.",
    r2_key: "dersler/kanunlar/fsek-5846.pdf",
    category: "ozel",
  },
  {
    slug: "sendika",
    name: "Sendikalar ve Toplu İş Sözleşmesi Kanunu",
    number: "6356",
    year: 2012,
    emoji: "🤝",
    description:
      "İşçi-işveren sendikaları, üyelik, yetki, toplu iş sözleşmesi, grev ve lokavt. 2821 ve 2822 sayılı eski iki kanunu tek çatıda birleştirdi.",
    r2_key: "dersler/kanunlar/sendika-6356.pdf",
    category: "is",
  },
  {
    slug: "tkhk",
    name: "Tüketicinin Korunması Hakkında Kanun",
    number: "6502",
    year: 2013,
    emoji: "🛍️",
    description:
      "Tüketici sözleşmeleri (taksitli, mesafeli, kapıdan, paket tur, devre tatil), ayıplı mal/hizmet, haksız şart, tüketici hakem heyetleri ve tüketici mahkemeleri. 4077 sayılı eski TKHK'nın yerine geldi.",
    r2_key: "dersler/kanunlar/tuketici-6502.pdf",
    category: "ticaret",
  },
];

export const lawBySlug = (slug: string): Law | undefined =>
  LAWS.find((l) => l.slug === slug);

export const lawsByCategory = (category: LawCategory): Law[] =>
  LAWS.filter((l) => l.category === category);

export const CATEGORY_NAMES: Record<LawCategory, string> = {
  anayasal: "Anayasal",
  medeni: "Medeni Hukuk",
  ceza: "Ceza Hukuku",
  ticaret: "Ticaret & Tüketici",
  is: "İş & Sendika",
  vergi: "Vergi",
  usul: "Usul Kanunları",
  ozel: "Diğer Özel Kanunlar",
};
