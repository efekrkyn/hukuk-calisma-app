/**
 * İKİNCİ HAKEM — bağımsız çapraz denetim.
 *
 * NEDEN VAR: üretici (deepseek-chat) ile birinci hakem (deepseek-reasoner)
 * aynı model ailesinden. Aynı aile aynı körlüğü paylaşabilir ve tek hakemli
 * denetimde bunu fark etmenin yolu yok — hakem kendi kör noktasını kendi
 * göremez. Elle denetlenen 50 soruluk örneklemde bulunan kusurların TAMAMI
 * aynı türdeydi (birden fazla şık doğru), yani körlük rastgele değil sistematik.
 * Farklı aileden (Gemini) ikinci bir okuma, hatanın ortak mı yoksa modele mi
 * özgü olduğunu ölçülebilir hâle getirir.
 *
 * BAĞIMSIZLIK NEREDE, NEREDE DEĞİL:
 *  - Bağımsız olan MODEL ve İSTEM. İstem, hmgs-verify.ts'teki SYSTEM'in kopyası
 *    DEĞİL; aynı cümleleri vermek aynı düşünce yolunu dayatır ve ikinci hakem
 *    birincinin taklidi olur. Görev burada başka bir sırayla kuruluyor:
 *    "önce şıklara bakmadan kendin çöz, sonra her şıkkı tek tek kaynağa karşı
 *    tart" — savunma değil, yeniden çözüm.
 *  - Bağımsız OLMAYAN, olmaması gereken şey KAYNAK. İki hakem de aynı kanun
 *    metnini görmeli; yoksa anlaşmazlık "farklı gördüler"den doğar ve ölçüm
 *    modelin değil retrieval'ın gürültüsünü gösterir. Bu yüzden bağlam
 *    hmgs-verify.ts'teki kalıbın aynısı.
 *
 * NOT — kod tekrarı bilinçli: hmgs-verify.ts'in ek kaynak çekme yardımcıları
 * dışa aktarılmıyor ve o dosya bu iş kapsamında değiştirilemiyor. Bağlam
 * eşitliği tekrarı önlemekten önemli: eksik bağlamla çalışan ikinci hakem
 * sağlam soruya "unsupported" der ve soru havuzdan haksız yere düşer.
 */

import { embedQuery, retrieve } from "./rag";
import { GeminiProvider } from "./ai-provider";
import { parseLlmJson } from "./llm-json";
import type { HmgsSubject } from "./hmgs-subjects";
import { extractLawRefs } from "./law-refs";
import { callMcpTool, unwrapMcpResult } from "./mcp-client";
// normalizeVerdict yeniden yazılmıyor: iki hakemin karar türleri birebir aynı
// süzgeçten geçmezse kararlar karşılaştırılamaz hâle gelir.
import { hasArticle, normalizeVerdict, type QuestionToCheck, type Verdict } from "./hmgs-verify";

const MEVZUAT_MCP_URL = "https://mevzuat.surucu.dev/mcp";
const MAX_LOOKUPS = 3;
const CROSS_MODEL = "gemini-2.5-flash";

export { CROSS_MODEL };

/**
 * Retrieval'ın kaçırdığı kaynakları hedefli çeker (hmgs-verify.ts ile aynı üç yol).
 *
 * Sıra ucuzdan pahalıya: FTS tam metin -> canlı mevzuat MCP -> sorunun yazıldığı
 * parça. Biri patlarsa denetim durmuyor, o kaynak eksik kalıyor.
 */
