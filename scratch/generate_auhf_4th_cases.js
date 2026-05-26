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
  
  let startIdx = data.length + 800; 

  newCases.forEach((c, idx) => {
    c.id = `${c.course}_AUHF4_${startIdx + idx}`;
    data.unshift(c); 
  });

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

const cases = {
  "ceza_muhakemesi": [
    {
      course: "ceza_muhakemesi",
      title: "AÜHF Özel: Tutuklama Şartları ve İtiraz",
      difficulty: "zor",
      scenario: "Şüpheli (A), kasten adam öldürme suçlamasıyla gözaltına alınmış ve savcı tarafından tutuklama talebiyle Sulh Ceza Hakimliğine sevk edilmiştir. Hakim, (A)'nın sabit ikametgahı olmasına ve delillerin büyük oranda toplanmış olmasına rağmen, suçun katalog suçlardan (TCK m.81) olması ve toplumda infial yaratması gerekçesiyle tutuklama kararı vermiştir. (A)'nın avukatı olarak bu karara karşı nasıl bir yol izlersiniz? Gerekçelerinizi belirtiniz.",
      ideal_solution: "CMK m.100 gereği tutuklama kararı verilebilmesi için kuvvetli suç şüphesinin varlığını gösteren somut delillerin bulunması ve bir tutuklama nedeninin (kaçma veya delil karartma şüphesi) bulunması gerekir. Katalog suçlarda tutuklama nedeninin var sayılabileceği bir karine (CMK m.100/3) olsa da, bu karine mutlak değildir ve hakimin somut olayda tutuklamanın orantılı olup olmadığını değerlendirmesi zorunludur. Şüphelinin sabit ikametgahının olması ve delillerin toplanmış olması, kaçma ve delil karartma şüphesini zayıflatmaktadır. Ayrıca salt 'toplumda infial yaratması' hukuki bir tutuklama nedeni değildir. Kararın tefhim veya tebliğinden itibaren 7 gün içinde Asliye Ceza Mahkemesi nezdinde (veya bir sonraki Sulh Ceza Hakimliğinde) itiraz yoluna başvurulmalı ve adli kontrol hükümlerinin (CMK m.109) neden yetersiz kaldığının hakimlikçe gerekçelendirilmediği (CMK m.101/2) vurgulanmalıdır.",
      key_points: ["Katalog suçlar karinesi", "Tutuklama nedenleri (CMK m.100)", "Orantılılık ilkesi", "İtiraz süresi (7 gün)", "Adli kontrol önceliği"],
      topics: ["Koruma Tedbirleri", "Tutuklama", "İtiraz Kanun Yolu"]
    },
    {
      course: "ceza_muhakemesi",
      title: "AÜHF Özel: İddianamenin İadesi",
      difficulty: "orta",
      scenario: "Cumhuriyet Savcısı, şüpheli (B) hakkında 'Hırsızlık' suçundan iddianame düzenleyerek Asliye Ceza Mahkemesine sunmuştur. İddianamede şüphelinin kimlik bilgileri, atılı suç ve sevk maddeleri yer almakta ancak suçu nasıl işlediğine dair hiçbir olgu, delillerle ilişkilendirilerek anlatılmamıştır. Mahkeme başkanı bu durumu fark eder. Hukuki süreç nasıl işlemelidir?",
      ideal_solution: "CMK m.170'e göre iddianamede bulunması gereken zorunlu unsurlar vardır. Bunlardan en önemlisi, yüklenen suçu oluşturan olayların mevcut delillerle ilişkilendirilerek açıklanmasıdır. Mahkeme, iddianamenin CMK m.170'teki şartları taşımadığını, yani olayın anlatımının delillerle irtibatlandırılmadığını (illiyet bağının kurulmadığını) tespit ederse, iddianamenin iadesine karar vermelidir. İade kararı, iddianamenin mahkemeye verildiği tarihten itibaren 15 gün içinde verilmelidir (CMK m.174). Savcı, eksiklikleri tamamladıktan sonra yeniden iddianame düzenleyebilir.",
      key_points: ["İddianamenin unsurları (CMK m.170)", "İddianamenin iadesi (CMK m.174)", "15 günlük süre", "Delillerin ilişkilendirilmesi"],
      topics: ["Soruşturma Evresi", "İddianame"]
    }
  ],
  "deniz_ticareti": [
    {
      course: "deniz_ticareti",
      title: "AÜHF Özel: Müşterek Avarya (General Average)",
      difficulty: "zor",
      scenario: "İstanbul'dan Marsilya'ya yük taşıyan 'M/V Akdeniz' gemisi, Ege Denizi'nde şiddetli bir fırtınaya yakalanır. Gemi batma tehlikesi geçirince Kaptan, gemiyi ve diğer yükleri kurtarmak amacıyla güvertedeki (X) firmasına ait 50 tonluk demir yükünün denize atılmasına karar verir. Gemi sağ salim limana ulaşır. (X) firması zararını kimden ve nasıl talep edebilir?",
      ideal_solution: "Bu olayda tipik bir Müşterek Avarya (General Average) durumu vardır. TTK m.1272'ye göre müşterek avaryadan söz edilebilmesi için; gemiyi, yükü ve navlunu tehdit eden ortak bir tehlike olmalı, bu tehlikeden kurtulmak için kaptan tarafından olağanüstü bir fedakarlık (yükün denize atılması) yapılmalı, bu fedakarlık makul ve iradi olmalı ve faydalı bir sonuç doğurmalıdır. Olayda tüm şartlar mevcuttur. Bu nedenle (X) firmasının zararı (feda edilen yük), kurtulan diğer değerlerin sahipleri (gemi maliki, diğer yük sahipleri ve navlun alacaklısı) tarafından kurtulan değerleri oranında paylaşılarak (garame usulü) tazmin edilir. Dispeççi (avarya hesaplayıcısı) tarafından bir dispeç raporu hazırlanır ve (X) bu rapora dayanarak alacağını tahsil eder.",
      key_points: ["Müşterek avarya şartları (TTK m.1272)", "Ortak tehlike", "İradi fedakarlık", "Faydalı sonuç", "Dispeç raporu ve paylaştırma"],
      topics: ["Deniz Kazaları", "Müşterek Avarya"]
    }
  ],
  "is_hukuku": [
    {
      course: "is_hukuku",
      title: "AÜHF Özel: Alt İşveren (Taşeron) İlişkisi ve Muvazaa",
      difficulty: "zor",
      scenario: "(A) Hastanesi, hastanedeki MR çekimi hizmetlerini (B) Görüntüleme şirketine devretmiştir. (B) şirketi, kendi MR cihazlarını hastaneye kurmuş ve kendi radyoloji teknisyenlerini çalıştırmaktadır. Ancak (A) Hastanesinin başhekimi, (B) şirketinin çalışanlarına günlük mesai saatleri konusunda doğrudan emir ve talimat vermektedir. (B) şirketinin teknisyeni (T), kıdem tazminatını alamadığı gerekçesiyle hem (A) hem de (B)'ye dava açar. (A) hastanesi sorumluluğu reddeder. Hukuki durumu değerlendiriniz.",
      ideal_solution: "Asıl işveren-alt işveren ilişkisinin geçerli olabilmesi için alt işverenin (B) ayrı bir organizasyona sahip olması ve işçilerinin sadece bu işyerinde çalışması gerekir. Olayda MR hizmeti uzmanlık gerektiren bir asıl işin bir bölümüdür (İş K. m.2). Ancak alt işverenlik ilişkisinin geçerli olması için asıl işverenin (A), alt işverenin işçilerine doğrudan emir ve talimat vermemesi (yönetim hakkını devretmesi) gerekir. Başhekimin doğrudan emir vermesi, ilişkinin muvazaalı olma ihtimalini (veya en azından sıkı bağımlılığı) gösterir. İş K. m.2/6 uyarınca asıl işveren (A) ile alt işveren (B), alt işverenin işçilerinin iş sözleşmesinden, toplu iş sözleşmesinden ve İş Kanunundan doğan yükümlülüklerinden (kıdem tazminatı dahil) 'birlikte (müteselsilen) sorumludur'. Muvazaa tespiti yapılmasa dahi (A) asıl işveren sıfatıyla kanundan doğan müteselsil sorumluluk gereği (T)'ye tazminatı ödemekle yükümlüdür.",
      key_points: ["Asıl işveren-alt işveren ilişkisi (İş K. m.2)", "Emir ve talimat verme yetkisi (Yönetim hakkı)", "Müteselsil sorumluluk", "Muvazaa ihtimali"],
      topics: ["İş Sözleşmesi", "Alt İşveren", "Kıdem Tazminatı"]
    }
  ],
  "milletlerarasi_ozel": [
    {
      course: "milletlerarasi_ozel",
      title: "AÜHF Özel: Haksız Fiilde Uygulanacak Hukuk (Lex Loci Delicti)",
      difficulty: "orta",
      scenario: "Türk vatandaşı (A), Almanya'da tatil yaparken İtalyan vatandaşı (B)'nin kullandığı kiralık aracın kendisine çarpması sonucu ağır yaralanır. (A), Türkiye'ye döndükten sonra (B) aleyhine Ankara Asliye Hukuk Mahkemesinde maddi ve manevi tazminat davası açar. Türk mahkemesinin milletlerarası yetkisini ve uyuşmazlığa uygulanacak hukuku belirleyiniz.",
      ideal_solution: "MÖHUK m.40 uyarınca, Türk mahkemelerinin milletlerarası yetkisi, iç hukuktaki yer itibarıyla yetki kurallarına göre belirlenir. HMK m.16'ya göre haksız fiilden doğan davalarda zarar görenin (A) yerleşim yeri mahkemesi de yetkilidir. Bu nedenle Ankara mahkemeleri yetkilidir. Uygulanacak hukuk bakımından MÖHUK m.34'e bakılır. Kural olarak haksız fiilden doğan borç ilişkilerine 'haksız fiilin işlendiği yer hukuku (lex loci delicti)' uygulanır. Haksız fiil Almanya'da gerçekleştiğinden olaya Alman maddi hukuku uygulanacaktır. Ancak haksız fiil ile her iki tarafın (A ve B) daha sıkı ilişkili olduğu başka bir hukuk varsa o da dikkate alınabilir, fakat olayda kural olarak Alman hukuku geçerlidir.",
      key_points: ["Milletlerarası yetki (MÖHUK m.40 ve HMK m.16)", "Zarar görenin yerleşim yeri mahkemesi", "Lex loci delicti (MÖHUK m.34)", "Haksız fiilin işlendiği yer hukuku"],
      topics: ["Kanunlar İhtilafı", "Haksız Fiiller", "Milletlerarası Yetki"]
    }
  ],
  "kiymetli_evrak": [
    {
      course: "kiymetli_evrak",
      title: "AÜHF Özel: Çekte Tahrifat ve Ödeme",
      difficulty: "zor",
      scenario: "(K), alacaklısı (L)'ye 10.000 TL bedelli bir çek düzenleyip verir. Çek çalınır ve çalan kişi (X), çekteki rakamı '110.000 TL' olarak değiştirir (tahrifat) ve çeki (İ)'ye devreder. (İ) iyi niyetlidir. (İ) çeki bankaya ibraz eder ve muhatap banka 110.000 TL ödeme yapar. Tahrifat sonradan anlaşılır. Zarara kim katlanacaktır?",
      ideal_solution: "TTK m.730 atfıyla uygulanan TTK m.748'e göre (Çekte sahtelik ve tahrifat), sahte veya tahrif edilmiş bir çeki ödeyen muhatap banka, zarara kendisi katlanır. Ancak keşidecinin (K) kusuru (örneğin çeki boş bırakması veya rakamları çok kolay değiştirilebilir şekilde yazması) varsa zarar kusuru oranında (K)'ya yansıtılabilir. Olayda (K)'nın özel bir kusurundan bahsedilmemektedir. Tahrifat (metin değişikliği) durumunda bankanın çeki dikkatle inceleme (optik cihazlarla vb.) ve tahrifatı anlama yükümlülüğü (TTK m.812) ağırdır. Banka ödemeyi (K)'nın hesabına borç kaydedemez, zarara kural olarak muhatap banka katlanacaktır.",
      key_points: ["Çekte tahrifat (TTK m.748)", "Muhatap bankanın özen yükümlülüğü", "Kusursuz sorumluluk ilkesi", "Keşidecinin kusuru istisnası"],
      topics: ["Kambiyo Senetleri", "Çek", "Sahtelik ve Tahrifat"]
    }
  ],
  "icra_iflas": [
    {
      course: "icra_iflas",
      title: "AÜHF Özel: İhtiyati Haciz ve Tamamlama Merasimi",
      difficulty: "zor",
      scenario: "Alacaklı (A), borçlu (B)'nin mallarını kaçırmaya hazırlandığını öğrenerek mahkemeden ihtiyati haciz kararı almış ve kararı icra dairesine götürerek (B)'nin aracını haczettirmiştir. Ancak (A), ihtiyati haczin uygulandığı tarihten itibaren 10 gün geçmesine rağmen henüz esas takibe (ilamsız icra) geçmemiş veya dava açmamıştır. (B) bu durumda ne yapabilir?",
      ideal_solution: "İİK m.264'e göre, alacaklı ihtiyati haciz kararını icra dairesine verip uygulattıktan sonra (tamamlama merasimi), kanuni süre olan 7 GÜN içinde esas takibe geçmek veya dava açmak zorundadır. Olayda 10 gün geçmiştir. 7 günlük sürenin kaçırılması halinde ihtiyati haciz kararı KENDİLİĞİNDEN hükümsüz hale gelir (düşer). Borçlu (B), icra müdürlüğüne başvurarak sürenin geçtiğini ve ihtiyati haczin düştüğünü belirterek aracının üzerindeki haczin kaldırılmasını talep etmelidir. İcra müdürü talebi kabul etmek zorundadır.",
      key_points: ["İhtiyati haczi tamamlama süresi (7 gün)", "İİK m.264", "İhtiyati haczin kendiliğinden düşmesi", "Haczin kaldırılması talebi"],
      topics: ["Geçici Hukuki Korumalar", "İhtiyati Haciz"]
    }
  ],
  "genel_kamu": [
    {
      course: "genel_kamu",
      title: "AÜHF Özel: Egemenlik ve Sosyal Sözleşme",
      difficulty: "kolay",
      scenario: "Rousseau'nun 'Sosyal Sözleşme' (Toplum Sözleşmesi) teorisine göre egemenliğin kaynağı nedir ve bu teori günümüz modern demokrasilerinde hangi kavramın temelini oluşturmuştur?",
      ideal_solution: "J.J. Rousseau'ya göre egemenliğin kaynağı bireylerin bir araya gelerek kendi aralarında yaptıkları sözleşmedir (Genel İrade). Bireyler doğal durumdan çıkıp sivil topluma geçerken haklarını bir üst otoriteye tamamen devretmezler, haklarını topluma (genel iradeye) devrederler. Bu durum, egemenliğin bölünemez ve devredilemez olduğunu savunur. Rousseau'nun bu teorisi, günümüz modern demokrasilerinde 'Milli Egemenlik' ve 'Halk Egemenliği' (Özellikle doğrudan ve yarı doğrudan demokrasi) kavramlarının felsefi temelini oluşturmuştur.",
      key_points: ["Rousseau", "Genel İrade", "Milli/Halk Egemenliği", "Bölünemez ve devredilemez egemenlik"],
      topics: ["Egemenlik Teorileri", "Sosyal Sözleşme"]
    }
  ],
  "miras_hukuku": [
    {
      course: "miras_hukuku",
      title: "AÜHF Özel: Ölüme Bağlı Tasarrufların İptali",
      difficulty: "orta",
      scenario: "Mirasbırakan (M), ölümünden kısa bir süre önce ağır demans hastası iken noterde resmi vasiyetname düzenleyerek tüm malvarlığını bakıcısı (B)'ye bırakmıştır. Yasal mirasçı olan çocuğu (Ç), bu durumdan babasının vefatından sonra haberdar olur. (Ç)'nin hukuki hakları nelerdir?",
      ideal_solution: "TMK m.557 uyarınca, ehliyetsizlik nedeniyle ölüme bağlı tasarrufların iptali davası açılabilir. (M), vasiyetnameyi düzenlediği tarihte ağır demans hastası olduğu için fiil ehliyetinin 'ayırt etme gücü' unsurundan yoksundur. Yasal mirasçı (Ç), vasiyetnamenin iptali davasını, vasiyetnamenin kendisine tebliğ edildiği veya durumu öğrendiği tarihten itibaren 1 yıl ve her halükarda vasiyetnamenin açılmasından itibaren 10 yıl içinde (TMK m.559) Asliye Hukuk Mahkemesinde açmalıdır. İptal kararı verilirse vasiyetname geçmişe etkili olarak ortadan kalkar ve yasal mirasçılık kuralları işler.",
      key_points: ["Vasiyetnamenin iptali (TMK m.557)", "Ehliyetsizlik (Ayırt etme gücü yokluğu)", "1 yıllık hak düşürücü süre", "Geçmişe etkili hükümsüzlük"],
      topics: ["Ölüme Bağlı Tasarruflar", "Vasiyetname", "İptal Davası"]
    }
  ]
};

for (let course in cases) {
  appendCases(`${course}.json`, cases[course]);
}

console.log('Appended AÜHF 4. Sınıf specific cases to data successfully.');
