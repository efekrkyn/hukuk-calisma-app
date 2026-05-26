const fs = require('fs');
const path = require('path');

const summariesDir = path.join('/Users/efekarakoyun/hukukçalışma/uygulama/frontend/data/summaries');

const data = {
  "borclar_genel": {
    title: "Borçlar Genel Hukuku Son Gece Özeti",
    items: [
      { topic: "Borç İlişkisinin Kaynakları", content: "Borç, sözleşmeden, haksız fiilden veya sebepsiz zenginleşmeden doğabilir. En yaygın olanı hukuki işlemler, özellikle sözleşmelerdir." },
      { topic: "Sözleşmenin Kurulması", content: "Sözleşme, tarafların iradelerini karşılıklı ve birbirine uygun olarak açıklamalarıyla kurulur. İcap (Öneri) ve Kabul gerekir." },
      { topic: "İrade Sakatlıkları", content: "Yanılma (Hata), Aldatma (Hile) ve Korkutma (İkrah). İradesi sakatlanan taraf, 1 yıl içinde sözleşmeyi iptal edebilir (nispi butlan)." },
      { topic: "Gabin (Aşırı Yararlanma)", content: "Edimler arasındaki açık oransızlık ve bu durumun zarar görenin zor durumundan (müzayaka), düşüncesizliğinden veya tecrübesizliğinden faydalanılarak yaratılmasıdır." },
      { topic: "Temerrüt", "content": "Borçlunun ifa kabiliyeti olan bir borcu zamanında ifa etmemesi halidir. Temerrüt için genellikle ihtar şarttır (İstisna: Kesin vade)." }
    ]
  },
  "borclar_ozel": {
    title: "Borçlar Özel Hukuku Son Gece Özeti",
    items: [
      { topic: "Satış Sözleşmesi", content: "Satıcının zilyetlik ve mülkiyeti devretme, alıcının ise satış bedelini (semen) ödeme borcu altına girdiği tam iki tarafa borç yükleyen sözleşmedir." },
      { topic: "Ayıptan Sorumluluk", content: "Satıcının, satılanın vaat edilen nitelikleri taşımamasından veya değerini/faydasını azaltan eksikliklerden sorumlu olmasıdır. Alıcının gözden geçirme ve bildirim külfeti vardır." },
      { topic: "Kira Sözleşmesi", content: "Kiraya verenin bir şeyin kullanılmasını bedel karşılığında kiracıya bırakmayı üstlendiği sözleşmedir. Konut ve çatılı işyeri kiralarında kiracı güçlü şekilde korunur." },
      { topic: "Eser Sözleşmesi", content: "Yüklenicinin bir eser meydana getirmeyi, işsahibinin de bunun karşılığında bir bedel ödemeyi üstlendiği sözleşmedir. Sonuç (eser) taahhüdü vardır." },
      { topic: "Vekalet Sözleşmesi", content: "Vekilin, vekalet verenin bir işini görmeyi veya işlemini yapmayı üstlendiği sözleşmedir. Sonuç garanti edilmez, özen borcu vardır." }
    ]
  },
  "medeni_hukuk": {
    title: "Medeni Hukuk (Giriş ve Kişiler) Özeti",
    items: [
      { topic: "Hakların Kazanılması", content: "Hakların kazanılmasında iyiniyet (TMK m.3) esastır. Kanunun iyiniyete hukuki bir sonuç bağladığı durumlarda, asıl olan iyiniyetin varlığıdır." },
      { topic: "Hakların Kullanılması", content: "Herkes, haklarını kullanırken ve borçlarını yerine getirirken dürüstlük kurallarına (TMK m.2) uymak zorundadır. Bir hakkın açıkça kötüye kullanılmasını hukuk düzeni korumaz." },
      { topic: "Hak ve Fiil Ehliyeti", content: "Hak ehliyeti tam ve sağ doğmak şartıyla ana rahmine düşüldüğü an başlar. Fiil ehliyeti için ergin olmak, ayırt etme gücüne sahip olmak ve kısıtlı olmamak gerekir." },
      { topic: "Kişiliğin Korunması", content: "Hukuka aykırı olarak kişilik hakkına saldırılan kimse hakimden saldırının durdurulmasını, önlenmesini veya hukuka aykırılığın tespitini isteyebilir." },
      { topic: "Tüzel Kişiler", content: "Kişi (Örn: Dernekler) veya Mal (Örn: Vakıflar) topluluklarıdır. Tüzel kişilik, kanunların emrettiği tescil veya kuruluş anında kazanılır." }
    ]
  },
  "esya_hukuku": {
    title: "Eşya Hukuku Özeti",
    items: [
      { topic: "Ayni Haklar", content: "Sahibine eşya üzerinde doğrudan hakimiyet sağlayan ve herkese karşı ileri sürülebilen mutlak haklardır. Mülkiyet hakkı tam ayni haktır." },
      { topic: "Mülkiyet Hakkı", content: "Malike, hukuk düzeninin sınırları içinde eşya üzerinde dilediği gibi kullanma, yararlanma ve tasarrufta bulunma (usus, fructus, abusus) yetkisi verir." },
      { topic: "Zilyetlik", content: "Eşya üzerindeki fiili hakimiyettir. Zilyetlik bir hak değil, hukuki bir durumdur ancak hukuk düzeni tarafından korunur." },
      { topic: "Tapu Sicili", content: "Ayni hakların (özellikle taşınmazlar üzerindeki) doğması, devredilmesi ve değiştirilmesi için tutulan resmi sicildir. Tescil kurucu veya açıklayıcı olabilir." },
      { topic: "İstihkak ve El Atmanın Önlenmesi", content: "Malik, malını haksız elinde bulunduran kişiye istihkak davası, mülkiyet hakkına yapılan haksız müdahalelere karşı da el atmanın önlenmesi (müdahalenin men'i) davası açabilir." }
    ]
  },
  "ceza_genel": {
    title: "Ceza Hukuku Genel Özeti",
    items: [
      { topic: "Suçun Unsurları", content: "Maddi unsur (Hareket, Netice, Nedensellik Bağı), Manevi Unsur (Kast veya Taksir) ve Hukuka Aykırılık unsurudur." },
      { topic: "Kast ve Taksir", content: "Kast, suçun kanuni tanımındaki unsurların bilerek ve istenerek gerçekleştirilmesidir. Taksir ise dikkat ve özen yükümlülüğüne aykırılık dolayısıyla sonucun öngörülememesidir." },
      { topic: "Hukuka Uygunluk Nedenleri", content: "Kanunun hükmünü yerine getirme, meşru müdafaa, hakkın kullanılması ve ilgilinin (mağdurun) rızasıdır." },
      { topic: "Teşebbüs", content: "Failin suçu işlemeye doğrudan doğruya icra hareketleriyle başlayıp da elinde olmayan nedenlerle tamamlayamamasıdır. Cezada indirim yapılır." },
      { topic: "İştirak", content: "Suçun birden fazla kişi tarafından işlenmesidir. Faillik (müşterek, dolaylı), azmettirme ve yardım etme şekillerinde ortaya çıkar." }
    ]
  },
  "ceza_ozel": {
    title: "Ceza Hukuku Özel Özeti",
    items: [
      { topic: "Kasten Öldürme", content: "Bir insanın hayatına kasten son verilmesidir. Nitelikli halleri (tasarlayarak, canavarca hisle, vb.) ağırlaştırılmış müebbet hapis gerektirir." },
      { topic: "Kasten Yaralama", content: "Başkasının vücuduna acı veren veya sağlığının ya da algılama yeteneğinin bozulmasına neden olan eylemdir." },
      { topic: "Hırsızlık", content: "Zilyedinin rızası olmadan başkasına ait taşınır bir malı, kendisine veya başkasına bir yarar sağlamak maksadıyla bulunduğu yerden almaktır." },
      { topic: "Dolandırıcılık", content: "Hileli davranışlarla bir kimseyi aldatıp, onun veya başkasının zararına olarak, kendisine veya başkasına bir yarar sağlamaktır." },
      { topic: "Rüşvet ve İrtikap", content: "Kamu görevlisinin görevi gereği yapması/yapmaması gereken bir iş için haksız menfaat sağlamasıdır (Rüşvet). İrtikapta ise memurun vatandaşı icbar etmesi (zorlaması) veya ikna etmesi söz konusudur." }
    ]
  },
  "vergi_hukuku": {
    title: "Vergi Hukuku Özeti",
    items: [
      { topic: "Verginin Kanuniliği", content: "Vergi, resim, harç ve benzeri mali yükümlülükler ancak kanunla konulur, değiştirilir veya kaldırılır." },
      { topic: "Vergiyi Doğuran Olay", content: "Vergi alacağı, vergi kanunlarının vergiyi bağladıkları olayın vukuu veya hukuki durumun tekemmülü ile doğar." },
      { topic: "Tarh, Tebliğ, Tahakkuk, Tahsil", content: "Tarh: verginin hesaplanması. Tebliğ: Mükellefe bildirim. Tahakkuk: Verginin ödenebilir aşamaya gelmesi. Tahsil: Verginin ödenmesi." },
      { topic: "Vergi Kabahatleri ve Suçları", content: "Vergi ziyaı kabahati (verginin eksik/geç tahakkuk ettirilmesi) idari para cezası gerektirir. Kaçakçılık (sahte belge düzenleme vb.) ise hapis cezası gerektiren bir suçtur." },
      { topic: "Uzlaşma", content: "Vergi idaresi ile mükellefin yargı yoluna gitmeden önce vergi cezası veya aslı üzerinde pazarlık yaparak anlaşmasıdır." }
    ]
  },
  "ticaret_hukuku": {
    title: "Ticaret Hukuku (Şirketler) Özeti",
    items: [
      { topic: "Ticari İşletme", content: "Esnaf işletmesi için öngörülen sınırı aşan düzeyde gelir sağlamayı hedef tutan faaliyetlerin devamlı ve bağımsız şekilde yürütüldüğü işletmedir." },
      { topic: "Tacir Sıfatı", content: "Bir ticari işletmeyi kısmen de olsa kendi adına işleten kişiye denir. Ticaret siciline tescil, iflasa tabi olma, basiretli iş adamı gibi davranma yükümlülükleri vardır." },
      { topic: "Anonim Şirket", content: "Sermayesi belirli ve paylara bölünmüş olan, borçlarından dolayı sadece şirketin malvarlığıyla sorumlu olduğu şirkettir." },
      { topic: "Limited Şirket", content: "Bir veya daha çok gerçek/tüzel kişi tarafından kurulan, esas sermayesi belirli olan şirkettir. Ortaklar sadece taahhüt ettikleri sermayeyi ödemekle yükümlüdür (kamu borçları hariç)." },
      { topic: "Ticaret Sicili", content: "Ticari işletmelere ve tacirlere ilişkin önemli bilgilerin kaydedildiği aleniyet sağlayan resmi sicildir." }
    ]
  },
  "medeni_usul": {
    title: "Medeni Usul Hukuku (HMK) Özeti",
    items: [
      { topic: "Görev ve Yetki", content: "Görev, dava konusuna göre mahkemenin türünü (Asliye, Sulh vs.) belirler (Kamu düzenindendir). Yetki ise coğrafi yer mahkemesini belirler." },
      { topic: "Dilekçeler Aşaması", content: "Dava dilekçesi, cevap dilekçesi, cevaba cevap (replik) ve ikinci cevap (düplik) dilekçelerinden oluşur." },
      { topic: "Ön İnceleme", content: "Dilekçeler teatisi bittikten sonra mahkemenin dava şartlarını, ilk itirazları incelediği, uyuşmazlık noktalarını tam olarak belirlediği ve sulhe teşvik ettiği aşamadır." },
      { topic: "İspat Yükü", content: "Kural olarak, iddia edilen vakıaya bağlanan hukuki sonuçtan kendi lehine hak çıkaran taraf ispat yükü altındadır." },
      { topic: "Kesin Hüküm (Res Judicata)", content: "Kanun yolları tükenmiş veya süresi geçirilmiş olan kararın maddi anlamda kesinleşmesidir. Aynı taraflar, aynı sebeple aynı davayı tekrar açamazlar." }
    ]
  },
  "idare_hukuku": {
    title: "İdare Hukuku Özeti",
    items: [
      { topic: "İdarenin Kanuniliği", content: "İdarenin her türlü eylem ve işleminin kaynağını kanundan alması ve kanuna uygun olması zorunluluğudur." },
      { topic: "İdari İşlem", content: "İdarenin kamu gücü kullanarak, tek taraflı irade açıklamasıyla hukuk aleminde değişiklik yarattığı işlemlerdir. (Örn: Memur atama, ruhsat verme)." },
      { topic: "İdari İşlemin Unsurları", content: "Yetki (işlemi yapan makam), Şekil (usul kuralları), Sebep (işlemi gerektiren olay), Konu (işlemin doğurduğu hukuki sonuç) ve Maksat (daima kamu yararı)." },
      { topic: "Kamu Malları", content: "Devletin doğrudan doğruya kamunun yararlanmasına tahsis ettiği (yollar, meydanlar) veya kamu hizmeti için kullanılan (okul binaları) mallardır. Haczedilemez, kazandırıcı zamanaşımı ile kazanılamaz." },
      { topic: "İdarenin Sorumluluğu", content: "İdare, hizmet kusuru (idarenin işleyişindeki aksaklıklar) veya kusursuz sorumluluk (sosyal risk, fedakarlığın denkleştirilmesi) ilkelerine göre verdiği zararları ödemekle yükümlüdür." }
    ]
  },
  "idari_yargilama": {
    title: "İdari Yargılama Hukuku (İYUK) Özeti",
    items: [
      { topic: "İptal Davası", content: "İdari işlemlerin yetki, şekil, sebep, konu ve maksat unsurlarından biri yönüyle hukuka aykırı olması nedeniyle menfaati ihlal edilenlerin açtığı davadır." },
      { topic: "Tam Yargı Davası", content: "İdari eylem ve işlemler nedeniyle kişisel hakkı doğrudan muhtel olanların (zarara uğrayanların) idareden tazminat istediği davadır." },
      { topic: "Dava Açma Süresi", content: "Özel bir süre öngörülmemişse kural olarak Danıştay ve İdare Mahkemelerinde 60 gün, Vergi Mahkemelerinde 30 gündür." },
      { topic: "Yürütmenin Durdurulması", content: "İdari işlemin uygulanması halinde telafisi güç veya imkansız zararların doğması VE idari işlemin açıkça hukuka aykırı olması şartlarının birlikte gerçekleşmesi halinde verilir." },
      { topic: "Kanun Yolları", content: "İstinaf (Bölge İdare Mahkemesine 30 gün içinde) ve Temyiz (Danıştaya 30 gün içinde)." }
    ]
  },
  "milletlerarasi_kamu": {
    title: "Milletlerarası Kamu Hukuku Özeti",
    items: [
      { topic: "Uluslararası Hukukun Kişileri", content: "Asıl kişiler devletlerdir. Ayrıca uluslararası örgütler (BM, NATO vb.) de uluslararası hukukun süjeleridir." },
      { topic: "Uluslararası Hukukun Kaynakları", content: "Uluslararası antlaşmalar, uluslararası teamüller (yapılageliş kuralları), hukukun genel ilkeleri ve yardımcı kaynaklar (yargı kararları, doktrin)." },
      { topic: "Antlaşmaların Onaylanması", content: "Türk hukukunda uluslararası antlaşmalar kural olarak TBMM'nin uygun bulma kanunu ile ve Cumhurbaşkanı'nın onayıyla yürürlüğe girer." },
      { topic: "Devletin Ülkesel Egemenliği", content: "Kara ülkesi, karasuları ve hava sahası üzerinde devletin tam ve münhasır yetkiye sahip olmasıdır." },
      { topic: "Kuvvet Kullanma Yasağı", content: "BM Şartı m.2/4 gereği, uluslararası ilişkilerde devletlerin birbirlerinin toprak bütünlüğüne ve siyasi bağımsızlığına karşı kuvvet kullanması yasaktır (İstisna: Meşru müdafaa)." }
    ]
  },
  "anayasa_hukuku": {
    title: "Anayasa Hukuku Özeti",
    items: [
      { topic: "Anayasanın Üstünlüğü", content: "Kanunlar, Cumhurbaşkanlığı Kararnameleri ve diğer alt normların Anayasa'ya aykırı olamaması ilkesidir." },
      { topic: "Değiştirilemez Maddeler", content: "Devletin şeklinin Cumhuriyet olduğu (m.1), Cumhuriyetin nitelikleri (m.2) ve Devletin bütünlüğü, resmi dili, bayrağı, milli marşı ve başkenti (m.3) değiştirilemez ve teklif dahi edilemez." },
      { topic: "Cumhurbaşkanlığı Kararnameleri", content: "Yürütme yetkisine ilişkin konularda çıkarılır. Temel haklar, siyasi haklar (sosyal haklar hariç) CBK ile düzenlenemez. Kanunda açıkça düzenlenen konularda CBK çıkarılamaz." },
      { topic: "Anayasa Mahkemesi (AYM)", content: "Kanunların ve CBK'ların anayasaya uygunluğunu soyut (iptal davası) ve somut (itiraz yolu) norm denetimi ile inceler." },
      { topic: "Bireysel Başvuru", content: "Herkesin, Anayasa'da ve AİHS'de güvence altına alınmış temel haklarından birinin kamu gücü tarafından ihlal edildiği iddiasıyla, olağan yasa yolları tüketildikten sonra AYM'ye başvurmasıdır." }
    ]
  },
  "genel_kamu": {
    title: "Genel Kamu Hukuku Özeti",
    items: [
      { topic: "Devletin Unsurları", content: "Toprak (Ülke), İnsan Topluluğu (Millet) ve Egemenlik (Siyasi İktidar). Bu üç unsur bir araya geldiğinde devlet oluşur." },
      { topic: "Egemenlik Kuramları", content: "Teokratik kuramlar (iktidarın kaynağı tanrıdır) ve Demokratik kuramlar (Milli Egemenlik ve Halk Egemenliği)." },
      { topic: "Kuvvetler Ayrılığı", content: "Yasama (kural koyma), Yürütme (uygulama) ve Yargı (uyuşmazlık çözme) fonksiyonlarının farklı organlara verilmesidir." },
      { topic: "Hükümet Sistemleri", content: "Kuvvetlerin katı ayrılığına dayanan Başkanlık sistemi ve kuvvetlerin yumuşak (esnek) ayrılığına dayanan Parlamenter sistemdir." },
      { topic: "Sosyal Sözleşme Kuramcıları", content: "Hobbes (mutlak monarşi), Locke (liberalizm ve kuvvetler ayrılığı) ve Rousseau (milli egemenlik ve kanunların genel iradeyi yansıtması)." }
    ]
  },
  "hukuk_felsefesi": {
    title: "Hukuk Felsefesi ve Sosyolojisi Özeti",
    items: [
      { topic: "Doğal Hukuk", content: "Hukukun insan aklından veya doğadan (tanrıdan) kaynaklandığını, evrensel, değişmez ve adil kurallar bütünü olduğunu savunan felsefi akımdır." },
      { topic: "Hukuki Pozitivizm", content: "Sadece devlet tarafından konulan ve uygulanan yazılı hukukun (olan hukukun) geçerli olduğunu, ahlak ile hukuk arasında zorunlu bir bağ olmadığını savunan akımdır." },
      { topic: "Normlar Hiyerarşisi (Kelsen)", content: "Hukuk düzeninin piramit gibi üst üste binen normlardan oluştuğu ve her normun geçerliliğini üstündeki normdan aldığı kuramdır (Saf Hukuk Kuramı)." },
      { topic: "Hukuk Sosyolojisi", content: "Hukuku toplumsal bir olgu olarak inceleyen, hukukun toplumla etkileşimini ve 'kanunların kağıt üzerinde değil pratikte nasıl işlediğini' araştıran daldır." },
      { topic: "Adalet Kavramı", content: "Dağıtıcı adalet (nitelik ve liyakata göre paylaştırma) ve Denkleştirici adalet (herkese mutlak eşit davranma veya zararın aynen tazmini)." }
    ]
  }
};

for (const [courseId, summary] of Object.entries(data)) {
  fs.writeFileSync(path.join(summariesDir, `${courseId}.json`), JSON.stringify(summary, null, 2));
}

console.log('All remaining summaries successfully detailed.');
