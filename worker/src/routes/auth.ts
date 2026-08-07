import { Hono } from "hono";
import { sign } from "hono/jwt";
import {
  generateSalt,
  hashPassword,
  timingSafeEqual,
  verifyPassword,
  MIN_PASSWORD_LENGTH,
} from "../lib/password";

type Bindings = {
  DB: D1Database;
  ADMIN_SECRET: string;
};

/**
 * Migration 010 öncesi TÜM verinin sahibi olan kullanıcı.
 *
 * Değer migration'daki INSERT ile birebir aynı olmak zorunda; ikisinden biri
 * değişirse eski deneme, plan ve tekrar kayıtları erişilemez hâle gelir.
 */
export const DEFAULT_USER_ID = "default";

/**
 * Kullanıcı tablosundan ÖNCE dağıtılmış tokenların taşıdığı sabit `sub`.
 *
 * O tokenlar 30 gün — bir kısmı 1 yıl — ömürle imzalandı ve hâlâ geçerli.
 * Eşlenmezse sahibi giriş yapmış görünür ama kendi verisini bulamaz: `sub`
 * users tablosunda olmayan bir id'ye işaret eder, her sorgu boş döner.
 * Tek satırlık eşleme, o tokenlar süresi dolup gidene kadar duruyor.
 */
export const LEGACY_SUB = "efe";

/**
 * Bir JWT `sub` alanını gerçek kullanıcı kimliğine çevirir.
 *
 * index.ts'teki middleware ile auth uçları aynı kuralı kullansın diye burada;
 * iki yerde ayrı yazılsaydı biri güncellenip diğeri unutulurdu.
 */
export function resolveUserId(sub: unknown): string {
  const s = typeof sub === "string" ? sub : "";
  if (!s || s === LEGACY_SUB) return DEFAULT_USER_ID;
  return s;
}

/**
 * Oturum ömrü — 1 yıl.
 *
 * Şifre kalkmıyor çünkü aynı API'nin arkasında para harcayan uçlar var
 * (/hmgs/generate, /hmgs/verify, /ai/*) ve workers.dev adresleri taranabiliyor.
 * Ama sınava hazırlanan kişinin ayda bir tekrar giriş yapmasının bir güvenlik
 * faydası yok — tek cihazda yıllık oturum, sürtünmeyi sıfırlarken korumayı
 * aynı bırakıyor.
 */
const SESSION_SECONDS = 60 * 60 * 24 * 365;

/** Kullanıcı adı: sıkı ve dar. Dar tutmanın sebebi tahmin edilebilirlik. */
const USERNAME_RE = /^[a-z0-9_.-]{3,32}$/;

export const authRouter = new Hono<{ Bindings: Bindings }>();

/**
 * Giriş.
 *
 * İKİ YOL, tek uç:
 *
 * 1) `username` YOK → eski davranış: parola ADMIN_SECRET ile karşılaştırılır,
 *    başarılıysa varsayılan kullanıcı olarak girilir. Bu yol KALDIRILAMAZ:
 *    dağıtılmış oturumlar, kurulum betikleri ve frontend'in kullanıcı adı
 *    girilmeden yapılan girişi buna bağlı.
 *
 * 2) `username` VAR → users tablosundan bulunur, PBKDF2 ile doğrulanır.
 *
 * Parola hiçbir dalda loglanmıyor ve yanıta konmuyor.
 */
