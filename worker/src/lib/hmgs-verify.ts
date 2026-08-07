/**
 * Soru bankası denetimi.
 *
 * Sorular kanun metninden üretiliyor ama üretim doğruluğu garanti etmiyor:
 * denetimde 5510 sorusunun açıklaması kendi kendisiyle çelişiyordu.
 *
 * TASARIM NOTU — bu bir LLM'in LLM'i denetlemesi, kör noktalar ortak olabilir.
 * Riski üç şekilde azaltıyoruz:
 *  1. Hakem modelin HAFIZASINA değil, yeniden çekilen KANUN METNİNE bakıyor.
 *     Metinde karşılığı yoksa "unsupported" diyor, kendi bilgisiyle doldurmuyor.
 *  2. Duruş karşıt: "doğrula" değil, "hatayı bul".
 *  3. Üretim deepseek-chat, denetim deepseek-reasoner — en azından aynı
 *     karar yolu değil.
 * Yine de bu, insan denetiminin yerini tutmaz; şüpheli soruları eleme aracıdır.
 */

import { embedQuery, retrieve } from "./rag";
import { DeepSeekProvider } from "./ai-provider";
import { parseLlmJson } from "./llm-json";
import type { HmgsSubject } from "./hmgs-subjects";
import { extractLawRefs } from "./law-refs";
import { callMcpTool, unwrapMcpResult } from "./mcp-client";

const MEVZUAT_MCP_URL = "https://mevzuat.surucu.dev/mcp";

/**
 * Korpusta olmayan kanunları canlı mevzuattan çeker.
 *
 * Denetimde "unsupported" kalanların çoğu kötü soru değil, korpusta bulunmayan
 * kanuna dayanan sorulardı (FSEK m.75, Avukatlık Kanunu m.58 — uygulamanın 23
 * kanunluk PDF setinde yoklar). Hakem göremediğini onaylamıyor, haklı olarak.
 *
 * Bounded: en fazla MAX_LOOKUPS kanun, her biri ayrı MCP çağrısı; biri
 * patlarsa denetimi düşürmüyoruz, o kanun eksik kalıyor.
 */
const MAX_LOOKUPS = 3;

/**
 * Atıf yapılan madde metinde geçiyor mu.
 *
 * `\b` kullanılmıyor: "Madde 6" araması "Madde 60"u da yakalamamalı, o yüzden
 * rakam devamı açıkça dışlanıyor. Madde bilgisi olmayan atıf (yalnızca kanun
 * adı) doğrulanamaz — o durumda "var" sayıp dışarı çıkmıyoruz, eski davranış.
 */
export function hasArticle(text: string, madde: string | null): boolean {
  if (!madde) return true;
  return new RegExp(`madde\\s*${madde}(?!\\d)|m\\.\\s*${madde}(?!\\d)`, "i").test(text);
}

/**
 * Eksik maddeleri korpusun FTS indeksinden çeker.
 *
 * Kanun numarası dosya adının sonunda duruyor (ceza-kanunu-5237.pdf), bağ
 * bunun üzerinden kuruluyor. FTS5 tümce araması token bazlı olduğu için
 * "madde 6" ile "madde 60" karışmıyor.
 */
async function fetchCorpusArticles(
  db: D1Database,
  refs: Array<{ mevzuatNo: string; madde: string | null }>
): Promise<string> {
  const out: string[] = [];
  for (const ref of refs.slice(0, MAX_LOOKUPS)) {
    if (!ref.madde) continue;
    try {
      const rows = await db
        .prepare(
          `SELECT text FROM fts_chunks
            WHERE fts_chunks MATCH ? AND pdf LIKE ?
            LIMIT 2`
        )
        .bind(`"madde ${ref.madde}"`, `%-${ref.mevzuatNo}.pdf`)
        .all<{ text: string }>();
      for (const r of rows.results) {
        out.push(`### ${ref.mevzuatNo} sayılı Kanun m.${ref.madde} (korpus)\n${r.text}`);
      }
    } catch (e) {
      // FTS sorgusu patlarsa denetimi durdurma; dışarıdan çekme yolu duruyor.
      console.error(`korpus m.${ref.madde} çekilemedi:`, e);
    }
  }
  return out.join("\n\n");
}

