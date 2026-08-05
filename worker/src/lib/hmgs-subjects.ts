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
  /**
   * Alt konular — üretimde rastgele biri seçilip retrieval sorgusuna konur.
   *
   * Sabit sorgu hep aynı kanun parçalarını getiriyordu: Borçlar'da 46 soru
   * yalnızca 13 farklı kaynaktan üretilmişti, aynı maddeler dönüp duruyordu.
   * Alt konu rotasyonu kanunun farklı yerlerine dağıtıyor.
   */
  subtopics?: string[];
};

export const HMGS_TOTAL_QUESTIONS = 120;
export const HMGS_PASS_SCORE = 70;

export const HMGS_SUBJECTS: HmgsSubject[] = [
  { id: "anayasa", name: "Anayasa Hukuku", percent: 5, count: 6, topic: "1982 Anayasası temel hak ve hürriyetler, yasama yürütme yargı", lawFiles: ["anayasa.pdf"], subtopics: ["temel hak ve hürriyetlerin sınırlanması", "yasama dokunulmazlığı ve TBMM", "cumhurbaşkanı yetkileri ve kararname", "yargı bağımsızlığı ve hâkimlik teminatı", "olağanüstü hâl rejimi", "seçme seçilme ve siyasi partiler", "eşitlik ilkesi ve ayrımcılık yasağı", "sosyal ve ekonomik haklar"] },
  { id: "anayasa_yargisi", name: "Anayasa Yargısı", percent: 2.5, count: 3, topic: "Anayasa Mahkemesi, iptal davası, bireysel başvuru", lawFiles: ["anayasa-mahkemesi-6216.md", "anayasa.pdf"], subtopics: ["iptal davası şartları ve süre", "bireysel başvuru kabul edilebilirlik", "itiraz yolu somut norm denetimi", "AYM kararlarının bağlayıcılığı ve yürürlük", "siyasi parti kapatma", "Yüce Divan sıfatı"] },
  { id: "idare", name: "İdare Hukuku", percent: 5, count: 6, topic: "idari işlem, idari sözleşme, kamu görevlileri, idarenin sorumluluğu", lawFiles: ["devlet-memurlari-657.md", "kamulastirma-2942.md", "imar-3194.md", "idari-yargilama-2577.pdf"], subtopics: ["idari işlemin unsurları ve sakatlık", "kamu görevlileri disiplin ve sorumluluk", "kamulaştırma usulü ve bedel", "imar planları ve ruhsat", "idarenin kusursuz sorumluluğu", "kamu ihalesi ve idari sözleşme", "memur atama ve özlük hakları"] },
  { id: "idari_yargilama", name: "İdari Yargılama Usulü", percent: 2.5, count: 3, topic: "İYUK 2577 iptal ve tam yargı davası, süreler, yürütmenin durdurulması", lawFiles: ["idari-yargilama-2577.pdf"], subtopics: ["iptal davası ve menfaat", "tam yargı davası ve zarar", "dava açma süreleri ve durması", "yürütmenin durdurulması şartları", "görev ve yetki kuralları", "istinaf ve temyiz", "ilk inceleme ve dilekçe reddi"] },
  { id: "medeni", name: "Medeni Hukuk", percent: 12.5, count: 15, topic: "TMK kişiler, aile, miras, eşya hukuku", lawFiles: ["medeni-kanun-4721.pdf"], subtopics: ["kişiliğin korunması ve saldırı", "hısımlık ve velayet", "evlenme boşanma ve mal rejimi", "yasal mirasçılık ve saklı pay", "vasiyetname ve miras sözleşmesi", "zilyetlik ve tapu sicili", "mülkiyet ve sınırlı ayni haklar", "vesayet ve kısıtlılık"] },
  { id: "borclar", name: "Borçlar Hukuku", percent: 10, count: 12, topic: "TBK genel hükümler, sözleşme, haksız fiil, sebepsiz zenginleşme", lawFiles: ["borclar-kanunu-6098.pdf"], subtopics: ["sözleşmenin kurulması ve irade sakatlıkları", "haksız fiil ve kusursuz sorumluluk", "sebepsiz zenginleşme", "borçlunun temerrüdü ve sonuçları", "müteselsil borçluluk", "alacağın devri ve borcun üstlenilmesi", "zamanaşımı ve kesilmesi", "kira sözleşmesi ve tahliye", "eser ve vekâlet sözleşmesi", "satış sözleşmesi ve ayıp"] },
  { id: "ticaret", name: "Ticaret Hukuku", percent: 10, count: 12, topic: "TTK ticari işletme, şirketler, kıymetli evrak", lawFiles: ["ticaret-kanunu-6102.pdf", "tuketici-6502.pdf"], subtopics: ["ticari işletme ve tacir sıfatı", "anonim şirket yönetim kurulu", "limited şirket ortakların sorumluluğu", "genel kurul kararlarının iptali", "kambiyo senetleri ve poliçe", "çek ve karşılıksızlık", "haksız rekabet", "şirket birleşme ve bölünme", "tüketici işlemleri ve ayıplı mal"] },
  { id: "hukuk_yargilama", name: "Hukuk Yargılama Usulü", percent: 10, count: 12, topic: "HMK 6100 görev yetki, dava şartları, deliller, kanun yolları", lawFiles: ["hukuk-muhakemeleri-6100.pdf"], subtopics: ["görev ve yetki", "dava şartları ve ilk itirazlar", "ispat yükü ve deliller", "tanık ve bilirkişi", "ıslah ve dava değiştirme", "istinaf ve temyiz", "kesin hüküm ve maddi anlamda kesinlik", "ihtiyati tedbir", "basit yargılama usulü", "çekişmesiz yargı"] },
  { id: "icra_iflas", name: "İcra ve İflas Hukuku", percent: 5, count: 6, topic: "İİK 2004 ilamsız icra, haciz, iflas, konkordato", lawFiles: ["icra-iflas-2004.pdf"], subtopics: ["ilamsız icra ve ödeme emri", "itiraz ve itirazın kaldırılması", "haciz ve satış", "sıra cetveli ve rehin", "iflas yolları ve iflasın sonuçları", "konkordato", "istihkak davası", "icra ceza suçları"] },
  { id: "ceza", name: "Ceza Hukuku", percent: 7.5, count: 9, topic: "TCK genel hükümler, suçun unsurları, özel hükümler", lawFiles: ["ceza-kanunu-5237.pdf"], subtopics: ["suçun maddi ve manevi unsurları", "hukuka uygunluk sebepleri", "teşebbüs ve gönüllü vazgeçme", "iştirak türleri", "içtima kuralları", "hapis ve adli para cezası", "dava ve ceza zamanaşımı", "kasten öldürme ve yaralama", "hırsızlık yağma dolandırıcılık", "görevi kötüye kullanma ve rüşvet"] },
  { id: "ceza_yargilama", name: "Ceza Yargılama Usulü", percent: 5, count: 6, topic: "CMK 5271 soruşturma kovuşturma, koruma tedbirleri, kanun yolları", lawFiles: ["ceza-muhakemesi-5271.pdf", "fsek-5846.md"], subtopics: ["soruşturma ve kovuşturma evreleri", "şüpheli sanık hakları ve müdafi", "yakalama gözaltı tutuklama", "adli kontrol", "arama el koyma iletişimin denetlenmesi", "iddianame ve iadesi", "duruşma ve delillerin tartışılması", "istinaf temyiz ve kanun yararına bozma", "uzlaştırma ve seri muhakeme"] },
  { id: "is_sosyal_guvenlik", name: "İş ve Sosyal Güvenlik Hukuku", percent: 5, count: 6, topic: "4857 iş sözleşmesi, fesih, kıdem ihbar tazminatı, 5510 sigortalılık", lawFiles: ["is-kanunu-4857.pdf", "sosyal-sigortalar-5510.pdf", "sendika-6356.pdf"], subtopics: ["iş sözleşmesi türleri ve deneme süresi", "haklı ve geçerli nedenle fesih", "kıdem ve ihbar tazminatı", "işe iade davası", "fazla çalışma ve yıllık izin", "sendika özgürlüğü ve toplu sözleşme", "grev ve lokavt", "4a 4b 4c sigortalılık", "prime esas kazanç ve bildirim", "iş kazası ve meslek hastalığı"] },
  { id: "vergi", name: "Vergi Hukuku", percent: 2.5, count: 3, topic: "vergilendirme ilkeleri, vergi borcu, vergi suç ve cezaları", lawFiles: ["gelir-vergisi-193.md", "katma-deger-vergisi-3065.md", "amme-alacaklari-6183.md", "vergi-usul-213.pdf"], subtopics: ["verginin kanuniliği ilkesi", "gelir unsurları ve tam dar mükellefiyet", "katma değer vergisi konusu ve istisnalar", "vergiyi doğuran olay", "vergi cezaları ve kaçakçılık", "amme alacağının korunması ve haciz", "tecil taksitlendirme", "ödeme emri ve itiraz"] },
  { id: "vergi_usul", name: "Vergi Usul Hukuku", percent: 2.5, count: 3, topic: "VUK 213 tarh tebliğ tahakkuk tahsil, defter belge, süreler", lawFiles: ["vergi-usul-213.pdf", "amme-alacaklari-6183.md"], subtopics: ["tarh tebliğ tahakkuk tahsil", "defter ve belge düzeni", "vergi incelemesi ve arama", "re'sen ve ikmalen tarhiyat", "uzlaşma ve düzeltme", "vergi usul süreleri ve mücbir sebep", "değerleme ve amortisman"] },
  { id: "avukatlik", name: "Avukatlık Hukuku", percent: 2.5, count: 3, topic: "1136 Avukatlık Kanunu, meslek kuralları, disiplin, vekalet", lawFiles: ["avukatlik-1136.pdf"], subtopics: ["baroya kayıt ve levha", "avukatlık sözleşmesi ve ücret", "meslek kuralları ve reklam yasağı", "disiplin soruşturması ve cezaları", "avukatın yetkileri ve dosya inceleme", "staj ve ruhsat", "işin reddi ve çekilme"] },
  { id: "felsefe_sosyoloji", name: "Hukuk Felsefesi ve Sosyolojisi", percent: 2.5, count: 3, topic: "doğal hukuk, pozitivizm, adalet kuramları, hukuk sosyolojisi", lawFiles: [], ragCourse: "hmgs_ozet", subtopics: ["doğal hukuk kuramı", "hukuki pozitivizm ve Kelsen", "adalet kavramı ve Rawls", "hukuk realizmi", "hukuk ve ahlak ilişkisi", "hukuk sosyolojisi ve toplumsal değişme", "yorum yöntemleri"] },
  { id: "hukuk_tarihi", name: "Türk Hukuk Tarihi", percent: 2.5, count: 3, topic: "İslam-Osmanlı hukuku, Mecelle, Tanzimat, Cumhuriyet dönemi resepsiyon", lawFiles: ["TBB_turk_hukuk_tarihi"], subtopics: ["İslam hukuku kaynakları", "Osmanlı arazi hukuku", "Mecelle ve tedvin", "Tanzimat dönemi hukuk reformları", "Cumhuriyet dönemi resepsiyon", "kadılık ve şer'iyye mahkemeleri"] },
  { id: "milletlerarasi", name: "Milletlerarası Hukuk", percent: 2.5, count: 3, topic: "devletler hukuku, andlaşmalar, uluslararası yargı organları", lawFiles: [], ragCourse: "hmgs_ozet", subtopics: ["andlaşmalar hukuku ve çekince", "devletin tanınması ve ardıllığı", "diplomatik dokunulmazlık", "uluslararası yargı ve UAD", "kuvvet kullanma yasağı", "deniz hukuku ve kıta sahanlığı", "insan hakları sözleşmeleri"] },
  { id: "milletlerarasi_ozel", name: "Milletlerarası Özel Hukuk", percent: 2.5, count: 3, topic: "MÖHUK 5718 kanunlar ihtilafı, yetki, tanıma tenfiz", lawFiles: ["mohuk-5718.pdf"], subtopics: ["kanunlar ihtilafı bağlama kuralları", "milletlerarası yetki", "yabancı kararların tanınması ve tenfizi", "vatandaşlık ve yabancılar hukuku", "sözleşmeden doğan borçlarda uygulanacak hukuk", "haksız fiilde uygulanacak hukuk", "aile ve miras ilişkilerinde uygulanacak hukuk"] },
  { id: "genel_kamu", name: "Genel Kamu Hukuku", percent: 2.5, count: 3, topic: "devlet kuramı, egemenlik, insan hakları kuramı", lawFiles: [], ragCourse: "hmgs_ozet", subtopics: ["devletin unsurları ve egemenlik", "hukuk devleti ilkesi", "kuvvetler ayrılığı", "demokrasi kuramları", "insan hakları kuramsal temelleri", "meşruiyet ve iktidar"] },
];

export function getSubject(id: string): HmgsSubject | undefined {
  return HMGS_SUBJECTS.find((s) => s.id === id);
}