authRouter.post("/login", async (c) => {
  let body: { username?: unknown; password?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (!password) {
    return c.json({ error: "Şifre girilmesi zorunludur." }, 400);
  }

  const username =
    typeof body.username === "string" ? body.username.trim().toLowerCase() : "";

  let userId: string;

  if (!username) {
    // Karşılaştırma sabit zamanlı: `!==` ilk farklı karakterde döner ve yanıt
    // süresi ADMIN_SECRET'in ne kadarının tutturulduğunu ele verir.
    if (!timingSafeEqual(password, c.env.ADMIN_SECRET)) {
      return c.json({ error: "Hatalı şifre." }, 401);
    }
    userId = DEFAULT_USER_ID;
  } else {
    const row = await c.env.DB.prepare(
      `SELECT id, password_hash, password_salt FROM users WHERE username = ?`
    )
      .bind(username)
      .first<{ id: string; password_hash: string | null; password_salt: string | null }>();

    // Hata mesajı tek: "kullanıcı yok" ile "parola yanlış" ayrımı, saldırgana
    // hangi kullanıcı adlarının var olduğunu tarayarak öğrenme imkânı verir.
    // ponytail: kullanıcı bulunamadığında PBKDF2 koşulmuyor, yani var/yok ayrımı
    // yanıt süresinden hâlâ okunabilir. Sahte karma koşturmak bunu kapatır ama
    // her uydurma kullanıcı adına 100.000 iterasyon ödetir; kayıt zaten
    // kapalı olduğu ve hesap sayısı iki-üç olduğu için bu takas kabul edildi.
    if (!row || !row.password_hash || !row.password_salt) {
      return c.json({ error: "Kullanıcı adı veya şifre hatalı." }, 401);
    }

    const ok = await verifyPassword(password, row.password_salt, row.password_hash);
    if (!ok) {
      return c.json({ error: "Kullanıcı adı veya şifre hatalı." }, 401);
    }
    userId = row.id;
  }

  // `sub` artık kullanıcı kimliği; middleware her isteği bu alandan sahiplendiriyor.
  const token = await sign(
    { sub: userId, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS },
    c.env.ADMIN_SECRET
  );

  return c.json({ success: true, token, user_id: userId });
});

/**
 * Yeni kullanıcı açar.
 *
 * KORUMA — NEDEN AÇIK KAYIT YOK: Bu API'nin arkasında para harcayan uçlar var
 * (/hmgs/generate, /hmgs/verify, /ai/*). Herkesin hesap açabildiği bir kapı,
 * herkesin uygulama sahibinin faturasıyla soru ürettirmesi demek. Uygulama
 * iki kişilik; kayıt bir büyüme kanalı değil, kurulum adımı.
 *
 * KORUMA — NEDEN AYRI BİR BAŞLIK KONTROLÜ YOK: Bu yol index.ts'teki muafiyet
 * listesinde DEĞİL, yani global middleware zaten geçerli bir oturum şart
 * koşuyor. ADMIN_SECRET ile erişim de kaybolmuyor: sahibi önce /auth/login'e
 * ADMIN_SECRET'i gönderip token alıyor, sonra buraya çağırıyor. İkinci bir
 * kimlik doğrulama yolu yazmak, yanlış yazılabilecek ikinci bir kapı açardı —
 * en güvenli kimlik kontrolü, hiç yazılmayanıdır.
 *
 * Hesap AÇILMIYOR burada: mekanizma hazır, hesapları sahibi kendisi açacak.
 */
authRouter.post("/register", async (c) => {
  let body: { username?: unknown; password?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }

  const username =
    typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!USERNAME_RE.test(username)) {
    return c.json(
      { error: "Kullanıcı adı 3-32 karakter olmalı; küçük harf, rakam, . _ - kullanılabilir." },
      400
    );
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return c.json(
      { error: `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır.` },
      400
    );
  }

  const salt = generateSalt();
  const hash = await hashPassword(password, salt);
  const id = crypto.randomUUID();

  try {
    await c.env.DB.prepare(
      `INSERT INTO users (id, username, password_hash, password_salt, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
      .bind(id, username, hash, salt, Date.now())
      .run();
  } catch (e) {
    // username UNIQUE; çakışmayı önce SELECT ile yoklamak yarış koşuluna açık
    // olurdu — kısıtın kendisi tek doğru hakem.
    const msg = String(e);
    if (msg.includes("UNIQUE")) {
      return c.json({ error: "Bu kullanıcı adı zaten alınmış." }, 409);
    }
    console.error("register:", msg);
    return c.json({ error: "Kullanıcı oluşturulamadı." }, 500);
  }

  // Yanıtta parola ya da karma YOK; çağıran zaten ne gönderdiğini biliyor.
  return c.json({ success: true, user_id: id, username });
});
