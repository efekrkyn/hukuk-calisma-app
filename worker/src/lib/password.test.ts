/**
 * `npx tsx src/lib/password.test.ts`
 *
 * Projedeki diğer testlerle aynı koşum yolu (node:assert + tsx). Worker'da
 * kurulu bir test çatısı yok ve parola modülü sadece WebCrypto'ya dayandığı
 * için Node'da olduğu gibi koşuyor — sırf bu dosya uğruna bağımlılık eklemek
 * çalışan bir teste hiçbir şey katmazdı.
 *
 * BU DOSYADA GERÇEK PAROLA YOK: aşağıdakiler test dizgileri, hiçbir hesabın
 * parolası değil ve hiçbir yere yazılmıyor.
 */
import assert from "node:assert/strict";
import {
  generateSalt,
  hashPassword,
  timingSafeEqual,
  verifyPassword,
  MIN_PASSWORD_LENGTH,
} from "./password.js";

const SALT_A = "00112233445566778899aabbccddeeff";
const SALT_B = "ffeeddccbbaa99887766554433221100";

// tsx bu dosyayı CJS'e çeviriyor, üst düzey `await` derlenmiyor — hepsi
// tek bir async gövdeye sarıldı.
async function main() {
// --- karma belirlenimci mi ---------------------------------------------------
// Doğrulama buna dayanıyor: aynı parola + aynı salt her seferinde aynı karma.
const h1 = await hashPassword("ornek-parola-1", SALT_A);
const h2 = await hashPassword("ornek-parola-1", SALT_A);
assert.equal(h1, h2, "aynı parola + aynı salt aynı karmayı vermeli");

// SHA-256 çıktısı 32 bayt = 64 hex karakter
assert.equal(h1.length, 64);
assert.match(h1, /^[0-9a-f]+$/);

// --- farklı parola farklı karma ---------------------------------------------
const h3 = await hashPassword("ornek-parola-2", SALT_A);
assert.notEqual(h1, h3, "farklı parola aynı karmayı vermemeli");

// Tek karakter farkı bile yetmeli
const h4 = await hashPassword("ornek-parola-1 ", SALT_A);
assert.notEqual(h1, h4, "sondaki boşluk farklı parola sayılmalı");

// --- salt gerçekten ayırıyor mu ---------------------------------------------
// Salt'ın tek işi bu: aynı parolayı seçen iki kullanıcı aynı karmayı almasın.
const h5 = await hashPassword("ornek-parola-1", SALT_B);
assert.notEqual(h1, h5, "farklı salt aynı parolayı farklı karmalamalı");

// --- salt üretimi ------------------------------------------------------------
const s1 = generateSalt();
const s2 = generateSalt();
assert.equal(s1.length, 32, "16 bayt = 32 hex karakter");
assert.match(s1, /^[0-9a-f]+$/);
assert.notEqual(s1, s2, "salt her çağrıda rastgele olmalı");

// --- sabit zamanlı karşılaştırma doğru sonuç veriyor mu ---------------------
// "Sabit zamanlı" olmak doğruluğu bozmamalı; önce doğruluk sınanıyor.
assert.equal(timingSafeEqual("abc", "abc"), true);
assert.equal(timingSafeEqual("abc", "abd"), false, "son karakter farkı");
assert.equal(timingSafeEqual("abc", "bbc"), false, "ilk karakter farkı");
assert.equal(timingSafeEqual("abc", "abcd"), false, "uzunluk farkı da fark");
assert.equal(timingSafeEqual("abcd", "abc"), false, "uzunluk farkı simetrik");
assert.equal(timingSafeEqual("", ""), true, "iki boş dizgi eşit");
assert.equal(timingSafeEqual("", "a"), false, "boş dizgi ile dolu dizgi eşit değil");
assert.equal(timingSafeEqual(h1, h2), true, "gerçek karmalar üzerinde de doğru");
assert.equal(timingSafeEqual(h1, h3), false);

// --- uçtan uca doğrulama -----------------------------------------------------
const salt = generateSalt();
const stored = await hashPassword("dogru-parola-ornegi", salt);
assert.equal(await verifyPassword("dogru-parola-ornegi", salt, stored), true);
assert.equal(await verifyPassword("yanlis-parola-ornegi", salt, stored), false);
// Doğru parola + yanlış salt geçmemeli: karma ile salt birlikte saklanır,
// biri diğeri olmadan işe yaramaz.
assert.equal(await verifyPassword("dogru-parola-ornegi", SALT_A, stored), false);

// --- sınır sabiti ------------------------------------------------------------
assert.equal(MIN_PASSWORD_LENGTH, 8);

console.log("password.test.ts: tüm testler geçti");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
