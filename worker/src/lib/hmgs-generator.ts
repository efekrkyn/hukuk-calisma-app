/**
 * HMGS soru üretici.
 *
 * ÖSYM kitapçıklarındaki sorular telifli olduğu için kopyalanmaz. Bunun yerine
 * indexlenmiş kanun metninden RAG ile ÖZGÜN çoktan seçmeli soru üretilir; her
 * sorunun dayandığı kanun/sayfa kaydedilir ki üretilen soru denetlenebilsin.
 */

import { embedQuery, retrieve } from "./rag";
import { DeepSeekProvider } from "./ai-provider";
import { parseLlmJson } from "./llm-json";
import type { HmgsSubject } from "./hmgs-subjects";

export type GeneratedQuestion = {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  /** Modelin bildirdiği <KAYNAK> parça numarası (1 tabanlı); yoksa null. */
  sourceIndex: number | null;
  source_pdf?: string;
  source_page?: number;
  /**
   * Sorunun üretildiği alt konu. Üretici zaten alt konu seçip isteme
   * yazıyordu ama bilgiyi döndürmüyordu, dolayısıyla kaydedilmiyordu.
   * Kaydedilince: konu anlatımından o konunun sorularına geçiş ve
   * alan-altı zayıflık analizi mümkün oluyor ("Borçlar'da zayıfsın"
   * yerine "Borçlar'ın zamanaşımı konusunda zayıfsın").
   */
  subtopic?: string;
};

