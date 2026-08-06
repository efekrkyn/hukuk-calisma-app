import { describe, expect, it } from "vitest";
import { stripSourceRefs } from "./hmgs-generator";

// Örnekler uydurma değil: bankadaki 87 sızıntılı açıklamadan çıkarıldı.
describe("stripSourceRefs", () => {
  it("parantezli sourceIndex'i atar", () => {
    expect(stripSourceRefs("TBK m.325'e göre borç devam eder. (sourceIndex: 6)"))
      .toBe("TBK m.325'e göre borç devam eder.");
  });

  it("köşeli parantezli hâlini atar", () => {
    expect(stripSourceRefs("Fonksiyon gaspı sayılır. [sourceIndex: 37]"))
      .toBe("Fonksiyon gaspı sayılır.");
  });

  it("tek ve çoklu Kaynak atıflarını atar", () => {
    expect(stripSourceRefs("Şu şekildedir. (Kaynak [9])")).toBe("Şu şekildedir.");
    expect(stripSourceRefs("Şu şekildedir. (Kaynak [1] ve [2])")).toBe("Şu şekildedir.");
    expect(stripSourceRefs("Şu şekildedir. (kaynak [2]).")).toBe("Şu şekildedir.");
  });

  it("cümle hâlindeki atfı atar", () => {
    expect(
      stripSourceRefs(
        "Doğru cevap 'Altı ay' olup, kaynak [9]'daki madde metnine dayanılarak hazırlanmıştır."
      )
      // Askıda kalan virgül atılıp cümle noktayla kapanıyor.
    ).toBe("Doğru cevap 'Altı ay' olup.");
  });

  // Bankada 8 açıklama bu biçimdeydi ve önceki regex hepsini tamamen
  // boşaltıyordu: atıf cümlenin öznesi, silinemez.
  it("anlatıma dahil atfı silmez, nötrleştirir", () => {
    expect(
      stripSourceRefs("Kaynak [76]'da belirtildiği üzere Hume, devletin doğuşunu açıklar.")
    ).toBe("Kaynak metninde belirtildiği üzere Hume, devletin doğuşunu açıklar.");
    expect(stripSourceRefs("Kaynak [64]'te Austin'in görüşü aktarılır."))
      .toBe("Kaynak metninde Austin'in görüşü aktarılır.");
  });

  it("atıf yoksa metni bozmaz", () => {
    const s = "İİK m.40/1'e göre icra muameleleri olduğu yerde durur.";
    expect(stripSourceRefs(s)).toBe(s);
  });

  it("madde numaralarına ve köşeli olmayan sayılara dokunmaz", () => {
    const s = "TCK m.87/2 (a) bendine göre ceza iki kat artırılır; alt sınır 6 yıldır.";
    expect(stripSourceRefs(s)).toBe(s);
  });
});
