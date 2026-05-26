const fs = require('fs');

const file = '/Users/efekarakoyun/hukukçalışma/uygulama/frontend/data/sozluk.json';
let terms = JSON.parse(fs.readFileSync(file, 'utf-8'));

const moreTerms = [
  { "term": "Gıyabi Tutuklama", "meaning": "Hakkında tutuklama kararı verilen ancak henüz yakalanmamış kişi hakkındaki karar." },
  { "term": "Tevkif", "meaning": "Tutuklama, alıkoyma." },
  { "term": "Kefalet", "meaning": "Bir kişinin borcunu ödememesi halinde, borcun bizzat ödeneceğine dair alacaklıya karşı şahsi güvence verilmesi." },
  { "term": "Garame", "meaning": "Alacaklıların alacakları oranında, borçlunun malvarlığından orantılı olarak pay almaları." },
  { "term": "İvazsız", "meaning": "Karşılıksız, bedelsiz yapılan hukuki işlem (Örn: Bağışlama)." },
  { "term": "İvazlı", "meaning": "Karşılıklı, bir bedel öngören hukuki işlem (Örn: Satış)." },
  { "term": "İhtirazı Kayıt", "meaning": "Hakların saklı tutulması şerhi." },
  { "term": "Müteselsil Kefil", "meaning": "Borçlu ile birlikte asıl borçlu gibi doğrudan takip edilebilen kefil." },
  { "term": "Defi", "meaning": "Borçlunun, borcunu ifa etmekten kaçınmasını sağlayan yasal hak (Örn: Zamanaşımı defi, Ödemezlik defi)." },
  { "term": "İtiraz", "meaning": "Hakkın doğumuna engel olan veya hakkı sona erdiren olayların ileri sürülmesi (Örn: Borcu ödedim itirazı). Hakim re'sen dikkate alır." },
  { "term": "Karine", "meaning": "Bilinen bir olgudan, bilinmeyen bir olgunun varlığına veya yokluğuna ilişkin çıkarılan kanuni veya fiili sonuç." },
  { "term": "Müsadere", "meaning": "İşlenen bir suçla bağlantılı olan eşya veya kazancın devlet mülkiyetine geçirilmesi kararı." },
  { "term": "Tekerrür", "meaning": "Daha önce işlenen bir suçtan dolayı kesinleşmiş ceza mahkumiyeti bulunan kişinin, kanunda belirlenen süreler içinde yeniden suç işlemesi hali." },
  { "term": "Gensoru", "meaning": "Siyasi denetim aracı (eski sistemde)." },
  { "term": "Beraat", "meaning": "Sanığın üzerine atılı suçtan aklanması, suçlu bulunmaması kararı." },
  { "term": "Sükna Hakkı", "meaning": "Oturma hakkı." },
  { "term": "Mehir", "meaning": "İslam hukukunda evlenme sırasında erkeğin kadına verdiği veya vermeyi taahhüt ettiği mal veya para." },
  { "term": "Şuf'a (Önalım) Hakkı", "meaning": "Paylı mülkiyette payın üçüncü kişiye satılması halinde diğer paydaşların öncelikle alım hakkı." },
  { "term": "Kıdem", "meaning": "İşçinin bir işverene bağlı olarak çalıştığı sürenin toplamı." },
  { "term": "Temyiz Kudreti (Ayırt Etme Gücü)", "meaning": "Kişinin eylemlerinin sebep ve sonuçlarını anlayabilme ve buna göre davranabilme yeteneği. Fiil ehliyetinin şartıdır." },
  { "term": "Kısıtlılık (Hacr)", "meaning": "Ergin bir kimsenin fiil ehliyetinin kanunda sayılan sebeplerle (akıl hastalığı, savurganlık vb.) mahkeme kararıyla sınırlandırılması." },
  { "term": "Muvafakat", "meaning": "Bir işleme onay veya izin verme." },
  { "term": "Müzekkere", "meaning": "Mahkemelerin veya resmi makamların, bir işlemin yapılması için ilgili kurumlara veya kişilere yazdığı resmi yazı." },
  { "term": "Tensip Zaptı", "meaning": "Davanın açılmasından sonra mahkemenin ilk incelemeyi yaparak duruşma gününü ve tarafların yapması gerekenleri belirlediği tutanak." },
  { "term": "Tevdi Mahalli", "meaning": "Borçlunun, alacaklının temerrüde düşmesi (ifayı reddetmesi) üzerine borç konusu malı veya parayı teslim ederek borçtan kurtulduğu resmi yer (Örn: banka şubesi)." },
  { "term": "Tebligat", "meaning": "Hukuki bir işlemin veya mahkeme kararının ilgili kişiye kanuna uygun usullerle bildirilmesi." },
  { "term": "Rücu Hakkı", "meaning": "Başkası yerine borç ödeyenin asıl borçluya başvurma hakkı." },
  { "term": "Vekalet", "meaning": "Bir kimsenin kendi adına iş yapması için başkasına yetki vermesi sözleşmesi." },
  { "term": "Fuzuli İşgal (Ecrimisil)", "meaning": "Bir malın, sahibinin izni olmaksızın haksız olarak kullanılması ve bu kullanım karşılığında ödenmesi gereken tazminat." },
  { "term": "Re'sen", "meaning": "Mahkeme veya resmi makam tarafından, tarafların talebi olmaksızın, kendiliğinden yapılan işlem." },
  { "term": "Yargı Yolu (Görev)", "meaning": "Bir uyuşmazlığın hangi yargı kolunda (Adli, İdari, Anayasa vs.) çözümleneceğini belirleyen kavram." },
  { "term": "Keşif", "meaning": "Hakimin uyuşmazlık konusu olan şeyi veya yeri (arazi, bina vb.) bizzat görerek incelemesi işlemi." },
  { "term": "Bilirkişi", "meaning": "Hakimin özel veya teknik bilgi gerektiren konularda görüşüne başvurduğu uzman kişi." },
  { "term": "Mahsup", "meaning": "Hesaplama sonucunda bir alacağın veya cezanın diğerinden indirilmesi." },
  { "term": "Nisap", "meaning": "Karar alabilmek veya toplanabilmek için gereken asgari kişi sayısı (Toplantı nisabı, karar nisabı)." }
];

terms = terms.concat(moreTerms);
// filter unique
const seen = new Set();
const uniqueTerms = terms.filter(item => {
    const k = item.term.toLowerCase();
    return seen.has(k) ? false : seen.add(k);
});

fs.writeFileSync(file, JSON.stringify(uniqueTerms, null, 2));
console.log('Total unique terms in dictionary: ' + uniqueTerms.length);
