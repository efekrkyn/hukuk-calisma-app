/**
 * HMGS resmî soru dağılımı.
 *
 * Kaynak: ÖSYM 2025-HMGS/2 Kılavuzu s.4-5 — "Sınavlar test şeklinde olup
 * çoktan seçmeli 120 sorudan oluşacaktır" + alanlara göre yüzdeler.
 * Geçme notu: 100 üzerinden en az 70.
 *
 * `ragCourse`, Vectorize'daki course metadata'sına karşılık gelir; soru
 * üretiminde retrieval bu alanla filtrelenir. Kanun metinlerinin tamamı
 * "kanunlar" course'u altında olduğu için çoğu alan oraya bakar — ayrım
 * `topic` ile sorgu düzeyinde yapılır.
 */

export type HmgsSubject = {
  id: string;
  name: string;
  /** Kılavuzdaki yüzde */
  percent: number;
  /** 120 soruluk denemede kaç soru */
  count: number;
  /** Retrieval sorgusuna eklenecek konu ipucu */
  topic: string;
  /**
   * Alanın dayandığı kanun dosyaları (R2 key parçası). Retrieval "kanunlar"
   * course'unda 23 ayrı kanun barındırdığı için alan bazlı çapa şart: bu
   * olmadan CMK sorusu Avukatlık Kanunu'ndan üretilebiliyor.
   * Boş dizi + ragCourse verilmişse: kanun değil doktrin konusu (Hukuk
   * Felsefesi, Milletlerarası Hukuk, Genel Kamu) — makale korpusundan beslenir.
   */
  lawFiles: string[];
  /**
   * Retrieval hangi course'dan çekecek. Varsayılan "kanunlar"; doktrin
   * konuları için "hmgs_ozet" (AUHFD/TBB makaleleri).
   */
  ragCourse?: string;
};

export const HMGS_TOTAL_QUESTIONS = 120;
export const HMGS_PASS_SCORE = 70;

export const HMGS_SUBJECTS: HmgsSubject[] = [
  { id: "anayasa", name: "Anayasa Hukuku", percent: 5, count: 6, topic: "1982 Anayasası temel hak ve hürriyetler, yasama yürütme yargı", lawFiles: ["anayasa.pdf"] },
  { id: "anayasa_yargisi", name: "Anayasa Yargısı", percent: 2.5, count: 3, topic: "Anayasa Mahkemesi, iptal davası, bireysel başvuru", lawFiles: ["anayasa-mahkemesi-6216.md", "anayasa.pdf"] },
  { id: "idare", name: "İdare Hukuku", percent: 5, count: 6, topic: "idari işlem, idari sözleşme, kamu görevlileri, idarenin sorumluluğu", lawFiles: ["devlet-memurlari-657.md", "kamulastirma-2942.md", "imar-3194.md", "idari-yargilama-2577.pdf"] },
  { id: "idari_yargilama", name: "İdari Yargılama Usulü", percent: 2.5, count: 3, topic: "İYUK 2577 iptal ve tam yargı davası, süreler, yürütmenin durdurulması", lawFiles: ["idari-yargilama-2577.pdf"] },
  { id: "medeni", name: "Medeni Hukuk", percent: 12.5, count: 15, topic: "TMK kişiler, aile, miras, eşya hukuku", lawFiles: ["medeni-kanun-4721.pdf"] },
  { id: "borclar", name: "Borçlar Hukuku", percent: 10, count: 12, topic: "TBK genel hükümler, sözleşme, haksız fiil, sebepsiz zenginleşme", lawFiles: ["borclar-kanunu-6098.pdf"] },
  { id: "ticaret", name: "Ticaret Hukuku", percent: 10, count: 12, topic: "TTK ticari işletme, şirketler, kıymetli evrak", lawFiles: ["ticaret-kanunu-6102.pdf", "tuketici-6502.pdf"] },
  { id: "hukuk_yargilama", name: "Hukuk Yargılama Usulü", percent: 10, count: 12, topic: "HMK 6100 görev yetki, dava şartları, deliller, kanun yolları", lawFiles: ["hukuk-muhakemeleri-6100.pdf"] },
  { id: "icra_iflas", name: "İcra ve İflas Hukuku", percent: 5, count: 6, topic: "İİK 2004 ilamsız icra, haciz, iflas, konkordato", lawFiles: ["icra-iflas-2004.pdf"] },
  { id: "ceza", name: "Ceza Hukuku", percent: 7.5, count: 9, topic: "TCK genel hükümler, suçun unsurları, özel hükümler", lawFiles: ["ceza-kanunu-5237.pdf"] },
  { id: "ceza_yargilama", name: "Ceza Yargılama Usulü", percent: 5, count: 6, topic: "CMK 5271 soruşturma kovuşturma, koruma tedbirleri, kanun yolları", lawFiles: ["ceza-muhakemesi-5271.pdf", "fsek-5846.md"] },
  { id: "is_sosyal_guvenlik", name: "İş ve Sosyal Güvenlik Hukuku", percent: 5, count: 6, topic: "4857 iş sözleşmesi, fesih, kıdem ihbar tazminatı, 5510 sigortalılık", lawFiles: ["is-kanunu-4857.pdf", "sosyal-sigortalar-5510.pdf", "sendika-6356.pdf"] },
  { id: "vergi", name: "Vergi Hukuku", percent: 2.5, count: 3, topic: "vergilendirme ilkeleri, vergi borcu, vergi suç ve cezaları", lawFiles: ["gelir-vergisi-193.md", "katma-deger-vergisi-3065.md", "amme-alacaklari-6183.md", "vergi-usul-213.pdf"] },
  { id: "vergi_usul", name: "Vergi Usul Hukuku", percent: 2.5, count: 3, topic: "VUK 213 tarh tebliğ tahakkuk tahsil, defter belge, süreler", lawFiles: ["vergi-usul-213.pdf", "amme-alacaklari-6183.md"] },
  { id: "avukatlik", name: "Avukatlık Hukuku", percent: 2.5, count: 3, topic: "1136 Avukatlık Kanunu, meslek kuralları, disiplin, vekalet", lawFiles: ["avukatlik-1136.pdf"] },
  { id: "felsefe_sosyoloji", name: "Hukuk Felsefesi ve Sosyolojisi", percent: 2.5, count: 3, topic: "doğal hukuk, pozitivizm, adalet kuramları, hukuk sosyolojisi", lawFiles: [], ragCourse: "hmgs_ozet" },
  { id: "hukuk_tarihi", name: "Türk Hukuk Tarihi", percent: 2.5, count: 3, topic: "İslam-Osmanlı hukuku, Mecelle, Tanzimat, Cumhuriyet dönemi resepsiyon", lawFiles: ["TBB_turk_hukuk_tarihi"] },
  { id: "milletlerarasi", name: "Milletlerarası Hukuk", percent: 2.5, count: 3, topic: "devletler hukuku, andlaşmalar, uluslararası yargı organları", lawFiles: [], ragCourse: "hmgs_ozet" },
  { id: "milletlerarasi_ozel", name: "Milletlerarası Özel Hukuk", percent: 2.5, count: 3, topic: "MÖHUK 5718 kanunlar ihtilafı, yetki, tanıma tenfiz", lawFiles: ["mohuk-5718.pdf"] },
  { id: "genel_kamu", name: "Genel Kamu Hukuku", percent: 2.5, count: 3, topic: "devlet kuramı, egemenlik, insan hakları kuramı", lawFiles: [], ragCourse: "hmgs_ozet" },
];

export function getSubject(id: string): HmgsSubject | undefined {
  return HMGS_SUBJECTS.find((s) => s.id === id);
}
