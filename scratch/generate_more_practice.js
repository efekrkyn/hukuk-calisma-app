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
  
  let startIdx = data.length + 200; 

  newCases.forEach((c, idx) => {
    c.id = `${c.course}_IRAC_${startIdx + idx}`;
    data.unshift(c); 
  });

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

const cases = {
  "medeni_hukuk": [
    {
      course: "medeni_hukuk",
      title: "Ayırt Etme Gücü ve Sözleşmenin Geçersizliği",
      difficulty: "orta",
      scenario: "Akıl hastası olan ve kısıtlanmış bulunan (A), yasal temsilcisi (V)'nin haberi olmadan, antika bir vazoyu (B)'ye 10.000 TL'ye satmış ve teslim etmiştir. (B), vazoyu vitrinine koymuştur. (V) durumu öğrenince ne yapabilir? İşlemin hukuki niteliği nedir?",
      ideal_solution: "(A) tam ehliyetsizdir. Tam ehliyetsizlerin hukuki işlemleri batıldır (kesin hükümsüzdür). Muvafakat veya icazet (onay) ile geçerli hale gelmezler. (V), (B)'ye karşı mülkiyete dayalı istihkak davası (TMK m.683) açarak vazonun iadesini talep edebilir. Zira işlem baştan itibaren batıl olduğundan mülkiyet (B)'ye hiç geçmemiştir.",
      key_points: ["Tam ehliyetsizlik", "Mutlak butlan (Kesin hükümsüzlük)", "İstihkak davası", "İcazet verilememesi"],
      topics: ["Kişiler Hukuku", "Ehliyetsizlik"]
    },
    {
      course: "medeni_hukuk",
      title: "Nişanın Bozulması ve Hediyelerin Geri Verilmesi",
      difficulty: "kolay",
      scenario: "Nişanlılık süresince (K), nişanlısı (E)'ye pahalı bir Rolex saat hediye etmiştir. (E), haklı bir sebep olmaksızın nişanı bozmuştur. (K), saati geri isteyebilir mi?",
      ideal_solution: "TMK m.120 gereğince, nişanlılığın evlenme dışındaki bir sebeple sona ermesi halinde nişanlıların birbirlerine verdikleri alışılmışın dışındaki hediyeler geri istenebilir. Rolex saat alışılmışın dışında, değerli bir hediyedir. (K) saatin aynen iadesini, aynen iade mümkün değilse sebepsiz zenginleşme hükümlerine göre bedelini talep edebilir.",
      key_points: ["Nişanın bozulması", "Alışılmışın dışındaki hediyeler", "Hediyelerin iadesi (TMK m.120)"],
      topics: ["Aile Hukuku", "Nişanlılık"]
    }
  ],
  "borclar_genel": [
    {
      course: "borclar_genel",
      title: "Muvazaa ve Şekil Eksikliği",
      difficulty: "zor",
      scenario: "(X), alacaklılarından mal kaçırmak amacıyla evini güvendiği arkadaşı (Y)'ye tapuda satış göstererek devretmiş, ancak aralarında imzaladıkları gizli bir sözleşme ile asıl niyetlerinin bağışlama olduğu konusunda anlaşmışlardır. (X)'in alacaklısı (A), bu durumu öğrenirse hangi hukuki yollara başvurabilir?",
      ideal_solution: "Bu olayda nispi muvazaa vardır. Görünürdeki satış sözleşmesi muvazaa (irade ile beyan arasındaki bilerek yaratılan uyumsuzluk) nedeniyle kesin olarak hükümsüzdür (TBK m.19). Gizli işlem olan bağışlama ise tapuda resmi şekilde yapılmadığı (şekil eksikliği) için o da geçersizdir. Alacaklı (A), tapu iptal davası açarak veya İİK m.277 vd. gereği tasarrufun iptali davası açarak taşınmazı haczettirip sattırabilir.",
      key_points: ["Nispi muvazaa", "Görünürdeki işlem (Satış - Geçersiz)", "Gizli işlem (Bağışlama - Şekle aykırılıktan geçersiz)", "Tasarrufun iptali davası"],
      topics: ["Muvazaa", "Kesin Hükümsüzlük", "Sözleşmenin Şekli"]
    },
    {
      course: "borclar_genel",
      title: "Aşırı Yararlanma (Gabin)",
      difficulty: "orta",
      scenario: "(S), ekonomik olarak zor durumda olan ve paraya acil ihtiyacı bulunan (A)'nın bu durumundan faydalanarak, (A)'nın 500.000 TL değerindeki evini 150.000 TL'ye satın almıştır. (A), maddi durumunu düzelttikten sonra bu satışı iptal etmek istemektedir. Hukuki durumu değerlendiriniz.",
      ideal_solution: "TBK m.28 uyarınca bu olayda gabin (aşırı yararlanma) şartları gerçekleşmiştir. Edimler (150.000 TL ile 500.000 TL) arasında açık oransızlık (objektif unsur) vardır ve bu durum (A)'nın zor durumundan (müzayaka) faydalanılarak (sübjektif unsur) yaratılmıştır. (A), durumu öğrendiği/zorluğun geçtiği tarihten itibaren 1 yıl ve herhalde sözleşmenin kurulmasından itibaren 5 yıl içinde sözleşmeyle bağlı olmadığını (iptal) (S)'ye bildirerek tapunun iadesini isteyebilir.",
      key_points: ["Gabin (Aşırı yararlanma)", "Açık oransızlık", "Müzayaka hali", "1 yıllık ve 5 yıllık hak düşürücü süre", "İptal (Nispi Butlan)"],
      topics: ["İrade Sakatlıkları", "Gabin"]
    }
  ],
  "esya_hukuku": [
    {
      course: "esya_hukuku",
      title: "İyiniyetli Üçüncü Kişinin Ayni Hak Kazanımı",
      difficulty: "zor",
      scenario: "(A), bilgisayarını onarması için tamirci (T)'ye bırakmıştır. (T), bilgisayarı dükkanında sergilemiş ve müşteri (M)'ye kendisine ait olduğunu söyleyerek 5.000 TL'ye satıp teslim etmiştir. (A) durumu öğrendiğinde bilgisayarı (M)'den alabilir mi?",
      ideal_solution: "Bu olayda bilgisayar 'emin sıfatıyla zilyetten' (tamirci T) elden çıkmıştır (A rızasıyla teslim etmiştir). TMK m.988 gereğince, emin sıfatıyla zilyetten ayni hak edinen üçüncü kişinin (M) iyiniyetli kazanımı korunur. M, durumdan habersiz ve iyiniyetli olduğu için mülkiyeti anında kazanır. (A)'nın (M)'ye karşı açabileceği bir istihkak davası (TMK m.683) veya taşınır davası (TMK m.989) yoktur. (A) sadece (T)'ye karşı tazminat davası açabilir.",
      key_points: ["Emin sıfatıyla zilyet", "İyiniyetli üçüncü kişi", "Mülkiyetin anında kazanılması", "TMK m.988"],
      topics: ["Zilyetlik", "İyiniyet", "Taşınır Davası"]
    }
  ],
  "is_hukuku": [
    {
      course: "is_hukuku",
      title: "İşe İade Davası Şartları",
      difficulty: "orta",
      scenario: "40 işçinin çalıştığı bir fabrikada 5 aydır çalışan işçi (İ), işveren tarafından hiçbir gerekçe gösterilmeden işten çıkarılmıştır. (İ), işe iade davası açmak istemektedir. Şartları değerlendiriniz.",
      ideal_solution: "İş Güvencesi kapsamında işe iade davası (İş K. m.18) açabilmek için üç temel şart vardır: 1) İşyerinde 30 veya daha fazla işçi çalışmalı (Olayda 40 işçi var, sağlandı), 2) İşçinin en az 6 aylık kıdemi olmalı (Olayda 5 ay var, SAĞLANMADI), 3) Sözleşme belirsiz süreli olmalıdır. İşçi (İ), 6 aylık kıdem şartını doldurmadığı için iş güvencesi kapsamında değildir ve işe iade davası AÇAMAZ. Sadece ihbar tazminatı talep edebilir veya kötüniyet tazminatı şartlarını değerlendirebilir.",
      key_points: ["İş güvencesi şartları", "30 işçi kuralı", "6 aylık kıdem şartı eksikliği", "İşe iade davası açılamaması"],
      topics: ["İş Güvencesi", "İşe İade Davası"]
    }
  ],
  "ceza_ozel": [
    {
      course: "ceza_ozel",
      title: "Hırsızlık ve Kullanma Hırsızlığı",
      difficulty: "kolay",
      scenario: "(A), komşusu (B)'nin kapı önünde bıraktığı bisikletini, sadece markete gidip gelmek amacıyla izinsiz almış ve market dönüşü bisikleti aldığı yere bırakırken (B) tarafından yakalanmıştır. (A)'nın fiilinin hukuki niteliği nedir?",
      ideal_solution: "Hırsızlık suçunun oluşması için failin malı 'kendisine veya başkasına bir yarar sağlamak maksadıyla' malikmiş gibi kullanma niyeti (temellük kastı) olmalıdır. Olayda (A), bisikleti mülk edinmek değil, geçici bir süre kullanıp iade etmek amacıyla almıştır. Bu nedenle TCK m.146 gereğince 'Kullanma Hırsızlığı' suçu oluşur. Kullanma hırsızlığında, malın değerine ve failin niyetine göre cezada indirim yapılır veya ceza verilmeyebilir.",
      key_points: ["Temellük (Mülk edinme) kastı yokluğu", "Geçici kullanım amacı", "TCK m.146", "Kullanma Hırsızlığı"],
      topics: ["Malvarlığına Karşı Suçlar", "Hırsızlık"]
    }
  ]
};

for (let course in cases) {
  appendCases(`${course}.json`, cases[course]);
}

console.log('Appended IRAC / Practice Cases to data successfully.');