const SYSTEM = `Sen HUKUK ALANI için soru yazan bir hukukçusun (HMGS — Hukuk Mesleklerine Giriş Sınavı).

KURALLAR:
1. Yalnızca <KAYNAK> içindeki kanun metnine dayanan sorular yaz. Kaynakta olmayan bilgiyi UYDURMA.
2. Sorular ÖZGÜN olacak — ezberden herhangi bir çıkmış sınav sorusunu tekrar etme.
3. Her soru 4 şıklı, TEK doğru cevaplı olacak. "hepsi/hiçbiri" kullanma.
3b. ÇELDİRİCİLER AÇIKÇA YANLIŞ OLMALI — "kısmen doğru" değil.
   Denetimde en sık hata bu: 35 yanlış sorunun 21'inde hakem "başka bir şık
   da doğru" dedi. Ceza ve Borçlar'da hükümler çok istisna ve karşılıklı
   gönderme içerdiği için ikinci bir şık kolayca savunulabilir hale geliyor.
   Bir şıkkın kaynak metne göre savunulabilir tarafı varsa O ŞIKKI YAZMA.
3c. Yazmadan önce her çeldiriciyi tek tek kontrol et: "kaynak metin bunu
   destekleyen bir hüküm içeriyor mu?" Cevap evetse çeldirici bozuktur.
3d. Doğru cevap, en yakın alternatiften AÇIK FARKLA üstün olmalı. Aradaki
   fark ince bir yorum meselesiyse o soruyu hiç sorma.
4. OLAY SORUSU AĞIRLIĞI — bu partideki soruların EN AZ %60'ı olay tipi olacak.
   Bankadaki 1841 sorunun yalnızca %29'u olay içeriyor, %55'i "aşağıdakilerden
   hangisi ...dir/değildir" saf hatırlama kalıbında. Gerçek HMGS ağırlıklı
   olarak somut vakıa verip hukuki sonucu sordurur; madde ezberi ölçen soru
   sınavı temsil etmiyor.
4a. OLAY SORUSU NASIL KURULUR:
   - Somut vakıa ver: taraflar (A, B, C), tarih veya süre, gerçekleşen eylemler.
   - Vakıa çözüm için gereken TÜM olguları içersin; aday varsayım yapmak
     zorunda kalmasın.
   - Soru kökü hukuki SONUCU sorsun: "...hukuki durumu aşağıdakilerden
     hangisidir?", "...talebi bakımından aşağıdakilerden hangisi doğrudur?",
     "...sözleşmenin akıbeti ne olur?"
   - Şıklar hukuki sonuç olsun (geçerli/geçersiz, sorumlu/sorumsuz, hak
     kazanır/kazanamaz, süre işlemeye başlar/başlamaz) — tanım listesi değil.
   - Vakıanın çözümü <KAYNAK>'taki hükümden ÇIKARILABİLİR olmalı. Hükmün
     kapsamadığı bir olay kurma; kurgu vakıa uydurmakla kaynak dışına
     çıkmak aynı hatadır.
   ÖRNEK OLAY SORUSU:
   "A, B'ye ait taşınmazı 10 yıl boyunca malik sıfatıyla ve davasız olarak
   elinde bulundurmuştur. Tapu kütüğünde kayıtlı malik C'dir. A'nın taşınmaz
   üzerindeki hukuki durumu aşağıdakilerden hangisidir?"
4b. Kalan en fazla %40'ta saf tanım/sayma sorusu ("aşağıdakilerden hangisi
   X'in unsurlarından biri DEĞİLDİR") yazabilirsin — ama sadece hüküm
   gerçekten sayma niteliğindeyse. Aynı hükümden olay sorusu kurulabiliyorken
   tanım sorusu yazma.
4c. Olay sorusunda da 3b–3d geçerli: çeldirici sonuçlar açıkça yanlış olacak
   ve doğru sonuç en yakın alternatiften açık farkla üstün olacak.
5. explanation'da doğru cevabın dayandığı maddeyi belirt VE o maddeden
   kısa bir alıntı ver. Madde numarası yazmak yetmiyor — denetimde 35
   hatanın 34'ü madde atfı etrafındaydı ve model komşu bir maddeyi
   gösteriyordu (ör. kefilin rücuu için m.168 yerine m.596). Alıntı
   yapmak zorunda kalmak bunu engelliyor.
5a. Açıklamada, en yakın yanlış şıkkın NEDEN yanlış olduğunu da tek
   cümleyle söyle.
5b. ŞIK UZUNLUKLARI BİRBİRİNE YAKIN OLSUN. Doğru şıkkı diğerlerinden daha uzun
   veya daha ayrıntılı yazma — uzunluk cevabı ele verir, soru ölçmez olur.
5c. DOĞRU CEVABI HARFLERE DENGELİ DAĞIT. Bankada dağılım bozuk: doğru cevap
   %41 oranında B, yalnızca %7,7 oranında D (dengeli olsa her biri %25).
   Bu partide correctAnswer değerlerini 0/1/2/3 arasında yaklaşık eşit
   paylaştır, art arda iki soruda aynı indeksi kullanma ve JSON'u
   döndürmeden önce dağılımı gözden geçir.
6. sourceIndex: soruyu hangi <KAYNAK> parçasından yazdığını [n] numarasıyla bildir.
7. İSTENEN ALAN DIŞINA ÇIKMA. Kaynak parçaları istenen alanı karşılamıyorsa o soruyu
   hiç yazma — az soru döndürmek, yanlış alandan soru döndürmekten iyidir.
8. JSON'U DÖNDÜRMEDEN ÖNCE HER SORUYU BİR KEZ DAHA OKU. Ölçüldü: olay
   sorularında kusur oranı %21, tanım sorularında %12 — neredeyse iki katı.
   Sebebi olay sorusunun vakıa → kural → sonuç zinciri kurması ve her
   halkada kayma olabilmesi. Şunları tek tek denetle:
8a. AÇIKLAMA İLE İŞARETLİ ŞIK ÇELİŞİYOR MU? En sık hata bu. Açıklaman bir
   sonuca varıp işaretlediğin şık başka bir şey söylüyorsa soru bozuktur.
   Örnek hata: açıklama "talep vaki olmamış sayılır" diyor, işaretli şık
   "15 günlük süre verilir" diyor.
8b. ALINTILADIĞIN HÜKMÜN KELİMELERİ İLE ŞIKKIN KELİMELERİ AYNI MI? Hukukta
   kelime farkı sonuç farkıdır. Örnek hata: madde "hükümsüz hale gelir"
   diyor, şık "yürürlükten kalkar" diyor — bunlar aynı şey değil.
8c. VAKIADAKİ OLGULAR, ATIF YAPTIĞIN HÜKMÜN ŞARTLARINI GERÇEKTEN
   KARŞILIYOR MU? Hükmün aradığı bir şart vakıada yoksa sonuç değişir.
   Bir şart eksikse ya vakıaya ekle ya soruyu yaz.
   Bu üç denetimden birini geçemeyen soruyu DÖNDÜRME. Az soru döndürmek,
   bozuk soru döndürmekten iyidir.
9. SADECE JSON dizisi döndür, başka hiçbir metin yazma.

FORMAT:
[{"question":"...","options":["...","...","...","..."],"correctAnswer":0,"explanation":"...","sourceIndex":1}]`;

