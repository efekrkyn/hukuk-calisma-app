/**
 * HMGS konu anlatımı üretici.
 *
 * Soru bankası "biliyor muyum?" sorusunu cevaplıyor ama "bilmiyorsam nereden
 * öğreneceğim?" sorusunu cevaplamıyordu. Bu dosya aynı RAG korpusundan —
 * soruların üretildiği kanun metninin ta kendisinden — alt konu bazında
 * anlatım üretir. Kaynak ortak olduğu için anlatım ve sorular birbirini tutar;
 * ayrı bir ders kitabından beslenseydi ikisi arasında sessiz uyuşmazlık olurdu.
 *
 * Dayanak (pdf/sayfa) sorularda olduğu gibi burada da saklanıyor: anlatımda
 * hata görülürse hangi metinden çıktığı geriye dönük denetlenebilsin.
 */

import { embedQuery, retrieve } from "./rag";
import { DeepSeekProvider } from "./ai-provider";
import { stripSourceRefs } from "./hmgs-generator";
import type { HmgsSubject } from "./hmgs-subjects";

export type GeneratedTopic = {
  content: string;
  sources: Array<{ pdf: string; page: number }>;
};

/**
 * Kaç kanun parçası bağlama girsin.
 *
 * Soru üretiminde 40 kullanılıyor ama orada amaç ÇEŞİTLİLİK (farklı maddelerden
 * farklı sorular). Burada amaç DERİNLİK: tek bir alt konuyu baştan sona anlatmak.
 * 30, bir alt konunun ilgili madde kümesini kapsamaya yetiyor; daha fazlası
 * konunun dışına taşan maddeleri de bağlama sokup anlatımı dağıtıyor.
 */
const TOP_K = 30;

const SYSTEM = `Sen HMGS'ye (Hukuk Mesleklerine Giriş Sınavı) hazırlanan bir hukuk fakültesi mezununa konu anlatan kıdemli bir hukukçusun.

KURALLAR:
1. YALNIZCA <KAYNAK> içindeki metne dayan. Kaynakta olmayan bilgiyi UYDURMA.
   Konunun bir yönü kaynak metinde geçmiyorsa o başlık altında açıkça
   "kaynak metinde yer almıyor" yaz — boşluğu kendi hafızandan doldurma.
   Bu kural anlatımın tüm değeri: doğruluğu denetlenebilen tek şey kaynağa
   bağlı olan kısımdır.
2. MADDE NUMARASI VERİRKEN O MADDEDEN KISA ALINTI DA VER. Numara yazmak
   yetmiyor — bu projede yapılan denetimde bulunan hataların neredeyse
   tamamı madde atfı etrafındaydı, model komşu bir maddeyi gösteriyordu.
   Alıntı yapmak zorunda kalmak bunu engelliyor. Alıntıyı tırnak içinde ver.
   Alıntılayamadığın bir maddeyi hiç anma.
3. İÇ KAYNAK NUMARALARINI METNE YAZMA. <KAYNAK> içindeki [1], [2] gibi
   numaralar ve "sourceIndex" bizim iç numaralandırmamızdır; okuyan kişi
   için hiçbir anlam taşımaz. Anlatımda bunlara ATIF YAPMA — gerektiğinde
   kanunun kendi adını ve madde numarasını kullan.
4. Okuyucu hukuk mezunu: teknik terimleri kullan, ama her terimi ilk
   geçtiğinde kısaca açıkla. Ne popüler dille sulandır, ne de tanımsız
   terim yığ.
5. EMOJİ KULLANMA. Süsleme yapma.
6. Markdown başlıklarla yaz. Sadece anlatımı döndür; "işte konu anlatımı"
   gibi giriş cümlesi veya kapanış yazma.

YAPI — tam olarak bu altı başlığı bu sırayla kullan:

## Tanım ve kapsam
Konu nedir, hangi kanunun hangi bölümünde/kitabında düzenlenmiştir, hukuk
sistematiği içinde nereye oturur.

## Kanuni dayanak
İlgili madde numaraları VE her biri için madde metninden kısa alıntı.
Alıntıları tırnak içinde ver.

## Unsurlar / şartlar
Maddeler hâlinde liste. Her unsurun dayandığı hükmü belirt.

## İşleyiş
Kural somut olayda nasıl uygulanır: sıra, süreler, hak düşürücü süre mi
zamanaşımı mı, istisnalar, karşı hükümler.

## Örnek olay
Somut bir vakıa kur (taraflar, tarih/süre, eylemler) ve kaynak metindeki
hükümle adım adım çöz. Vakıanın çözümü kaynak metinden ÇIKARILABİLİR olmalı;
hükmün kapsamadığı bir olay kurma.

## Sınavda dikkat
Sık karıştırılan ayrımlar, benzer kurumlarla farklar, süre tuzakları,
"şu hâlde şu değil" tipi ayrımlar.`;

