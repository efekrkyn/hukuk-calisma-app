"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { streamDilekce } from "@/lib/api";
import { Loader2, Send, Download, CheckCircle2, PenTool } from "lucide-react";

const TEMPLATES = [
  "Anlaşmalı Boşanma Protokolü",
  "Çekişmeli Boşanma Dilekçesi",
  "İşe İade İhtarname",
  "Kıdem Tazminatı Talepli Dava Dilekçesi",
  "Kira Tahliye Talepli İcra Takibi",
  "Özel Taslak (Kendin Belirle)"
];

export default function DilekceClient() {
  const [docType, setDocType] = useState(TEMPLATES[0]);
  const [customDocType, setCustomDocType] = useState("");
  const [details, setDetails] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedText, setGeneratedText] = useState("");
  const [copied, setCopied] = useState(false);

  const finalDocType = docType === "Özel Taslak (Kendin Belirle)" ? customDocType : docType;

  const handleGenerate = async () => {
    if (!details.trim() || !finalDocType.trim()) return;
    
    setIsGenerating(true);
    setGeneratedText("");
    setCopied(false);

    try {
      const generator = streamDilekce({
        documentType: finalDocType,
        details: details
      });

      for await (const ev of generator) {
        if (ev.type === "token") {
          setGeneratedText((prev) => prev + ev.data);
        } else if (ev.type === "error") {
          console.error("AI dilekce error:", ev.data);
        }
      }
    } catch (e) {
      console.error(e);
      alert("Metin üretilirken bir hata oluştu.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Sol Panel: Giriş */}
      <Card className="lg:col-span-5 glass border-primary/20">
        <CardHeader className="bg-primary/5 pb-4 border-b border-border/10">
          <CardTitle className="text-lg">Metin Detayları</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Taslak Türü</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full p-2 rounded-md border bg-background text-sm"
              disabled={isGenerating}
            >
              {TEMPLATES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {docType === "Özel Taslak (Kendin Belirle)" && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
              <label className="text-sm font-medium text-foreground">Hangi Metni İstiyorsun?</label>
              <input
                type="text"
                value={customDocType}
                onChange={(e) => setCustomDocType(e.target.value)}
                placeholder="Örn: Ayıplı Mal İhtarname"
                className="w-full p-2 rounded-md border bg-background text-sm"
                disabled={isGenerating}
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Olayın Detayları (Prompt)</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Örn: Müvekkil Ahmet Yılmaz ile Ayşe Yılmaz anlaşmalı boşanacaktır. Nafaka 5000 TL, müşterek çocuğun velayeti annede kalacaktır. Mallar paylaşıldı."
              className="w-full h-40 p-3 rounded-md border bg-background text-sm resize-none"
              disabled={isGenerating}
            />
          </div>

          <Button 
            onClick={handleGenerate} 
            disabled={isGenerating || !details.trim()}
            className="w-full hover-glow"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Hazırlanıyor...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Taslağı Oluştur
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Sağ Panel: Çıktı */}
      <Card className="lg:col-span-7 glass border-primary/20 min-h-[500px] flex flex-col relative overflow-hidden">
        {generatedText ? (
          <>
            <div className="flex items-center justify-between p-3 border-b border-border/10 bg-primary/5">
              <span className="text-sm font-semibold text-primary">Oluşturulan Taslak</span>
              <Button size="sm" variant="outline" onClick={handleCopy}>
                {copied ? <CheckCircle2 className="w-4 h-4 mr-1 text-green-500" /> : <Download className="w-4 h-4 mr-1" />}
                {copied ? "Kopyalandı!" : "Kopyala"}
              </Button>
            </div>
            <div className="p-6 flex-1 overflow-auto whitespace-pre-wrap font-mono text-sm leading-relaxed text-foreground/90">
              {generatedText}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-60">
            <PenTool className="w-16 h-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-xl font-medium mb-2">Laboratuvar Boş</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Sol taraftan bir taslak türü seçip detayları girdiğinde, profesyonel hukuki metin burada saniyeler içinde belirecektir.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
