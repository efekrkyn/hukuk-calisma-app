import { describe, expect, it } from "vitest";
import { hasArticle } from "./hmgs-verify";

describe("hasArticle", () => {
  it("maddeyi metinde bulur", () => {
    expect(hasArticle("Kanunun bağlayıcılığı Madde 6- (1) Tanımlar...", "6")).toBe(true);
    expect(hasArticle("TCK m.265'e göre direnme suçu", "265")).toBe(true);
    expect(hasArticle("MADDE 384- Çekişmesiz yargıda yetki", "384")).toBe(true);
  });

  // Asıl kritik durum: bu ayrım tutmazsa düzeltmenin tamamı boşa gider,
  // "Madde 60" görüp "Madde 6 zaten var" denir ve eksik madde çekilmez.
  it("daha uzun madde numarasını yanlışlıkla eşleştirmez", () => {
    expect(hasArticle("Madde 60- Tanıklıktan çekinme", "6")).toBe(false);
    expect(hasArticle("m.265/2 yargı görevi yapan", "26")).toBe(false);
    expect(hasArticle("Madde 1229- Konişmento", "122")).toBe(false);
  });

  it("fıkralı atıfta madde numarasını yakalar", () => {
    expect(hasArticle("Madde 195/1-a-1 hâkimiyet", "195")).toBe(true);
  });

  // Madde bilgisi olmayan atıf doğrulanamaz; "yok" deyip her seferinde
  // dışarı çıkmak gereksiz ağ çağrısı üretirdi.
  it("madde bilgisi yoksa var sayar", () => {
    expect(hasArticle("herhangi bir metin", null)).toBe(true);
  });

  it("boş metinde bulamaz", () => {
    expect(hasArticle("", "6")).toBe(false);
  });
});
