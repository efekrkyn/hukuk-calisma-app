const fs = require('fs');
const path = require('path');

const summariesDir = path.join('/Users/efekarakoyun/hukukçalışma/uygulama/frontend/data/summaries');

const data = {
  "icra_iflas": {
    title: "İcra ve İflas Hukuku Son Gece Özeti",
    items: [
      { topic: "İlamsız İcra ve İtiraz", content: "İlamsız icra takibi sadece para ve teminat alacakları için yapılır. Borçlu, ödeme emrinin tebliğinden itibaren 7 gün içinde icra dairesine itiraz edebilir. İtiraz takibi durdurur." },
      { topic: "İtirazın İptali ve Kaldırılması", content: "İtirazı bertaraf etmek için alacaklı 1 yıl içinde genel mahkemede itirazın iptali davası açabilir (İİK m.67) veya elinde İİK m.68'de sayılan belgeler varsa 6 ay içinde icra mahkemesinden itirazın kesin kaldırılmasını isteyebilir." },
      { topic: "Haciz ve Sıra Cetveli", content: "Haciz, borçlunun mallarına icra dairesince el konulmasıdır. Birden fazla alacaklı varsa sıra cetveli yapılır. İmtiyazlı alacaklar (işçi, nafaka vb.) önceliklidir." },
      { topic: "İstihkak Davası", content: "Haczedilen malın kendisine ait olduğunu iddia eden üçüncü kişi istihkak iddiasında bulunabilir. Bu durumda açılan davaya istihkak davası denir." },
      { topic: "İflasın Açılması", content: "Tacirler iflasa tabidir. İflas kararı ticaret mahkemesince verilir ve karar anından itibaren borçlunun haczedilebilen tüm malları iflas masasına girer. Borçlu iflas masası üzerindeki tasarruf yetkisini kaybeder." }
    ]
  },
  "ceza_muhakemesi": {
    title: "Ceza Muhakemesi Hukuku (CMK) Son Gece Özeti",
    items: [
      { topic: "Soruşturma Evresi", content: "Suç şüphesinin öğrenilmesinden iddianamenin kabulüne kadar geçen evredir. Savcı, şüphelinin lehine ve aleyhine delilleri toplamak zorundadır." },
      { topic: "Koruma Tedbirleri", content: "Gecikmesinde sakınca bulunan hallerde geçici olarak temel hakları kısıtlayan tedbirlerdir: Yakalama, gözaltı, tutuklama, adli kontrol, arama, elkoyma, iletişimin tespiti." },
      { topic: "Tutuklama Şartları", content: "Kuvvetli suç şüphesinin varlığını gösteren somut delillerin bulunması ve bir tutuklama nedeninin (kaçma veya delil karartma şüphesi) bulunması gerekir. (CMK m.100)" },
      { topic: "Kovuşturma Evresi", content: "İddianamenin kabulüyle başlar ve hükmün kesinleşmesine kadar sürer. Duruşma alenidir, deliller doğrudan tartışılır." },
      { topic: "Kanun Yolları", content: "Olağan kanun yolları: İtiraz, İstinaf (BAM) ve Temyiz (Yargıtay). Olağanüstü kanun yolları: Yargıtay Cumhuriyet Başsavcısının İtirazı, Kanun Yararına Bozma, Yargılamanın Yenilenmesi." }
    ]
  },
  "milletlerarasi_ozel": {
    title: "Milletlerarası Özel Hukuk (MÖHUK) Özeti",
    items: [
      { topic: "Yabancılık Unsuru", content: "Bir hukuki ilişkinin, tarafların vatandaşlığı, yerleşim yeri veya olayın gerçekleştiği yer bakımından birden fazla devletin hukuku ile irtibatlı olmasıdır." },
      { topic: "Bağlama Kuralları", content: "Yabancılık unsuru taşıyan uyuşmazlıklarda hangi devletin maddi hukukunun uygulanacağını gösteren kurallardır. (Örn: Haksız fiillerde olayın meydana geldiği yer hukuku - lex loci delicti)." },
      { topic: "Kamu Düzeni Müdahalesi", content: "Yetkili yabancı hukukun uygulanması Türk kamu düzenine açıkça aykırı ise o hüküm uygulanmaz. (MÖHUK m.5)" },
      { topic: "Tanıma ve Tenfiz", content: "Yabancı mahkeme kararlarının Türkiye'de kesin hüküm teşkil etmesi için 'tanıma', icra edilebilmesi için ise 'tenfiz' davası açılması gerekir." },
      { topic: "Tenfiz Şartları", content: "Karşılıklılık (mütekabiliyet), kararın Türk mahkemelerinin münhasır yetkisine girmeyen bir konuda verilmesi, Türk kamu düzenine açıkça aykırı olmaması ve savunma hakkına riayet edilmiş olmasıdır." }
    ]
  },
  "is_hukuku": {
    title: "İş ve Sosyal Güvenlik Hukuku Özeti",
    items: [
      { topic: "İş Sözleşmesi Türleri", content: "Belirli - Belirsiz süreli, Kısmi - Tam süreli, Deneme süreli (en çok 2 ay, TİS ile 4 ay). Asıl kural sözleşmenin belirsiz süreli olmasıdır." },
      { topic: "İş Güvencesi Şartları", content: "Otuz veya daha fazla işçi çalıştıran işyerinde, en az altı aylık kıdemi olan işçinin belirsiz süreli iş sözleşmesinin feshinde işveren geçerli bir sebep bildirmek zorundadır." },
      { topic: "Kıdem Tazminatı", content: "Aynı işverene bağlı olarak en az 1 yıl çalışan işçinin, kanunda sayılan haklı fesih, emeklilik, askerlik veya ölüm gibi nedenlerle işten ayrılması/çıkarılması halinde ödenir." },
      { topic: "Haklı Nedenle Fesih (m.24-25)", content: "Sağlık sebepleri, ahlak ve iyiniyet kurallarına uymayan haller ve zorlayıcı sebeplerle işçi (m.24) veya işveren (m.25) tarafından sözleşmenin derhal, tazminatsız (kıdem hariç) feshedilebilmesidir." },
      { topic: "Çalışma Süreleri", content: "Haftalık normal çalışma süresi en çok 45 saattir. Bu süreyi aşan çalışmalar fazla çalışma sayılır ve ücret %50 zamlı ödenir." }
    ]
  },
  "kiymetli_evrak": {
    title: "Kıymetli Evrak Hukuku Özeti",
    items: [
      { topic: "Kıymetli Evrakın Tanımı", content: "İçerdiği hakkın senetten ayrı olarak ileri sürülemediği ve başkalarına devredilemediği senetlerdir. Hak, senede sıkı sıkıya bağlıdır." },
      { topic: "Türleri", content: "Nama yazılı (devri alacağın temliki + zilyetliğin devri), Emre yazılı (ciro + zilyetliğin devri), Hamiline yazılı (sadece zilyetliğin devri ile geçer)." },
      { topic: "Poliçe", content: "Poliçede 3 taraf vardır: Düzenleyen (Keşideci), Ödeyecek olan (Muhatap) ve Alacaklı (Lehtar). Keşideci, muhataba ödeme emri verir." },
      { topic: "Ciro", content: "Senedin arka yüzüne veya alonja yazılan bir beyanla senedin devrini veya rehnini sağlayan işlemdir. Temlik, tahsil ve rehin cirosu olmak üzere üçe ayrılır." },
      { topic: "Aval", content: "Kambiyo senedi üzerindeki borcun tamamını veya bir kısmını teminat altına almak için verilen bir tür kefalettir. Müteselsil sorumluluk doğurur." }
    ]
  },
  "miras_hukuku": {
    title: "Miras Hukuku Özeti",
    items: [
      { topic: "Yasal Mirasçılar (Zümre Sistemi)", content: "1. Zümre: Altsoy (Çocuklar, torunlar), 2. Zümre: Ana-baba ve onların altsoyu, 3. Zümre: Büyük ana-büyük baba ve onların altsoyu. Sağ kalan eş her zümreyle mirasçıdır." },
      { topic: "Sağ Kalan Eşin Miras Payı", content: "1. zümre ile birlikte ise mirasın 1/4'ü, 2. zümre ile birlikte ise 1/2'si, 3. zümre (sadece büyük ana-büyük baba düzeyinde) ile birlikte ise 3/4'ü, diğer hallerde tamamı." },
      { topic: "Saklı Pay (Mahfuz Hisse)", content: "Mirasbırakanın ölüme bağlı tasarruflarıyla dahi ortadan kaldıramayacağı miras payıdır. Altsoyun saklı payı yasal miras payının yarısıdır (1/2). Sağ kalan eşinki ise birlikte olduğu zümreye göre değişir." },
      { topic: "Tenkis Davası", content: "Mirasbırakanın saklı payları zedeleyen tasarruflarının yasal sınırlara çekilmesi için açılan davadır." },
      { topic: "Mirasın Reddi", content: "Mirasçıların, mirasbırakanın ölümünü öğrendikleri tarihten itibaren 3 ay içinde mirası reddetmeleridir. Terekenin borca batık olduğu açık ise miras hükmen reddedilmiş sayılır." }
    ]
  }
};

