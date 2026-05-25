import Link from "next/link";
import { ArrowLeft, Newspaper, Bell } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const MOCK_UPDATES = [
  {
    id: "1",
    date: "2025-05-20",
    type: "Kanun Değişikliği",
    title: "İcra ve İflas Kanunu'nda Değişiklik",
    summary:
      "İİK m. 82'de yapılan değişiklikle, haczedilemez malların kapsamı genişletilmiştir. Borçlunun yaşamını sürdürmesi için zorunlu olan ev eşyaları, elektronik aletler ve kişisel eşyalar artık daha geniş bir koruma kapsamına alınmıştır.",
    source: "Resmi Gazete - Sayı: 32543",
    impact: "Yüksek",
  },
  {
    id: "2",
    date: "2025-05-15",
    type: "AYM Kararı",
    title: "Uzlaştırma Kapsamının Genişletilmesi",
    summary:
      "Anayasa Mahkemesi, CMK m. 253'te yer alan uzlaştırma kapsamındaki suçların sınırlandırılmasına ilişkin düzenlemeyi iptal etmiştir. Bu kararla birlikte daha fazla suç türü uzlaştırma kapsamına alınabilecektir.",
    source: "Anayasa Mahkemesi Genel Kurulu",
    impact: "Orta",
  },
  {
    id: "3",
    date: "2025-05-10",
    type: "Yönetmelik",
    title: "Avukatlık Asgari Ücret Tarifesi Güncellendi",
    summary:
      "2025 yılı Avukatlık Asgari Ücret Tarifesi Resmi Gazete'de yayımlanarak yürürlüğe girmiştir. Yeni tarifede özellikle tüketici ve iş davalarında vekalet ücretlerinde önemli artışlar yapılmıştır.",
    source: "Resmi Gazete - Sayı: 32538",
    impact: "Düşük",
  },
];

export default function MevzuatPage() {
  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <Link
            href="/"
            className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Ana sayfa
          </Link>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-gradient">
            <Newspaper className="w-8 h-8 text-primary" />
            Mevzuat Takip Sistemi
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Son kanun değişiklikleri, AYM kararları ve yönetmelik güncellemeleri.
          </p>
        </div>

        <div className="space-y-4">
          {MOCK_UPDATES.map((update) => (
            <Card key={update.id} className="glass hover-glow border-primary/20">
              <CardHeader className="pb-3 border-b border-border/10 bg-muted/10">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Bell className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-gradient">{update.title}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">{update.date} • {update.source}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">{update.type}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        update.impact === "Yüksek"
                          ? "bg-red-500/10 text-red-500"
                          : update.impact === "Orta"
                          ? "bg-yellow-500/10 text-yellow-600"
                          : "bg-green-500/10 text-green-600"
                      }`}
                    >
                      {update.impact} Etki
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <p className="text-sm leading-relaxed text-foreground/90">{update.summary}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center py-6">
          <p className="text-xs text-muted-foreground">
            Mevzuat güncellemeleri düzenli olarak eklenmektedir. Her hafta en güncel değişiklikleri burada bulabilirsin.
          </p>
        </div>
      </div>
    </main>
  );
}
