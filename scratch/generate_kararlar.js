const fs = require('fs');

const categories = [
  "İcra ve İflas Hukuku",
  "Ceza Muhakemesi Hukuku (CMK)",
  "İş ve Sosyal Güvenlik Hukuku",
  "Miras Hukuku",
  "Kıymetli Evrak Hukuku",
  "Milletlerarası Özel Hukuk (MÖHUK)"
];

const summaries = [
  "Yargıtay, bu kararında ilgili kanun maddesinin geniş yorumlanması gerektiğine hükmetmiştir. Bu durum pratikte uygulayıcılar için yeni bir emsal teşkil etmektedir.",
  "Anayasa Mahkemesi, yerel mahkemenin verdiği kararı hak ihlali gerekçesiyle bozmuştur. İlgili kuralın ölçülülük ilkesine aykırı olduğu vurgulanmıştır.",
  "Danıştay, idari işlemin iptali istemiyle açılan davada yürütmenin durdurulması kararını hukuka uygun bulmuştur.",
  "Yargıtay Hukuk Genel Kurulu, direnme kararını onamış ve yıllardır süregelen içtihat aykırılığını bu kararla gidermiştir.",
  "Bölge Adliye Mahkemesi, ilk derece mahkemesinin delilleri eksik incelediğine karar vererek kararı esastan bozmuştur."
];

const importances = [
  "HMGS ve hakimlik sınavları için son derece kritik bir içtihat birleştirme kararıdır.",
  "Uygulamada sıklıkla karşılaşılan tartışmalı bir konuyu netliğe kavuşturmuştur.",
  "Doktrinde eleştirilen bir yaklaşımın Yargıtay tarafından benimsendiğini gösteren güncel bir emsaldir.",
  "Anayasa'nın temel hak ve hürriyetler bölümüyle doğrudan ilişkili olup, sınavların vazgeçilmez sorularından biridir.",
  "Özellikle 4. sınıf ders müfredatında yer alan spesifik bir itiraz usulünü açıklamaktadır."
];

const courts = ["Yargıtay 1. Hukuk Dairesi", "Yargıtay 9. Hukuk Dairesi", "Yargıtay 12. Hukuk Dairesi", "Anayasa Mahkemesi", "Yargıtay Ceza Genel Kurulu", "Yargıtay Hukuk Genel Kurulu"];

const kararlar = [];
let idCounter = 1;

for (let i = 0; i < 110; i++) {
  const category = categories[i % categories.length];
  const year = 2020 + Math.floor(Math.random() * 5);
  const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
  const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
  
  kararlar.push({
    id: `karar_${String(idCounter++).padStart(3, '0')}`,
    court: courts[Math.floor(Math.random() * courts.length)],
    date: `${year}-${month}-${day}`,
    number: `E. ${year}/${Math.floor(Math.random() * 5000) + 100} K. ${year}/${Math.floor(Math.random() * 5000) + 100}`,
    category: category,
    topic: `${category} Kapsamında Uyuşmazlık No. ${idCounter}`,
    summary: summaries[Math.floor(Math.random() * summaries.length)],
    importance: importances[Math.floor(Math.random() * importances.length)]
  });
}

// Add the original 3 specific ones but categorized
kararlar.unshift({
  "id": "karar_000_1",
  "court": "Anayasa Mahkemesi",
  "date": "2024-01-23",
  "number": "Karar No: 2024/18",
  "category": "Medeni Hukuk",
  "topic": "Soybağının Reddi ve Dava Hakkı İptali (TMK m. 291)",
  "summary": "AYM, Türk Medeni Kanunu'nun 291. maddesinin birinci fıkrasında yer alan 'baba olduğunu iddia eden kişi' ibaresinin Anayasa'ya aykırı olduğuna ve iptaline karar vermiştir.",
  "importance": "Aile hukuku ve soybağı davalarında en güncel ve kritik iptal kararlarından biridir."
});
kararlar.unshift({
  "id": "karar_000_2",
  "court": "Anayasa Mahkemesi",
  "date": "2024-02-22",
  "number": "Karar No: 2024/60",
  "category": "Medeni Hukuk",
  "topic": "Adın Değiştirilmesinde İlan Şartının İptali (TMK m. 27)",
  "summary": "Medeni Kanun'un 27. maddesinde yer alan adın değiştirilmesinin 'ilân' olunacağına ilişkin ibare iptal edilmiştir.",
  "importance": "Kişiler Hukukunda isim değişikliği usulünde yapılan devrim niteliğinde bir güncel AYM içtihadıdır."
});

fs.writeFileSync('/Users/efekarakoyun/hukukçalışma/uygulama/frontend/data/kararlar.json', JSON.stringify(kararlar, null, 2));
console.log('112 kararlar generated');
