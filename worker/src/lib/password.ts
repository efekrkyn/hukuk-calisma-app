/**
 * Parola karma ve doğrulama — Cloudflare Workers.
 *
 * NEDEN PBKDF2: Workers çalışma zamanında bcrypt/argon2 yok (ikisi de native
 * eklenti ister). Elde WebCrypto var ve orada parola için tasarlanmış tek
 * algoritma PBKDF2. Argon2id kadar bellek-sert değil, ama ham SHA-256'nın
 * aksine iterasyon sayısıyla saldırganın maliyetini yükseltiyor.
 *
 * NEDEN SALT: Salt olmasa aynı parolayı seçen iki kullanıcı aynı karmayı
 * üretir ve tek bir gökkuşağı tablosu ikisini birden açar. Salt satır başına
 * rastgele; gizli değil, tekrarsız olması yeterli.
 *
 * BURADA OLMAYAN: Parola hiçbir yerde loglanmıyor, hiçbir yanıt gövdesine
 * konmuyor ve bu modül parolayı geri döndüren bir fonksiyon içermiyor —
 * karma tek yönlü, "unuttum" akışı sıfırlamayla çözülür, hatırlatmayla değil.
 */

/**
 * OWASP'ın PBKDF2-SHA256 için verdiği alt sınır bölgesinde.
 *
 * Yukarısı daha güvenli ama her giriş denemesi Worker CPU süresi harcıyor;
 * 100.000 iterasyon tek çekirdekte onlarca milisaniye, giriş için kabul
 * edilebilir, kaba kuvvet için pahalı. Değeri artırırsan eski karmalar
 * geçersiz olmaz — karma yeniden üretilmeden doğrulanamaz hâle gelir, yani
 * artırmak parola sıfırlaması gerektirir.
 */
const ITERATIONS = 100_000;

/** 256 bit — SHA-256'nın doğal çıktısı; kısaltmak boşuna bilgi atmak olurdu. */
const KEY_BITS = 256;

/** 16 bayt salt: çakışma olasılığı bu ölçekte pratikte sıfır. */
const SALT_BYTES = 16;

/**
 * En kısa kabul edilen parola.
 *
 * 8 karakter güçlü değil ama altındaki her şey sözlük saldırısına açık.
 * Uç bu sınırı ZORUNLU tutuyor; kullanıcıya bırakılan tercih değil.
 */
export const MIN_PASSWORD_LENGTH = 8;

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length >> 1);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** Yeni kullanıcı için rastgele salt (hex). */
export function generateSalt(): string {
  const bytes = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

/**
 * Parolayı verilen salt ile karar. Aynı parola + aynı salt her zaman aynı
 * hex dizgiyi verir; doğrulama bu belirlenimciliğe dayanıyor.
 */
export async function hashPassword(password: string, saltHex: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: hexToBytes(saltHex),
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    key,
    KEY_BITS
  );
  return bytesToHex(new Uint8Array(bits));
}

/**
 * Sabit zamanlı dizgi karşılaştırması.
 *
 * NEDEN erken `return` YOK: `a === b` ilk farklı bayta gelince döner. Saldırgan
 * yanıt süresini ölçerek karmanın kaç baytını tutturduğunu öğrenir ve karmayı
 * bayt bayt inşa eder. Burada her tur çalışıyor, fark bir akümülatörde
 * birikiyor; süre girdiden bağımsız.
 *
 * Uzunluk farkı da erken dönüşle sızmasın diye akümülatöre XOR ile giriyor.
 * Aralık dışı `charCodeAt` NaN döner, `| 0` onu 0'a çevirir — döngü kısa
 * dizgide de sonuna kadar koşar.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) | 0) ^ (b.charCodeAt(i) | 0);
  }
  return diff === 0;
}

/** Parola, saklanan salt+karma ile eşleşiyor mu. */
export async function verifyPassword(
  password: string,
  saltHex: string,
  expectedHashHex: string
): Promise<boolean> {
  const actual = await hashPassword(password, saltHex);
  return timingSafeEqual(actual, expectedHashHex);
}