async function fetchEkKaynak(
  db: D1Database | undefined,
  questions: QuestionToCheck[],
  law: string
): Promise<string> {
  const out: string[] = [];

  // Atıf yapılan MADDE getirilen metinde var mı — kanun var mı değil. Soru
  // TCK m.6'ya dayanırken retrieval m.265 çevresini getirmişse hakem hükmü
  // hiç göremiyor ve haklı olarak "metinde yok" diyor.
  const refs = extractLawRefs(questions.map((q) => q.explanation).join(" "));
  let eksik = refs.filter((r) => !hasArticle(law, r.madde));

  if (db) {
    const korpus: string[] = [];
    for (const ref of eksik.slice(0, MAX_LOOKUPS)) {
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
          korpus.push(`### ${ref.mevzuatNo} sayılı Kanun m.${ref.madde} (korpus)\n${r.text}`);
        }
      } catch (e) {
        console.error(`çapraz: korpus m.${ref.madde} çekilemedi:`, e);
      }
    }
    const korpusText = korpus.join("\n\n");
    if (korpusText) out.push(korpusText);
    eksik = eksik.filter((r) => !hasArticle(korpusText, r.madde));
  }

  // Korpusta hiç olmayan kanunlar (FSEK, Avukatlık Kanunu) canlı mevzuattan.
  for (const ref of eksik.slice(0, MAX_LOOKUPS)) {
    try {
      const res = await callMcpTool(MEVZUAT_MCP_URL, "search_within_kanun", {
        mevzuat_no: ref.mevzuatNo,
        keyword: ref.madde ? `madde ${ref.madde}` : questions[0].question.slice(0, 80),
      });
      const r = unwrapMcpResult(res);
      const text = typeof r?.raw === "string" ? r.raw : JSON.stringify(r);
      if (text && text.length > 40) {
        out.push(
          `### ${ref.mevzuatNo} sayılı Kanun${ref.madde ? ` m.${ref.madde}` : ""}\n${text.slice(0, 4000)}`
        );
      }
    } catch (e) {
      console.error(`çapraz: mevzuat ${ref.mevzuatNo} çekilemedi:`, e);
    }
  }

  // Sorunun yazıldığı parça. Doktrin sorusunda madde atfı yok, doğrulamanın
  // tek güvenilir bağı bu; komşu sayfalar da alınıyor çünkü kavram sayfa
  // sınırında bölünebiliyor.
  if (db) {
    const eslek = new Map<string, number>();
    for (const q of questions) {
      if (q.source_pdf && q.source_page != null) eslek.set(q.source_pdf, q.source_page);
    }
    for (const [pdf, page] of [...eslek].slice(0, MAX_LOOKUPS)) {
      try {
        const rows = await db
          .prepare(
            `SELECT text, page_start FROM fts_chunks
              WHERE pdf = ? AND page_start BETWEEN ? AND ?
              ORDER BY page_start LIMIT 6`
          )
          .bind(pdf, page - 1, page + 1)
          .all<{ text: string; page_start: number }>();
        for (const r of rows.results) {
          out.push(`### ${pdf} (s.${r.page_start}) — sorunun yazıldığı kaynak\n${r.text}`);
        }
      } catch (e) {
        console.error(`çapraz: kaynak parça çekilemedi (${pdf} s.${page}):`, e);
      }
    }
  }

  return out.filter(Boolean).join("\n\n");
}

/**
 * İSTEM NEDEN BÖYLE KURULDU.
 *
 * Birinci hakemin istemi "hata bul" duruşuyla, işaretli cevabı savunma/çürütme
 * ekseninde kurulu. Aynı istemi vermek ikinci hakemi birincinin kopyası yapardı;
 * iki kopyanın anlaşması hiçbir şey kanıtlamaz.
 *
 * Buradaki kurgu farklı: hakem önce ŞIKLARA BAKMADAN soruyu kendisi çözüyor,
 * sonra her şıkkı ayrı ayrı kaynağa karşı tartıyor. Ankraj tersine çevriliyor —
 * işaretli cevap bir başlangıç noktası değil, en sonda karşılaştırılan bir veri.
 *
 * Belirsizlik kontrolü İSTEMDEN ÇIKARILAMAZ: elle denetlenen 50 sorunun tüm
 * kusurları "birden fazla şık doğru" türündeydi. Ama burada soyut talimatla
 * değil, ZORUNLU BİR ALANLA yaptırılıyor: model her soru için kaynak metnin
 * desteklediği şık harflerini "savunulabilir" alanına yazmak zorunda. Örnek
 * vermek yerine yapı dayatmak bilinçli — birinci hakemin istemindeki iki somut
 * örneği kopyalasaydım ikinci hakeme aynı önyargıyı da kopyalamış olurdum.
 * Alanın ayrıca kod tarafında bir faydası var: model analizi doğru yapıp
 * kararı yanlış verirse (klasik "hepsini onayla" eğilimi) kod düzeltiyor.
 */
