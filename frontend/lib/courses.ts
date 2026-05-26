export type Course = { id: string; name: string };

export const COURSES: Course[] = [
  // AÜHF 4. Sınıf Öncelikli Dersler
  { id: "icra_iflas", name: "İcra ve İflas Hukuku" },
  { id: "ceza_muhakemesi", name: "Ceza Muhakemesi Hukuku (CMK)" },
  { id: "milletlerarasi_ozel", name: "Milletlerarası Özel Hukuk (MÖHUK)" },
  { id: "is_hukuku", name: "İş ve Sosyal Güvenlik Hukuku" },
  { id: "kiymetli_evrak", name: "Kıymetli Evrak Hukuku" },
  { id: "miras_hukuku", name: "Miras Hukuku" },
  { id: "deniz_ticareti", name: "Deniz Ticareti Hukuku" },

  // Borçlar
  { id: "borclar_genel", name: "Borçlar Genel Hukuku" },
  { id: "borclar_ozel", name: "Borçlar Özel Hukuku" },
  
  // Diğer medeni dersler
  { id: "medeni_hukuk", name: "Medeni Hukuk (Giriş ve Kişiler)" },
  { id: "esya_hukuku", name: "Eşya Hukuku" },
  
  // Ceza
  { id: "ceza_genel", name: "Ceza Hukuku Genel" },
  { id: "ceza_ozel", name: "Ceza Hukuku Özel" },

  // Vergi + Ticaret
  { id: "vergi_hukuku", name: "Vergi Hukuku" },
  { id: "ticaret_hukuku", name: "Ticaret Hukuku (Şirketler)" },

  // Usul + Yargı + İdare
  { id: "medeni_usul", name: "Medeni Usul Hukuku (HMK)" },
  { id: "idare_hukuku", name: "İdare Hukuku" },
  { id: "idari_yargilama", name: "İdari Yargılama Hukuku (İYUK)" },

  // Milletlerarası
  { id: "milletlerarasi_kamu", name: "Milletlerarası Kamu Hukuku" },

  // Genel kamu + felsefe/sosyoloji + Anayasa
  { id: "anayasa_hukuku", name: "Anayasa Hukuku" },
  { id: "genel_kamu", name: "Genel Kamu Hukuku" },
  { id: "hukuk_felsefesi", name: "Hukuk Felsefesi ve Sosyolojisi" },

  // Kanunlar/kitaplar/kişisel
  { id: "kanunlar", name: "Genel Hukuk Kitapları" },
  { id: "kisisel", name: "Kişisel Notlarım (Yüklenen PDF'ler)" },
];

export const courseById = (id: string): Course | undefined =>
  COURSES.find((c) => c.id === id);
