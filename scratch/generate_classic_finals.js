const fs = require('fs');
const path = require('path');

const dir = path.join('/Users/efekarakoyun/hukukçalışma/uygulama/frontend/data/practice_cases');

function appendCases(filename, newCases) {
  const filePath = path.join(dir, filename);
  let data = [];
  if (fs.existsSync(filePath)) {
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch(e) {
      data = [];
    }
  } else {
    data = [];
  }
  
  let startIdx = data.length + 500; 

  newCases.forEach((c, idx) => {
    c.id = `${c.course}_FINAL_${startIdx + idx}`;
    data.unshift(c); 
  });

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

const cases = {
  "borclar_genel": [
    {
      course: "borclar_genel",
      title: "Klasik Final: Hata ve Hile Kesişimi, Sözleşmenin İptali",
      difficulty: "zor",
      scenario: "(A), antika eşya koleksiyoncusu (B)'nin mağazasına giderek, 18. yüzyıla ait olduğunu düşündüğü bir vazoyu 50.000 TL'ye satın almak ister. (B), vazonun aslında 20. yüzyıla ait sıradan bir reprodüksiyon olduğunu bilmesine rağmen, (A)'nın bu yanlış inancından faydalanmak için ses çıkarmaz ve hatta 'Bu vazo koleksiyonunuzun en nadide parçası olacak' diyerek satışı gerçekleştirir. Bir ay sonra gerçeği öğrenen (A), (B)'ye karşı hangi hukuki yollara başvurabilir? Süreleri ve sonuçları ile açıklayınız.",
      ideal_solution: "Olayda (A), vazonun niteliğinde (esaslı noktasında) yanılmaktadır (TBK m.31 - Saikte esaslı yanılma/Temel Hatası). Ancak (B), (A)'nın bu hatasını bilmekte ve 'en nadide parçanız olacak' diyerek bu hatayı pekiştirmekte, aldatma (hile) kastıyla hareket etmektedir. (TBK m.36). Hile durumunda, hata esaslı olmasa bile sözleşme iptal edilebilir. (A), durumu öğrendiği tarihten itibaren 1 yıl içinde (TBK m.39) sözleşme ile bağlı olmadığını bildirerek ödediği 50.000 TL'nin iadesini (sebepsiz zenginleşme hükümlerine göre) talep edebilir. Ayrıca (B)'nin hilesi haksız fiil teşkil ettiğinden, (A) uğradığı menfi zararın tazminini de isteyebilir.",
      key_points: ["Hile (Aldatma)", "Temel hatası (Esaslı yanılma)", "1 yıllık hak düşürücü süre", "Sözleşmenin iptali (Nispi butlan)", "Menfi zarar"],
      topics: ["İrade Sakatlıkları", "Hata", "Hile"]
    },
    {
      course: "borclar_genel",
      title: "Klasik Final: Temsil Yetkisinin Kapsamı ve Yetkisiz Temsil",
      difficulty: "orta",
      scenario: "İş adamı (T), yurt dışı seyahatine çıkmadan önce arkadaşı (V)'ye, 'Garajımdaki 2020 model aracımı en az 400.000 TL'ye sat' diyerek yetki belgesi verir. (V), (T) yurt dışındayken aracı 350.000 TL'ye (Ü)'ye satar ve teslim eder. (T) döndüğünde durumu öğrenir ve aracı geri ister. (Ü) ise geçerli bir sözleşme olduğunu iddia eder. Hukuki durumu değerlendiriniz.",
      ideal_solution: "(V)'ye verilen temsil yetkisi özel ve sınırlandırılmış bir yetkidir (en az 400.000 TL). (V), aracı 350.000 TL'ye satarak temsil yetkisinin sınırlarını aşmıştır. Yetki sınırının aşılması durumunda yetkisiz temsil (TBK m.46) hükümleri uygulanır. Yetkisiz temsilcinin yaptığı işlem, temsil olunan (T) tarafından onanmadıkça (icazet verilmedikçe) onu bağlamaz. (T), işleme icazet vermediği için satış sözleşmesi kesin olarak hükümsüzdür (askıda geçersizlik sona ermiştir). (T), mülkiyet hakkına dayanarak (Ü)'den aracın iadesini (istihkak davası) talep edebilir. (Ü) ise iyiniyetli olsa bile mülkiyeti kazanamaz, sadece yetkisiz temsilci (V)'den uğradığı menfi (şartları varsa müspet) zararı talep edebilir (TBK m.47).",
      key_points: ["Yetkisiz temsil", "Temsil yetkisinin aşılması", "İcazet (Onay)", "Askıda geçersizlik", "İstihkak davası"],
      topics: ["Temsil", "Yetkisiz Temsil"]
    }
  ],
  "medeni_hukuk": [
    {
      course: "medeni_hukuk",
      title: "Klasik Final: Tüzel Kişilerde Organın Haksız Fiilinden Sorumluluk",
      difficulty: "orta",
      scenario: "(X) Derneği'nin yönetim kurulu başkanı (Y), dernek adına düzenlenen bir kermeste çıkan tartışma sonucunda, kermese katılan (Z)'yi darp ederek yaralamıştır. (Z), hastane masrafları ve manevi tazminat için kime veya kimlere karşı dava açabilir? Gerekçelendiriniz.",
      ideal_solution: "TMK m.50 gereğince, tüzel kişinin organları, hukuki işlemleri ve diğer bütün fiilleriyle tüzel kişiyi borç altına sokarlar. Organların haksız fiillerinden dolayı tüzel kişi doğrudan doğruya ve kusursuz olarak sorumludur. Yönetim kurulu başkanı (Y), derneğin zorunlu organıdır ve fiili dernek faaliyeti (kermes) sırasında işlenmiştir. Bu nedenle (X) Derneği, (Y)'nin haksız fiilinden dolayı (Z)'ye karşı sorumludur. Ayrıca haksız fiili bizzat işleyen (Y) de kendi kusuru nedeniyle şahsen sorumludur. (Z), uğradığı zararın tazmini için (X) Derneği'ne ve (Y)'ye karşı müteselsilen dava açabilir (TMK m.50/3).",
      key_points: ["Tüzel kişinin organı", "Organın haksız fiili", "TMK m.50", "Müteselsil sorumluluk"],
      topics: ["Kişiler Hukuku", "Tüzel Kişiler"]
    }
  ],
  "esya_hukuku": [
    {
      course: "esya_hukuku",
      title: "Klasik Final: Rehinli Alacaklının Hakları ve Lex Commissoria Yasağı",
      difficulty: "zor",
      scenario: "(M), (N)'den aldığı 100.000 TL borca karşılık, kendisine ait 150.000 TL değerindeki tabloyu (N)'ye rehin olarak teslim etmiştir. Taraflar arasındaki sözleşmede, '(M) borcunu vadesinde ödemezse, tablonun mülkiyeti doğrudan (N)'ye geçecektir' şeklinde bir madde bulunmaktadır. Vade geldiğinde (M) borcunu ödeyemez. (N), sözleşmedeki maddeye dayanarak tablonun maliki olduğunu iddia edebilir mi?",
      ideal_solution: "Taraflar arasındaki sözleşmede yer alan, borcun ödenmemesi halinde rehinli malın mülkiyetinin alacaklıya geçeceğine ilişkin anlaşma 'Lex Commissoria (Mürتهin mülk edinme) yasağı' kapsamında kesin olarak hükümsüzdür (TMK m.873). Kanun koyucu, zorda kalan borçlunun sömürülmesini engellemek için bu yasağı getirmiştir. (N), tablonun mülkiyetini doğrudan kazanamaz. (N)'nin yapması gereken, İcra ve İflas Kanunu hükümlerine göre rehnin paraya çevrilmesi yoluyla takip başlatarak tabloyu icra dairesi aracılığıyla sattırmak ve alacağını satış bedelinden tahsil etmektir.",
      key_points: ["Rehin hakkı", "Lex commissoria yasağı", "TMK m.873", "Rehnin paraya çevrilmesi"],
      topics: ["Ayni Haklar", "Rehin"]
    }
  ],
  "idari_yargilama": [
    {
      course: "idari_yargilama",
      title: "Klasik Final: İdari İşlemin Unsurları ve İptal Davası",
      difficulty: "orta",
      scenario: "İçişleri Bakanlığı tarafından, Ankara Valisi olarak görev yapan (V), hiçbir somut gerekçe gösterilmeden ve kamu yararı amacı taşımayan siyasi saiklerle görevden alınarak merkeze atanmıştır. (V), bu işlemin iptali için dava açmak istemektedir. Hangi mahkemede, işlemin hangi unsurları yönünden sakat olduğunu ileri sürerek dava açmalıdır?",
      ideal_solution: "Valilerin atanması ve görevden alınması işlemleri Müşterek Kararname veya Cumhurbaşkanı kararı ile olur. Bu tür üst düzey atama iptal davalarına ilk derece mahkemesi sıfatıyla Danıştay bakar (Danıştay Kanunu m.24). (V), işlemin 'Sebep' ve 'Maksat' unsurları yönünden sakat olduğunu ileri sürmelidir. İdari işlemin 'sebep' unsuru hukuka ve gerçeğe uygun olmalıdır; olayda hiçbir somut gerekçe gösterilmemiştir (Sebep sakatlığı). Ayrıca her idari işlemin amacı 'kamu yararı' olmak zorundadır. Siyasi saiklerle yapılan bir işlem 'Maksat' (Yetki saptırması) unsuru yönünden hukuka aykırıdır. (V), bu gerekçelerle Danıştay'da iptal davası açmalıdır.",
      key_points: ["İptal davası", "Görevli mahkeme (Danıştay)", "Sebep unsuru", "Maksat unsuru (Yetki saptırması)"],
      topics: ["İdari İşlemler", "İptal Davası", "Görev ve Yetki"]
    }
  ],
  "ceza_genel": [
    {
      course: "ceza_genel",
      title: "Klasik Final: Meşru Müdafaa ve Sınırın Aşılması",
      difficulty: "zor",
      scenario: "Gece vakti yolda yürüyen (K)'nın önü, elinde bıçak bulunan (S) tarafından kesilir. (S), (K)'nın çantasını ve cüzdanını ister. (K), çantasındaki ruhsatlı silahını çıkararak (S)'yi korkutmak ister ancak (S) bıçakla (K)'nın üzerine hamle yapınca (K) ateş eder ve (S)'yi bacağından yaralar. (S) yere düştükten ve bıçağı elinden fırladıktan sonra (K), öfkesine hakim olamayarak yerde yatan (S)'ye bir el daha ateş ederek onu öldürür. (K)'nın ceza sorumluluğunu değerlendiriniz.",
      ideal_solution: "(K)'nın ilk ateşi, kendisine yönelmiş haksız ve mevcut bir saldırıyı defetmek amacıyla yapıldığından TCK m.25 kapsamında 'Meşru Müdafaa'dır ve bu eylemden dolayı ceza verilmez. Ancak (S) yere düştükten ve saldırı tehlikesi (bıçak fırladıktan sonra) tamamen ortadan kalktıktan sonra (K)'nın ikinci kez ateş etmesi meşru müdafaa kapsamında değildir. Saldırı bitmiştir. İkinci atış kasten öldürme suçunu oluşturur. Ancak (K), bu fiili kendisine karşı işlenen haksız fiilin (gasp girişimi) meydana getirdiği hiddet veya şiddetli elemin etkisi altında işlediği için TCK m.29 kapsamında 'Haksız Tahrik' hükümlerinden faydalanarak cezasında indirim yapılmalıdır. Sınırın heyecan, korku ve telaşla aşılması (TCK m.27/2) şartları olayda gerçekleşmemiştir çünkü saldırı bitmiş ve (K) öfkeyle hareket etmiştir.",
      key_points: ["Meşru müdafaa", "Saldırının sona ermesi", "Kasten öldürme", "Haksız tahrik"],
      topics: ["Hukuka Uygunluk Nedenleri", "Meşru Müdafaa", "Haksız Tahrik"]
    }
  ]
};

for (let course in cases) {
  appendCases(`${course}.json`, cases[course]);
}

console.log('Appended CLASSIC FINAL Exam cases to data successfully.');