/**
 * Bir alt konu için kanun metnine dayalı anlatım üretir.
 *
 * Kaynak parçası hiç gelmezse null döner: dayanaksız anlatım uydurmaktansa
 * hiç üretmemek doğru. Aynı gerekçe soru üretiminde de geçerli (bkz.
 * generateQuestions), orada boş dizi dönülüyor.
 */
export async function generateTopic(
  env: { AI: Ai; VECTORIZE: VectorizeIndex; DB?: D1Database; DEEPSEEK_API_KEY: string },
  subject: HmgsSubject,
  subtopic: string
): Promise<GeneratedTopic | null> {
  // Retrieval hedefi alt konunun türüne göre değişiyor: doktrin alt konuları
  // (hizmet kusuru, kusursuz sorumluluk gibi) hiçbir kanunda tanımlı değil,
  // kanun korpusunda aranınca "kaynakta yok" çıkıyorlar. Aynı ayrım
  // generateQuestions içinde de yapılıyor.
  const isDoctrine = (subject.doctrineSubtopics ?? []).includes(subtopic);
  const course = isDoctrine ? "hmgs_ozet" : (subject.ragCourse ?? "kanunlar");

  const query = `${subject.name}: ${subtopic}`;
  const qVec = await embedQuery(query, env.AI);
  const all = await retrieve(env.VECTORIZE, env.DB, query, qVec, env.AI, course, TOP_K);

  // "kanunlar" course'u 23 kanun barındırıyor; alan bazlı çapa olmadan
  // CMK konusu Avukatlık Kanunu'ndan anlatılabiliyor. Doktrin konusunda
  // lawFiles yok, course filtresi zaten daraltıyor.
  const chunks = subject.lawFiles.length && !isDoctrine
    ? all.filter((c) => subject.lawFiles.some((f) => c.pdf.includes(f)))
    : all;

  if (chunks.length === 0) return null;

  const context = chunks
    .map((c, i) => `[${i + 1}] ${c.pdf} (s.${c.page_start}):\n${c.text}`)
    .join("\n\n");

  const prompt = `<KAYNAK>\n${context}\n</KAYNAK>\n\nYukarıdaki kaynak metne dayanarak "${subject.name}" alanında "${subtopic}" konusunu anlat. Yapıdaki altı başlığı da doldur; kaynak bir başlığı karşılamıyorsa o başlıkta bunu açıkça söyle.`;

  const provider = new DeepSeekProvider(env.DEEPSEEK_API_KEY, "deepseek-chat");
  let raw = "";
  for await (const tok of provider.streamChat(prompt, SYSTEM)) raw += tok;

  // Model bazen anlatımın tamamını ```markdown çitine sarıyor; iki uç birlikte.
  const trimmed = raw.trim();
  const fenced = /^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i.exec(trimmed);
  const body = fenced ? fenced[1] : trimmed;

  // İSTEM YETMİYOR, MEKANİK TEMİZLİK DE GEREKİYOR: kural 3'e rağmen model
  // "[4] numaralı kaynakta belirtildiği üzere" gibi iç atıflar yazıyor
  // (soru açıklamalarının %4'ünde aynı şey oluyordu). stripSourceRefs bu
  // temizliği zaten yapıyor, yeniden yazmıyoruz.
  //
  // SATIR SATIR uygulanıyor: stripSourceRefs açıklama gibi TEK PARAGRAF için
  // yazılmış, sonunda `\s{2,}` daralttığı için tüm metne uygulanırsa markdown
  // paragraf boşluklarını ve satır sonlarını yiyip anlatımı tek bloğa çevirir.
  // Sadece atıf İÇEREN satırlara uygulanıyor: fonksiyon nokta ile bitmeyen
  // satırın sonuna nokta ekliyor, dokunulmayan başlıklar bundan korunuyor.
  const hasRef = /\[\s*\d+\s*\]|source\s*index/i;
  const content = body
    .split("\n")
    .map((line) => (hasRef.test(line) ? stripSourceRefs(line) : line))
    .join("\n")
    .trim();

  // Model boş ya da tek cümlelik bir şey döndürdüyse önbelleğe yazmanın anlamı
  // yok — bir dahaki açılışta o çöp kalıcı olurdu.
  if (content.length < 200) return null;

  // Aynı sayfadan birden çok parça gelebiliyor; kullanıcıya gösterilecek
  // dayanak listesinde tekrar etmesin.
  const seen = new Set<string>();
  const sources = chunks
    .filter((c) => {
      const key = `${c.pdf}#${c.page_start}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((c) => ({ pdf: c.pdf, page: c.page_start }));

  return { content, sources };
}
