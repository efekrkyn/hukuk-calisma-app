/**
 * Konu anlatımlarının çevrimdışı önbelleği.
 *
 * Anlatımlar POST /hmgs/topic ile geliyor; Workbox POST yanıtlarını
 * önbelleklemiyor, dolayısıyla servis çalışanı bu içeriği kurtaramıyor.
 * Anlatım bir kez üretilip veritabanında saklandığı için DEĞİŞMEZ — istemci
 * tarafında saklamak güvenli ve çevrimdışı çalışmanın asıl gövdesi bu.
 *
 * localStorage seçildi, IndexedDB değil: eşzamansız API'ye gerek yok ve
 * kayıt başına ~12 KB, sadece AÇILAN konular saklanıyor. Bütçe aşılırsa en
 * eski erişilenler düşüyor (LRU) — sessizce patlamak yerine yer açmak.
 */

const ANAHTAR = "hmgs_konu_v1";
// localStorage sınırı tarayıcıya göre 5-10 MB. 3 MB'da durmak, uygulamanın
// başka verileri (oturum, tema) için pay bırakıyor.
const BUTCE = 3_000_000;

type Kayit = { content: string; sources: unknown; at: number };
type Depo = Record<string, Kayit>;

function anahtar(subject: string, subtopic: string) {
  return `${subject}::${subtopic}`;
}

function oku(): Depo {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(ANAHTAR) ?? "{}") as Depo;
  } catch {
    // Bozuk JSON önbelleği kilitlemesin; sıfırdan başla.
    return {};
  }
}

function yaz(d: Depo) {
  try {
    localStorage.setItem(ANAHTAR, JSON.stringify(d));
  } catch {
    // Kota dolduysa yarısını at ve bir kez daha dene. Başarısız olursa
    // önbelleksiz devam — çevrimdışı özellik, çalışmayı engellememeli.
    const sirali = Object.entries(d).sort((a, b) => a[1].at - b[1].at);
    const kalan = Object.fromEntries(sirali.slice(Math.floor(sirali.length / 2)));
    try {
      localStorage.setItem(ANAHTAR, JSON.stringify(kalan));
    } catch {
      /* vazgeç */
    }
  }
}

export function konuOku(subject: string, subtopic: string): Kayit | null {
  const d = oku();
  const k = d[anahtar(subject, subtopic)];
  if (!k) return null;
  // Erişim zamanını tazele ki LRU "en az kullanılan"ı doğru seçsin.
  k.at = Date.now();
  yaz(d);
  return k;
}

export function konuYaz(
  subject: string,
  subtopic: string,
  content: string,
  sources: unknown
) {
  if (typeof window === "undefined" || !content) return;
  const d = oku();
  d[anahtar(subject, subtopic)] = { content, sources, at: Date.now() };

  // Bütçe aşıldıysa en eski erişilenden başlayarak at.
  let boyut = JSON.stringify(d).length;
  if (boyut > BUTCE) {
    const sirali = Object.entries(d).sort((a, b) => a[1].at - b[1].at);
    for (const [key] of sirali) {
      if (boyut <= BUTCE) break;
      boyut -= JSON.stringify(d[key]).length;
      delete d[key];
    }
  }
  yaz(d);
}

/** Kaç konu çevrimdışı hazır — kullanıcıya ne kadarını götürebileceğini söyler. */
export function konuSayisi(): number {
  return Object.keys(oku()).length;
}