/**
 * Doğru şıkkın, diğerlerinin ortalamasına oranı. 1'e yakın = dengeli.
 * Üretimde kapı, denemede eleme olarak aynı ölçü kullanılıyor — iki yerde
 * ayrı eşik tutmak kaçınılmaz olarak birbirinden kayardı.
 */
export const MAX_LENGTH_RATIO = 1.4;

export function lengthRatio(options: string[], correctAnswer: number): number {
  const others = options.filter((_, i) => i !== correctAnswer).map((o) => o.length);
  const mean = others.reduce((a, b) => a + b, 0) / others.length;
  return mean > 0 ? options[correctAnswer].length / mean : 1;
}

/** Üretilen ham nesneyi doğrular; şema bozuksa null döner. */
/**
 * Açıklamadan iç kaynak atıflarını temizler.
 *
 * Model, isteme koyduğumuz `sourceIndex` alanını açıklamanın METNİNE de
 * yazıyor: "(sourceIndex: 6)", "(Kaynak [1] ve [2])", "kaynak [9]'daki madde
 * metnine dayanılarak hazırlanmıştır." Bunlar bizim iç numaralandırmamız;
 * çalışan kişi için anlamsız. Bankanın %4'ünde (2136 sorunun 87'si) vardı.
 *
 * Atıf alanının kendisi (`sourceIndex`) korunuyor — sorunun hangi parçadan
 * yazıldığını denetimde hâlâ görebilmemiz gerekiyor; temizlenen yalnızca
 * kullanıcıya gösterilen metin.
 */
