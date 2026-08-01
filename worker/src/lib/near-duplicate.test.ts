/** `npx tsx src/lib/near-duplicate.test.ts` */
import assert from "node:assert/strict";
import { isNearDuplicate, similarity } from "./near-duplicate.js";

// denetimde gerçekten çıkan tekrar çifti — yakalanmalı
const a = "Mal ortaklığı rejiminin ölüm dışında bir sebeple sona ermesi hâlinde, ortaklık mallarının paylaşımı nasıl yapılır?";
const b = "Mal ortaklığı rejiminin ölüm dışındaki bir sebeple sona ermesi hâlinde, ortaklık malları nasıl paylaştırılır?";
assert.ok(isNearDuplicate(a, b), `yakalanmalıydı, benzerlik ${similarity(a, b).toFixed(2)}`);

// aynı alandan ama FARKLI sorular tekrar sayılmamalı — yoksa deneme boşalır
const c = "Edinilmiş mallara katılma rejiminde eşin kişisel malı hangisidir?";
const d = "Mirasın reddi süresi ne kadardır ve hangi tarihten itibaren işler?";
assert.ok(!isNearDuplicate(c, d), `farklı sorular, benzerlik ${similarity(c, d).toFixed(2)}`);

// aynı konuda ama farklı şey soran ikisi de ayrı kalmalı
const e = "Anonim şirkette yönetim kurulu üyesinin şirketle işlem yapma yasağı nasıl kalkar?";
const f = "Anonim şirkette yönetim kurulu üyesinin rekabet yasağının kapsamı nedir?";
assert.ok(!isNearDuplicate(e, f), `benzerlik ${similarity(e, f).toFixed(2)} — ayrı sorular`);

// birebir aynı
assert.equal(similarity(a, a), 1);
assert.ok(isNearDuplicate(a, a));

// boş girdi patlamamalı
assert.equal(similarity("", "x"), 0);
assert.ok(!isNearDuplicate("", ""));

// Türkçe büyük/küçük harf (I/İ) tuzağı
assert.ok(isNearDuplicate("İCRA takibinde İTİRAZ süresi nedir", "icra takibinde itiraz süresi nedir"));

// denetimde çıkan diğer tekrar çifti (sadece isim değişmiş)
assert.ok(isNearDuplicate(
  "Bir anonim şirketin yönetim kurulu üyesi olan X, genel kurulun iznini almadan şirketle işlem yapmıştır. Sonuç nedir?",
  "Bir anonim şirketin yönetim kurulu üyesi (P), genel kurulun iznini almadan şirketle işlem yapmıştır. Sonuç nedir?"
));

// eşik payı: ölçülen en yüksek "farklı" değer 0.33, en düşük "tekrar" 0.61.
// Eşiğin bu aralıkta kaldığını sabitle — kayarsa deneme ya boşalır ya tekrar dolar.
assert.ok(similarity(c, d) < 0.5 && similarity(e, f) < 0.5);
assert.ok(similarity(a, b) >= 0.5);

console.log("near-duplicate: tüm kontroller geçti");