async function fetchExternalLaws(
  refs: Array<{ mevzuatNo: string; madde: string | null }>,
  keyword: string
): Promise<string> {
  const out: string[] = [];
  for (const ref of refs.slice(0, MAX_LOOKUPS)) {
    try {
      const res = await callMcpTool(MEVZUAT_MCP_URL, "search_within_kanun", {
        mevzuat_no: ref.mevzuatNo,
        keyword: ref.madde ? `madde ${ref.madde}` : keyword.slice(0, 80),
      });
      const r = unwrapMcpResult(res);
      const text = typeof r?.raw === "string" ? r.raw : JSON.stringify(r);
      if (text && text.length > 40) {
        out.push(`### ${ref.mevzuatNo} sayılı Kanun${ref.madde ? ` m.${ref.madde}` : ""}\n${text.slice(0, 4000)}`);
      }
    } catch (e) {
      console.error(`mevzuat ${ref.mevzuatNo} çekilemedi:`, e);
    }
  }
  return out.join("\n\n");
}

export type QuestionToCheck = {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  /** Doktrin konusu mu, hangi korpustan doğrulanacağını belirler. Sütun
   *  sonradan eklendi; eski satırlarda null olabilir. */
  subtopic?: string | null;
};

export type Verdict = {
  id: string;
  verdict: "correct" | "wrong" | "unsupported" | "ambiguous";
  reason: string;
};

/**
 * İSTEMİN İKİ GÖREVLİ OLMASININ SEBEBİ — ölçüm:
 * 50 onaylı sorudan oluşan rastgele örneklem elle denetlendi. İşaretli cevabın
 * düpedüz yanlış olduğu TEK soru çıkmadı; bulunan kusurların HEPSİ aynı türdendi:
 * birden fazla şık kanun metnine göre doğru. Sebebi hakem istemiydi — yalnızca
 * "işaretli cevap destekleniyor mu?" diye soruyordu, sorduğu bu olduğu için
 * cevabı hep buluyordu ama "çeldiricilerden biri de destekleniyor mu?" diye HİÇ
 * sormuyordu. Belirsiz soruyu yapısal olarak göremiyordu.
 * Çözüm ayrı bir LLM çağrısı değil (maliyet iki katına çıkardı): aynı çağrıda
 * ikinci görev + iki somut örnek. Soyut talimat ("çeldiricileri de kontrol et")
 * bu kusurda soluk kalıyor, gerçek örnek çalışıyor.
 */
const SYSTEM = `Sen bir hukuk sınavı sorularını DENETLEYEN kıdemli hukukçusun.
Görevin soruları onaylamak değil, HATA BULMAK.

Her soru için <KANUN> ve varsa <EK_MEVZUAT> bölümündeki metne bakarak karar ver.
<EK_MEVZUAT>, korpusta bulunmayan kanunlardan canlı çekilmiş hükümlerdir; o da kaynaktır.

HER SORU İÇİN İKİ AYRI GÖREVİN VAR. İKİSİNİ DE YAP:

GÖREV 1 — İşaretlenen doğru cevap kaynak metince destekleniyor mu?

GÖREV 2 — ÇELDİRİCİLERİ TEK TEK OKU. İşaretli cevap dışındaki her şık için
kaynak metne bakarak şu soruyu açıkça cevapla: "bu şık da kanun metnine göre
DOĞRU olabilir mi?" Bir denetimde 50 onaylı soru elle incelendi; işaretli cevabı
düpedüz yanlış olan tek soru bile çıkmadı, bulunan kusurların TAMAMI "birden
fazla şık doğru" türündeydi. Yalnızca Görev 1'i yapan hakem bu kusuru göremez.

KARARLAR:
- "correct"     : Kanun metni işaretlenen cevabı açıkça destekliyor VE hiçbir
                  çeldirici metne göre savunulabilir değil.
- "ambiguous"   : İşaretli cevabın DIŞINDA en az bir şık daha kanun metnine göre
                  doğru/savunulabilir. Sorunun tek doğru cevabı yok. İşaretli
                  cevap doğru olsa BİLE bu kararı ver — soru bozuk.
- "wrong"       : Kanun metni farklı bir şıkkı destekliyor VEYA açıklama
                  kendi içinde çelişiyor (bir şeyi söyleyip tersini işaretlemek).
- "unsupported" : Kanun metninde bu soruyu karara bağlayacak hüküm yok.

"ambiguous" İÇİN İKİ GERÇEK ÖRNEK (ikisi de bu bankadan çıktı):

ÖRNEK 1 — İYUK m.34/2. Soru köyün il sınırı değişikliğinde yetkili mahkemeyi
soruyor, işaretli cevap "köyün yeni bağlandığı yer idare mahkemesi". Ama madde
metni: "...köy, belediye veya mahallenin bulunduğu YAHUT yeni bağlandığı yer
idare mahkemesidir." Kanun ikisini de yetkili sayıyor, dolayısıyla "köyün
bulunduğu yer idare mahkemesi" şıkkı DA doğru → ambiguous.

ÖRNEK 2 — Anayasa m.153. Soru "iptal kararının yürürlüğe gireceği tarih hangisi
OLABİLİR?" diye soruyor. Hem "Resmî Gazete'de yayımlandığı tarih" (kural) hem
"bir yıl sonrası" (azami erteleme süresi) olabilir; iki şık da savunulabilir
→ ambiguous.

Kalıp uyarısı: maddede "yahut / veya / ya da" bağlacıyla sayılan seçenekler ve
soruda "olabilir / mümkündür" kalıbı, birden fazla şıkkı doğru yapan tipik
kaynaklardır. Bu kalıpları gördüğünde çeldiricileri iki kez oku.

KURALLAR:
1. YALNIZCA <KANUN> ve <EK_MEVZUAT> metnine dayan. Kendi hukuk bilginle boşluk DOLDURMA —
   metinde yoksa "unsupported" de. Bu kural denetimin tüm değeri.
2. Açıklamanın kendi içinde tutarlı olup olmadığını ayrıca kontrol et.
3. reason alanına kısa ve somut gerekçe yaz (hangi madde, neden). "ambiguous"
   verdiysen HANGİ ŞIKKIN (harfiyle) neden doğru olduğunu da yaz.
4. Bir çeldirici sadece "kulağa mantıklı geliyor" diye ambiguous DEME; o şıkkı
   doğru kılan hükmü kaynak metinde gösterebiliyor olman gerekir.
5. SADECE JSON dizisi döndür.

FORMAT: [{"id":"...","verdict":"correct","reason":"..."}]`;