const SYSTEM = `Sen bir hukukçusun. Görevin, sana verilen çoktan seçmeli soruyu
SIFIRDAN kendin çözmek ve sonra sorunun tek doğru cevabı olup olmadığını raporlamak.

Bu ikinci bir görüştür. Soru daha önce başka bir denetimden geçmiş olabilir;
o kararı bilmiyorsun, bilmene de gerek yok. Kendi okumanı yap.

Elindeki tek bilgi kaynağı <KANUN> ve varsa <EK_KAYNAK> bölümleridir.
<EK_KAYNAK>, aynı korpustan ya da canlı mevzuattan hedefli çekilmiş hükümlerdir;
o da kaynaktır ve aynı ağırlıktadır.

ÇALIŞMA SIRAN — bu sırayı bozma, sıra işin kendisidir:

ADIM 1. Soruyu oku, ŞIKLARA HENÜZ BAKMA. Kaynak metinde bu soruyu karara
bağlayan hüküm hangisi? Yoksa, yok de.

ADIM 2. Şimdi şıkları TEK TEK ele al. Her şık için tek bir soruya cevap ver:
"kaynak metinde bu şıkkı DOĞRU kılan bir hüküm var mı?" Şıkkın kulağa mantıklı
gelmesi yetmez; hükmü metinde gösterebiliyor olman gerekir. Bu adımı işaretli
cevaba baktıktan sonra kısaltma — kusurların büyük çoğunluğu tam burada,
gözden geçirilmeyen çeldiricilerde saklı.

ADIM 3. "savunulabilir" alanına, ADIM 2'de metinde karşılığını BULDUĞUN tüm
şıkların harflerini yaz (işaretli cevap da buna dahil, eğer destekleniyorsa).
Bu alan zorunlu.

ADIM 4. Kararını ver:
- "correct"     : savunulabilir listesinde YALNIZCA işaretli cevap var.
- "ambiguous"   : savunulabilir listesinde işaretli cevabın DIŞINDA da şık var.
                  Soru bozuk; işaretli cevap doğru olsa bile bu kararı ver,
                  çünkü sınavda o soruyu çözen kişi haksız yere yanlış yapar.
- "wrong"       : savunulabilir listesinde işaretli cevap YOK ama başka bir şık
                  var; ya da açıklama kendi içinde çelişiyor (bir şeyi söyleyip
                  tersini işaretlemek).
- "unsupported" : savunulabilir liste boş — kaynak metinde bu soruyu karara
                  bağlayacak hüküm yok.

DEĞİŞMEZ KURAL: kendi hafızandaki hukuk bilginle boşluk DOLDURMA. Bildiğin bir
hüküm metinde yoksa yok sayılır ve "unsupported" dersin. Denetimin tüm değeri
bu kuralda: hafızasından cevaplayan hakem, üreticinin hatasını tekrarlar.

reason alanına kısa ve somut gerekçe yaz: hangi madde, neden. "ambiguous" ya da
"wrong" dediysen hangi şıkkı hangi hükmün desteklediğini açıkça yaz.

SADECE JSON dizisi döndür, başka hiçbir şey yazma.
FORMAT: [{"id":"...","savunulabilir":["B"],"verdict":"correct","reason":"..."}]`;