if (!fs.existsSync(summariesDir)) {
    fs.mkdirSync(summariesDir, { recursive: true });
}

for (const [courseId, summary] of Object.entries(data)) {
  fs.writeFileSync(path.join(summariesDir, `${courseId}.json`), JSON.stringify(summary, null, 2));
}

// Generate some basic ones for others just so they aren't empty
const COURSES = [
  "medeni_hukuk", "esya_hukuku", "vergi_hukuku", "ticaret_hukuku", 
  "medeni_usul", "idare_hukuku", "idari_yargilama", "milletlerarasi_kamu", 
  "anayasa_hukuku", "genel_kamu", "hukuk_felsefesi"
];

for (const courseId of COURSES) {
  if (!fs.existsSync(path.join(summariesDir, `${courseId}.json`))) {
    fs.writeFileSync(path.join(summariesDir, `${courseId}.json`), JSON.stringify({
      title: courseId.split('_').map(w => w.toUpperCase()).join(' ') + " Özeti",
      items: [
        { topic: "Temel Kavramlar", content: "Bu dersin özet notları yapay zeka tarafından sisteme yüklenmiştir. Yakında detaylı notlar eklenecektir." },
        { topic: "Sınav Tavsiyesi", content: "Geçmiş yıl çıkmış HMGS/Hakimlik sorularını mutlaka çözün." }
      ]
    }, null, 2));
  }
}
console.log('Summaries generated successfully.');
