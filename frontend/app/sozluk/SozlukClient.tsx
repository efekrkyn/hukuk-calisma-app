"use client";

import { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Search } from "lucide-react";

type Term = {
  term: string;
  origin: string;
  definition: string;
};

const TERMS: Term[] = [
  { term: "Muvazaa", origin: "Osmanlıca", definition: "Tarafların üçüncü kişileri aldatmak amacıyla gerçek iradelerine uymayan bir işlem yapmaları. Danışıklı dövüş." },
  { term: "Pacta Sunt Servanda", origin: "Latince", definition: "Ahde vefa ilkesi. Sözleşmelere bağlılık prensibi; yapılan anlaşmaya uyulmalıdır." },
  { term: "Clausula Rebus Sic Stantibus", origin: "Latince", definition: "Koşulların değişmesi halinde sözleşmenin uyarlanması ilkesi. Aşırı ifa güçlüğü (TBK m. 138)." },
  { term: "Culpa in Contrahendo", origin: "Latince", definition: "Sözleşme öncesi sorumluluk. Sözleşme görüşmeleri sırasında kusurlu davranışla karşı tarafa verilen zararın tazmini." },
  { term: "Mutlak Butlan", origin: "Türkçe/Hukuk", definition: "Bir hukuki işlemin baştan itibaren kesin hükümsüz olması. Herkes tarafından ileri sürülebilir, hakim re'sen gözetir." },
  { term: "Nisbi Butlan", origin: "Türkçe/Hukuk", definition: "Hukuki işlemin yalnızca korunan tarafın iradesiyle iptal edilebilir olması. İptal hakkı kullanılmadıkça işlem geçerli kalır." },
  { term: "İntifa Hakkı", origin: "Osmanlıca", definition: "Başkasına ait bir mal üzerinde kullanma ve yararlanma hakkı. Mülkiyet hakkı sahibinde kalır ancak kullanım hakkı intifa hakkı sahibine aittir." },
  { term: "Gabin", origin: "Osmanlıca", definition: "Aşırı yararlanma. Bir sözleşmede taraflardan birinin önemli ölçüde edim dengesizliğinden yararlanması (TBK m. 28)." },
  { term: "Res Judicata", origin: "Latince", definition: "Kesin hüküm. Bir dava hakkında verilen kesinleşmiş kararın artık değiştirilemez olması ve bağlayıcılığı." },
  { term: "Ne Bis In Idem", origin: "Latince", definition: "Aynı fiilden dolayı iki kez yargılanmama ilkesi. Ceza hukukunun temel prensibi." },
  { term: "Nulla Poena Sine Lege", origin: "Latince", definition: "Kanunsuz suç ve ceza olmaz ilkesi. Suçta ve cezada kanunilik prensibi (TCK m. 2)." },
  { term: "In Dubio Pro Reo", origin: "Latince", definition: "Şüpheden sanık yararlanır ilkesi. Yeterli delil yoksa beraat kararı verilmelidir." },
  { term: "Actio Pauliana", origin: "Latince", definition: "Tasarrufun iptali davası. Borçlunun alacaklıya zarar vermek için mal kaçırması durumunda açılan dava (İİK m. 277 vd.)." },
  { term: "Hıyar", origin: "Osmanlıca", definition: "Seçimlik hak. Taraflardan birine tanınan, sözleşmeyi feshetme veya devam ettirme konusundaki tercih hakkı." },
  { term: "Müktesep Hak", origin: "Osmanlıca", definition: "Kazanılmış hak. Hukuki olarak elde edilmiş ve artık geri alınamayan hak." },
  { term: "Vekalet", origin: "Osmanlıca", definition: "Bir kişinin diğerini temsil etmesi için yetkilendirmesi. TBK m. 502 vd. düzenlenmiştir." },
  { term: "İstihkak Davası", origin: "Osmanlıca", definition: "Mülkiyet hakkına dayanan iade davası. Haksız olarak elde tutulan bir malın iadesini talep etmek." },
  { term: "Lex Posterior Derogat Legi Priori", origin: "Latince", definition: "Sonraki kanun önceki kanunu ilga eder. Aynı konuyu düzenleyen iki kanundan sonrakinin uygulanacağı prensibi." },
  { term: "Ultra Vires", origin: "Latince", definition: "Yetki aşımı. Bir kişi veya kurumun, yasal yetkisini aşan işlemler yapması." },
  { term: "Bona Fides", origin: "Latince", definition: "İyi niyet. Hukuki işlemlerde dürüstlük ve güven prensibi (TMK m. 2-3)." },
];

export default function SozlukClient() {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return TERMS;
    const q = search.toLowerCase();
    return TERMS.filter(
      (t) =>
        t.term.toLowerCase().includes(q) ||
        t.origin.toLowerCase().includes(q) ||
        t.definition.toLowerCase().includes(q)
    );
  }, [search]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Terim, kavram veya Latince ifade ara..."
          className="w-full pl-10 pr-4 py-3 rounded-xl border bg-background text-sm"
        />
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} terim bulundu</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((t) => (
          <Card key={t.term} className="glass border-primary/10 hover-glow transition-all">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center justify-between">
                <span className="text-gradient font-bold">{t.term}</span>
                <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">{t.origin}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">{t.definition}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-medium">"{search}" için sonuç bulunamadı.</p>
          <p className="text-sm mt-1">Farklı bir terim aramayı deneyin.</p>
        </div>
      )}
    </div>
  );
}