export async function verifyBatch(
  env: { AI: Ai; VECTORIZE: VectorizeIndex; DB?: D1Database; DEEPSEEK_API_KEY: string },
  subject: HmgsSubject,
  questions: QuestionToCheck[]
): Promise<Verdict[]> {
  if (questions.length === 0) return [];
  const course = subject.ragCourse ?? "kanunlar";
  // Doktrin konusu olan alan, kanun dosyası olmasa da denetlenebilir.
  if (subject.lawFiles.length === 0 && !subject.ragCourse && !subject.doctrineSubtopics?.length) {
    return [];
  }

  // DOKTRİN KONULARI KANUNDA YOK.
  //
  // Üretici doktrin alt konusunu "hmgs_ozet" korpusundan besliyor
  // (hmgs-generator.ts), denetleyici ise hep "kanunlar"da arıyordu. Kanunda
  // düzenlenmemiş bir konuyu kanun metnine karşı doğrulamak imkânsız; bu
  // sorular ne yapılırsa yapılsın "unsupported" çıkıyordu. Ölçüldü: İdare'de
  // yeniden denetlenen 66 sorunun 63'ü bu sebeple takılı kaldı.
  //
  // Alt konu sütunu sonradan eklendiği için artık sorunun doktrinden gelip
  // gelmediği biliniyor. Parti karışık olabildiğinden iki korpustan da
  // çekip birleştiriyoruz — ayrı LLM çağrısı eklemek maliyeti ikiye katlardı.
  const docSubs = subject.doctrineSubtopics ?? [];
  const doktrinVar =
    docSubs.length > 0 && questions.some((q) => q.subtopic && docSubs.includes(q.subtopic));

  // Kanun metnini soruların kendi içeriğine göre çek — konu başlığına göre
  // değil, yoksa alakasız maddeler gelir ve her şey "unsupported" çıkar.
  // Sorguya AÇIKLAMAYI da kat: madde numarası ("CMK m.100") soruda değil
  // açıklamada geçiyor. Yalnızca soru metniyle arayınca hakem doğru maddeyi
  // göremiyor ve sağlam soruya "unsupported" diyordu — Ceza Yargılama'da
  // 30 sorunun 20'si böyle işaretlenmişti.
  const query = questions.map((q) => `${q.question} ${q.explanation}`).join(" ");
  const qVec = await embedQuery(query, env.AI);
  const all = await retrieve(
    env.VECTORIZE, env.DB, query, qVec, env.AI, course, 80
  );
  const lawChunks = subject.lawFiles.length
    ? all.filter((c) => subject.lawFiles.some((f) => c.pdf.includes(f)))
    : all;

  // Doktrin parçaları dosya çapasına takılmaz — makale korpusunda kanun
  // dosyası yok, lawFiles filtresi hepsini elerdi.
  const docChunks = doktrinVar
    ? await retrieve(env.VECTORIZE, env.DB, query, qVec, env.AI, "hmgs_ozet", 30)
    : [];

  const chunks = [...lawChunks, ...docChunks];
  if (chunks.length === 0) return [];

  const law = chunks
    .map((c, i) => `[${i + 1}] ${c.pdf} (s.${c.page_start}):\n${c.text}`)
    .join("\n\n");

  const body = questions
    .map(
      (q) =>
        `id: ${q.id}\nSORU: ${q.question}\nŞIKLAR:\n` +
        q.options.map((o, i) => `  ${String.fromCharCode(65 + i)}) ${o}`).join("\n") +
        `\nİŞARETLENEN DOĞRU: ${String.fromCharCode(65 + q.correctAnswer)}\n` +
        `AÇIKLAMA: ${q.explanation}`
    )
    .join("\n\n---\n\n");

  // Atıf yapılan MADDE getirilen metinde var mı — kanun var mı değil.
  //
  // Eski filtre `corpusNos` üzerinden çalışıyordu: o an getirilen parçaların
  // dosya adından kanun numarasını çıkarıp, o kanuna yapılan atıfları "zaten
  // kapsandı" sayıyordu. Ama eksik kanun düzeyinde değil madde düzeyindeydi:
  // soru TCK m.6'ya dayanırken retrieval m.265 çevresini getiriyor, filtre
  // "5237 zaten var" deyip dışarıdan da çekmiyordu. Madde ne korpustan ne
  // dışarıdan geliyor, hakem de haklı olarak "metinde yer almamaktadır"
  // diyordu. 132 unsupported kararın 97'si (%73) bu sebepten.
  const refs = extractLawRefs(questions.map((q) => q.explanation).join(" "));
  const eksik = refs.filter((r) => !hasArticle(law, r.madde));

  // Eksik maddeyi ÖNCE korpusun tam metninden çek: kanunlar korpusta
  // eksiksiz (TCK 223 parça, TTK 766 parça); sorun yalnızca retrieval'ın
  // o parçayı getirmemesi. FTS'ten çekmek bedava ve tam metin, canlı
  // mevzuata düşmek ise ağ çağrısı.
  const fromCorpus = env.DB ? await fetchCorpusArticles(env.DB, eksik) : "";
  const halaEksik = eksik.filter((r) => !hasArticle(fromCorpus, r.madde));
  const external = halaEksik.length
    ? await fetchExternalLaws(halaEksik, questions[0].question)
    : "";

  const provider = new DeepSeekProvider(env.DEEPSEEK_API_KEY, "deepseek-reasoner");
  let raw = "";
  for await (const tok of provider.streamChat(
    // Korpustan hedefli çekilen maddeler de EK_MEVZUAT'a giriyor: retrieval'ın
    // kaçırdığı madde burada, hakemin göreceği yerde olmalı.
    `<KANUN>\n${law}\n</KANUN>` +
      (fromCorpus || external
        ? `\n\n<EK_MEVZUAT>\n${[fromCorpus, external].filter(Boolean).join("\n\n")}\n</EK_MEVZUAT>`
        : "") +
      `\n\n<SORULAR>\n${body}\n</SORULAR>`,
    SYSTEM
  )) {
    raw += tok;
  }

  const parsed = parseLlmJson<unknown[]>(raw);
  if (!Array.isArray(parsed)) return [];

  const known = new Set(questions.map((q) => q.id));
  const out: Verdict[] = [];
  for (const item of parsed) {
    const v = normalizeVerdict(item);
    // Modelin uydurduğu id'leri alma — yanlış soruyu işaretlemek,
    // hiç işaretlememekten kötü.
    if (v && known.has(v.id)) out.push(v);
  }
  return out;
}

export function normalizeVerdict(item: unknown): Verdict | null {
  if (!item || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const verdict = String(o.verdict ?? "").toLowerCase().trim();
  if (!id) return null;
  if (
    verdict !== "correct" &&
    verdict !== "wrong" &&
    verdict !== "unsupported" &&
    verdict !== "ambiguous"
  ) {
    return null;
  }
  return {
    id,
    verdict: verdict as Verdict["verdict"],
    reason: typeof o.reason === "string" ? o.reason.trim().slice(0, 500) : "",
  };
}