export async function crossCheck(
  env: { AI: Ai; VECTORIZE: VectorizeIndex; DB?: D1Database; GEMINI_KEY: string },
  subject: HmgsSubject,
  questions: QuestionToCheck[]
): Promise<Verdict[]> {
  if (questions.length === 0) return [];
  const course = subject.ragCourse ?? "kanunlar";
  if (subject.lawFiles.length === 0 && !subject.ragCourse && !subject.doctrineSubtopics?.length) {
    return [];
  }

  // Bağlam kurulumu birinci hakemle BİREBİR aynı: aynı sorgu (soru + açıklama),
  // aynı topK, aynı lawFiles çapası, doktrin için aynı ikinci korpus. Fark
  // modelden gelmeli; bağlamdan gelen fark ölçümü bozar.
  const docSubs = subject.doctrineSubtopics ?? [];
  const doktrinVar =
    docSubs.length > 0 && questions.some((q) => q.subtopic && docSubs.includes(q.subtopic));

  const query = questions.map((q) => `${q.question} ${q.explanation}`).join(" ");
  const qVec = await embedQuery(query, env.AI);
  const all = await retrieve(env.VECTORIZE, env.DB, query, qVec, env.AI, course, 80);
  const lawChunks = subject.lawFiles.length
    ? all.filter((c) => subject.lawFiles.some((f) => c.pdf.includes(f)))
    : all;

  const docChunks = doktrinVar
    ? await retrieve(env.VECTORIZE, env.DB, query, qVec, env.AI, "hmgs_ozet", 30)
    : [];

  const chunks = [...lawChunks, ...docChunks];
  if (chunks.length === 0) return [];

  const law = chunks
    .map((c, i) => `[${i + 1}] ${c.pdf} (s.${c.page_start}):\n${c.text}`)
    .join("\n\n");

  const ek = await fetchEkKaynak(env.DB, questions, law);

  const body = questions
    .map(
      (q) =>
        `id: ${q.id}\nSORU: ${q.question}\nŞIKLAR:\n` +
        q.options.map((o, i) => `  ${String.fromCharCode(65 + i)}) ${o}`).join("\n") +
        `\nİŞARETLENEN DOĞRU: ${String.fromCharCode(65 + q.correctAnswer)}\n` +
        `AÇIKLAMA: ${q.explanation}`
    )
    .join("\n\n---\n\n");

  // ponytail: GeminiProvider `thinkingBudget: 0` ile çalışıyor, yani ikinci
  // hakem muhakeme yapmadan karar veriyor (birinci hakem deepseek-reasoner ise
  // yapıyor). Bunu telafi eden şey istemdeki zorunlu "savunulabilir" alanı ve
  // aşağıdaki kod düzeltmesi — analiz yapıya bağlandığı için modelin kendi
  // muhakemesine daha az bağımlı. /cross-stats'ta anlaşma oranı %100'e ya da
  // %0'a yapışırsa çevrilecek ilk vida budur: ai-provider.ts'te GeminiProvider'a
  // isteğe bağlı bir thinkingBudget parametresi (varsayılan 0, mevcut çağıranlar
  // etkilenmez) eklenip buradan açılır. Gemini 2.5'te düşünme token'ları
  // maxOutputTokens'a dahil olduğu için o sınır da birlikte büyütülmeli.
  const provider = new GeminiProvider(env.GEMINI_KEY, CROSS_MODEL);
  let raw = "";
  for await (const tok of provider.streamChat(
    `<KANUN>\n${law}\n</KANUN>` +
      (ek ? `\n\n<EK_KAYNAK>\n${ek}\n</EK_KAYNAK>` : "") +
      `\n\n<SORULAR>\n${body}\n</SORULAR>`,
    SYSTEM
  )) {
    raw += tok;
  }

  const parsed = parseLlmJson<unknown[]>(raw);
  if (!Array.isArray(parsed)) return [];

  // İşaretli cevabın harfi: "savunulabilir" listesindeki fazlalığı ölçmek için.
  const isaretli = new Map(
    questions.map((q) => [q.id, String.fromCharCode(65 + q.correctAnswer)])
  );

  const out: Verdict[] = [];
  for (const item of parsed) {
    const fixed = ambiguousDuzelt(item, isaretli);
    const v = normalizeVerdict(fixed);
    // Modelin uydurduğu id'ler alınmıyor — yanlış soruyu havuzdan düşürmek,
    // hiç düşürmemekten kötü.
    if (v && isaretli.has(v.id)) out.push(v);
  }
  return out;
}

/**
 * Modelin kendi analizini kararına yansıtmadığı hâli düzeltir.
 *
 * Gözlenen eğilim: model çeldiricileri düzgün tarar, birinin de desteklendiğini
 * yazar, sonra alışkanlıkla "correct" der. İstem "savunulabilir" alanını zorunlu
 * kıldığı için bu tutarsızlık artık GÖRÜLEBİLİR durumda; görünen tutarsızlığı
 * modele bırakmak yerine kod düzeltiyor.
 *
 * Yalnızca "correct" -> "ambiguous" yönünde çalışır. Ters yön yapılmıyor:
 * "wrong"/"unsupported" daha ağır kusurlar, onları listeye bakıp hafifletmek
 * modelin gerekçesini kodun tahminiyle ezmek olurdu.
 */
function ambiguousDuzelt(item: unknown, isaretli: Map<string, string>): unknown {
  if (!item || typeof item !== "object") return item;
  const o = item as Record<string, unknown>;
  if (String(o.verdict ?? "").toLowerCase().trim() !== "correct") return item;

  const id = typeof o.id === "string" ? o.id.trim() : "";
  const dogru = isaretli.get(id);
  if (!dogru || !Array.isArray(o.savunulabilir)) return item;

  const fazla = o.savunulabilir
    .map((s) => String(s).trim().charAt(0).toUpperCase())
    .filter((h) => /^[A-E]$/.test(h) && h !== dogru);
  if (fazla.length === 0) return item;

  return {
    ...o,
    verdict: "ambiguous",
    reason: `Model ${fazla.join(", ")} şıkkını da kaynakta savunulabilir buldu. ${String(o.reason ?? "")}`,
  };
}
