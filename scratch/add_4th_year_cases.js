const fs = require('fs');
const path = require('path');

const dir = path.join('/Users/efekarakoyun/hukukçalışma/uygulama/frontend/data/practice_cases');

function addCases(filename, newCases) {
  const filePath = path.join(dir, filename);
  let data = [];
  if (fs.existsSync(filePath)) {
    data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }
  
  // Calculate starting ID number
  const prefix = newCases[0].course.substring(0, 5); // Just a generic prefix
  let startIdx = data.length + 100; // offset

  newCases.forEach((c, idx) => {
    c.id = `${c.course}_${startIdx + idx}`;
    data.unshift(c); // Add to the top
  });

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// 4th Year - Icra Iflas
const icraIflasCases = [
  {
    course: "icra_iflas",
    title: "İtirazın İptali ve İcra İnkar Tazminatı Pratiği",
    difficulty: "zor",
    scenario: "Alacaklı (A), borçlu (B) aleyhine 100.000 TL bedelli bir adi senet üzerinden ilamsız icra takibi başlatmıştır. (B), ödeme emrini tebliğ aldıktan 5 gün sonra icra dairesine giderek 'Böyle bir borcum yoktur, imza bana ait değildir' şeklinde itiraz etmiş ve takip durmuştur. (A), elindeki adi senetteki imzanın (B)'ye ait olduğundan emindir. \nSoru: (A), takibin devamını sağlamak için hangi yollara başvurabilir? Hangi yola başvurması kendisi için daha avantajlıdır? Açıklayınız.",
    ideal_solution: "(A)'nın elindeki belge adi senet hükmündedir. Borçlu imzaya itiraz ettiği için İİK m.68 kapsamındaki belgelerden biriyle (örneğin noter onaylı belge) ispat imkanı yoksa, (A) İcra Mahkemesinden itirazın kesin kaldırılmasını İSTEYEMEZ. İmzaya itiraz halinde (A), İcra Mahkemesinde itirazın geçici kaldırılmasını talep edebilir (İİK m.68/a) veya genel görevli Asliye Hukuk Mahkemesinde 1 yıl içinde İtirazın İptali davası (İİK m.67) açabilir. İtirazın iptali davasında alacağın varlığı genel hükümlere göre ispatlanır ve borçlu haksız çıkarsa %20'den aşağı olmamak üzere icra inkar tazminatına mahkum edilebilir. İtirazın iptali davası açmak, kesin hüküm teşkil edeceği ve daha geniş ispat imkanı sunduğu için (A) açısından daha avantajlıdır.",
    key_points: ["İmzaya itiraz", "İtirazın iptali davası (İİK m.67)", "İtirazın geçici kaldırılması (İİK m.68/a)", "İcra inkar tazminatı", "Kesin hüküm"],
    topics: ["İlamsız İcra", "İtiraza İtiraz Yolları", "İcra İnkar Tazminatı"]
  },
  {
    course: "icra_iflas",
    title: "İstihkak İddiası ve Haciz",
    difficulty: "orta",
    scenario: "Borçlu (C)'nin evinde yapılan haciz sırasında, evde bulunan televizyon ve bilgisayar haczedilmiştir. Ancak o sırada evde bulunan (C)'nin ev arkadaşı (D), televizyonun faturasını göstererek kendisine ait olduğunu iddia etmiştir. İcra memuru bu durumu haciz tutanağına geçirmiş ancak malları muhafaza altına almıştır. (D) hakkını nasıl arayabilir?",
    ideal_solution: "(D)'nin iddiası bir üçüncü kişi istihkak iddiasıdır. İcra memuru istihkak iddiasını tutanağa geçirerek dosyayı icra mahkemesine gönderir. İcra mahkemesi, takibin talikine (ertelenmesine) veya devamına karar verir. Eğer mahkeme takibin devamına karar verirse, (D) 7 gün içinde icra mahkemesinde istihkak davası açmak zorundadır (İİK m.97). (D), elindeki faturayı delil olarak sunarak mülkiyet karinesini çürütmeye çalışacaktır.",
    key_points: ["Üçüncü kişinin istihkak iddiası", "İİK m.97 prosedürü", "7 günlük dava açma süresi", "Mülkiyet karinesi"],
    topics: ["Haciz", "İstihkak Davası"]
  }
];

// 4th Year - Ceza Muhakemesi
const cezaMuhCases = [
  {
    course: "ceza_muhakemesi",
    title: "Hukuka Aykırı Arama ve Delil Değerlendirmesi",
    difficulty: "zor",
    scenario: "Polis memurları, ihbar üzerine şüpheli (E)'nin evine gitmiştir. Gecikmesinde sakınca bulunan hal kapsamında savcıdan yazılı arama kararı almadan, amirlerinin 'sözlü talimatıyla' eve girmiş ve evde uyuşturucu madde bulmuşlardır. (E) mahkemede, bu aramanın hukuka aykırı olduğunu belirterek delillerin kabul edilmemesini talep etmiştir. Mahkeme nasıl bir karar vermelidir?",
    ideal_solution: "CMK m.119'a göre arama kararı hakim tarafından verilir. Gecikmesinde sakınca bulunan hallerde Cumhuriyet savcısının, savcıya ulaşılamayan hallerde ise kolluk amirinin 'yazılı' emriyle arama yapılabilir. Konutta arama için kolluk amirinin emri geçerli değildir, mutlaka savcı veya hakim kararı gereklidir. Olayda hem amirin sözlü talimatıyla konuta girilmesi hem de konut araması yetkisinin amirde olmaması nedeniyle arama açıkça hukuka aykırıdır. Anayasa m.38 ve CMK m.217/2 gereğince, hukuka aykırı elde edilen bulgular delil olarak değerlendirilemez. Mahkeme, uyuşturucu maddeyi dışlayarak (zehirli ağacın meyvesi de zehirlidir prensibi) diğer delillere göre karar vermeli, başka delil yoksa beraat kararı vermelidir.",
    key_points: ["Arama kararı şartları (CMK m.119)", "Konut dokunulmazlığı", "Hukuka aykırı delil (CMK m.217)", "Zehirli ağacın meyvesi"],
    topics: ["Arama Tedbiri", "Deliller", "Hukuka Aykırı Deliller"]
  }
];

addCases('icra_iflas.json', icraIflasCases);
addCases('ceza_muhakemesi.json', cezaMuhCases);

console.log('Extra 4th year practice cases added.');