export function stripSourceRefs(s: string): string {
  const out = s
    // ÖNCE parantezli hâl: "(sourceIndex: 6)", "[sourceIndex: 37]",
    // "(Kaynak [1] ve [2])", "(kaynak [2])". Cümle kalıbından önce çalışmalı;
    // aksi hâlde "(kaynak [2])." girdisinde cümle kalıbı kapanış parantezini
    // de yutup açılış parantezini metinde bırakıyor.
    .replace(
      /\s*[([]\s*(?:source\s*index|kaynak)\s*:?\s*\[?\d+\]?(?:\s*(?:ve|,)\s*\[?\d+\]?)*\s*[)\]]/giu,
      ""
    )
    // SONRA yalnızca meta cümlesi: "... kaynak [9]'daki madde metnine
    // DAYANILARAK hazırlanmıştır." "dayanıl" şartı olmadan bu kalıp,
    // "Kaynak [76]'da belirtildiği üzere Hume..." gibi ANLATIMA dahil
    // atıflarda ilk noktaya kadar her şeyi siliyor ve açıklamayı tamamen
    // boşaltıyordu (bankada 8 satır böyleydi; üretimde de bu soruları
    // sessizce elerdi, çünkü validateQuestion boş açıklamayı reddediyor).
    .replace(/[,;]?\s*(?:bu\s+\w+\s+)?kaynak\s*\[\d+\][^.]*dayanıl[^.]*\./giu, "")
    // Anlatıma dahil kalan atıflar silinmiyor, NÖTRLEŞTİRİLİYOR: cümlenin
    // öznesi onlar. "Kaynak [76]'da belirtildiği üzere" → "Kaynak metninde
    // belirtildiği üzere". Ek ('da/'te/'de) atıfla birlikte gidiyor.
    .replace(/\bkaynak\s*\[\d+\](?:['’]\p{L}+)?/giu, "Kaynak metninde")
    .replace(/\.\s*\./g, ".")
    .replace(/\s+([.,;])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim()
    // Atıf cümlenin sonundaysa geriye "… olup," gibi askıda bir bağlaç kalıyor.
    .replace(/[,;]+$/, "");

  return /[.!?]$/.test(out) || out === "" ? out : out + ".";
}

export function validateQuestion(q: unknown): GeneratedQuestion | null {
  if (!q || typeof q !== "object") return null;
  const o = q as Record<string, unknown>;

  const question = typeof o.question === "string" ? o.question.trim() : "";
  const explanation =
    typeof o.explanation === "string" ? stripSourceRefs(o.explanation) : "";
  const options = Array.isArray(o.options) ? o.options.map((x) => String(x).trim()) : [];

  // Number(null) ve Number("") 0 döner — cevap anahtarı olmayan soru sessizce
  // "doğru cevap A" olarak kaydedilirdi. Sayı veya sayısal string dışını reddet.
  const rawAnswer = o.correctAnswer;
  const isNumeric =
    typeof rawAnswer === "number" ||
    (typeof rawAnswer === "string" && rawAnswer.trim() !== "");
  const correctAnswer = isNumeric ? Number(rawAnswer) : NaN;

  if (question.length < 15) return null;
  if (options.length !== 4 || options.some((x) => x.length === 0)) return null;
  if (!Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer > 3) return null;
  if (new Set(options).size !== 4) return null; // aynı şık iki kez olmasın
  if (explanation.length < 10) return null;

  // UZUNLUK KAPISI. Bankada doğru şık %47 oranında en uzun olandı (şans %25):
  // soru okunmadan cevap seçilebiliyordu. Prompt'a kural eklemek yetmedi,
  // mekanik kapı gerekiyor.
  //
  // Eşik gerçek bankadan kalibre edildi: 1.4'te iz %47 → %28'e (şans
  // seviyesi) düşüyor, üretimin ~%25'i eleniyor. Daha sıkı eşik (1.3) çok
  // sağlam soruyu da atıyordu.
  if (lengthRatio(options, correctAnswer) > MAX_LENGTH_RATIO) return null;

  const idx = Number(o.sourceIndex);
  const sourceIndex = Number.isInteger(idx) && idx >= 1 ? idx : null;

  return { question, options, correctAnswer, explanation, sourceIndex };
}

export async function generateQuestions(
  env: { AI: Ai; VECTORIZE: VectorizeIndex; DB?: D1Database; DEEPSEEK_API_KEY: string },
  subject: HmgsSubject,
  count: number,
  /** Verilirse rastgele rotasyon yerine bu alt konudan üretir. Listede
   *  yoksa yok sayılır — istemciden gelen serbest metinle üretim olmasın. */
  wantSubtopic?: string
): Promise<GeneratedQuestion[]> {
  // Doktrin konularında kanun yok; makale korpusundan besleniyorlar.
  // Ne kanun ne makale kaynağı varsa üretme — dayanaksız soru uydurma olur.
  if (subject.lawFiles.length === 0 && !subject.ragCourse && !subject.doctrineSubtopics?.length) return [];

  // 1) Alanın konusuyla ilgili kanun metnini çek. "kanunlar" course'u 23 kanun
  //    içerdiği için geniş alıp alanın kendi kanunlarına daraltıyoruz.
  //
  // ALT KONU ROTASYONU: sabit sorgu her seferinde aynı chunk'ları getiriyordu.
  // Denetimde Borçlar'da 46 sorunun yalnızca 13 farklı kanun parçasından
  // üretildiği görüldü — aynı maddeler dönüp duruyordu. Rastgele bir alt
  // konu seçmek retrieval'ı kanunun farklı yerlerine taşıyor.
  // Kanun + doktrin alt konuları tek havuzda; hangisinin seçildiğine göre
  // retrieval farklı korpusa gidiyor. Doktrin konusu kanunda yok, kanun
  // korpusunda aramak "kaynakta yok" üretiyordu.
  //
  // `wantSubtopic` verilirse rastgele seçim yapılmaz: bazı alt konularda
  // banka ince kalıyor (30 alt konu örneklendi, ikisinde 5'ten az soru vardı)
  // ve rastgele rotasyonla o boşluğu doldurmak şansa kalıyordu. Hedefli
  // üretim boşluğu doğrudan kapatıyor.
  const lawSubs = subject.subtopics ?? [];
  const docSubs = subject.doctrineSubtopics ?? [];
  const pool = [...lawSubs, ...docSubs];
  const subtopic =
    wantSubtopic && pool.includes(wantSubtopic)
      ? wantSubtopic
      : pool.length
        ? pool[Math.floor(Math.random() * pool.length)]
        : "";
  const isDoctrine = docSubs.includes(subtopic);
  const course = isDoctrine ? "hmgs_ozet" : (subject.ragCourse ?? "kanunlar");
  const query = `${subject.name}: ${subtopic || subject.topic}`;
  const qVec = await embedQuery(query, env.AI);
  const all = await retrieve(
    env.VECTORIZE, env.DB, query, qVec, env.AI, course, Math.max(count * 8, 40)
  );

  // lawFiles boşsa (doktrin konusu) course filtresi zaten daraltıyor,
  // dosya bazlı çapa uygulanmaz.
  const chunks = subject.lawFiles.length && !isDoctrine
    ? all.filter((c) => subject.lawFiles.some((f) => c.pdf.includes(f)))
    : all;

  // Doğru kanundan hiç parça gelmediyse başka kanundan soru üretmektense hiç üretme.
  if (chunks.length === 0) return [];

  const context = chunks
    .map((c, i) => `[${i + 1}] ${c.pdf} (s.${c.page_start}):\n${c.text}`)
    .join("\n\n");

  // Bankada ne olduğunu söylemezsek model aynı soruyu tekrar üretiyor
  // (denetimde Medeni Hukuk'ta aynı soru 3 kez çıktı).
  let avoid = "";
  if (env.DB) {
    try {
      const prev = await env.DB.prepare(
        `SELECT question FROM hmgs_questions WHERE subject = ? ORDER BY created_at DESC LIMIT 25`
      ).bind(subject.id).all<{ question: string }>();
      if (prev.results.length > 0) {
        avoid =
          "\n\n<ZATEN_VAR>\nBu sorular bankada mevcut, bunları veya çok benzerlerini TEKRAR YAZMA:\n" +
          prev.results.map((r, i) => `${i + 1}. ${r.question}`).join("\n") +
          "\n</ZATEN_VAR>";
      }
    } catch (e) {
      console.error("mevcut sorular okunamadı:", e);
    }
  }

  // %60 olay kuralını ADET olarak da söylüyoruz: küçük partide yüzde belirsiz
  // kalıyor (3 soruluk partide "%60" model için 1 de 2 de olabilir), somut
  // sayı ise kontrol edilebilir bir hedef.
  const scenarioCount = Math.ceil(count * 0.6);
  const prompt = `<KAYNAK>\n${context}\n</KAYNAK>${avoid}\n\nYukarıdaki kanun metnine dayanarak "${subject.name}"${subtopic ? ` alanında, özellikle "${subtopic}" konusunda` : " alanında"} ${count} adet HMGS sorusu yaz.\n\nBunlardan EN AZ ${scenarioCount} tanesi OLAY sorusu olacak (KURAL 4/4a): somut vakıa — taraflar, süre/tarih, eylemler — verilip hukuki sonucu sorulacak. Kalanlar tanım/sayma sorusu olabilir.\n\nDoğru cevapları A/B/C/D arasında dengeli dağıt (KURAL 5c).`;

  const provider = new DeepSeekProvider(env.DEEPSEEK_API_KEY, "deepseek-chat");
  let raw = "";
  for await (const tok of provider.streamChat(prompt, SYSTEM)) raw += tok;

  const parsed = parseLlmJson<unknown[]>(raw);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map(validateQuestion)
    .filter((q): q is GeneratedQuestion => q !== null)
    // Kaynağını bildirmeyen veya var olmayan bir parçayı gösteren soruyu alma:
    // dayanağı doğrulanamayan soru bankaya girerse hatayı sonradan bulmak imkânsız.
    .filter((q) => q.sourceIndex !== null && q.sourceIndex <= chunks.length)
    .slice(0, count)
    .map((q) => {
      const src = chunks[q.sourceIndex! - 1];
      return {
        ...q,
        source_pdf: src.pdf,
        source_page: src.page_start,
        subtopic: subtopic || undefined,
      };
    });
}
