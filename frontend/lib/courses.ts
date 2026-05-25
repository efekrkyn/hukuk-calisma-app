export type Course = { id: string; name: string };

export const COURSES: Course[] = [
  // Borçlar
  { id: "borclar_genel", name: "Borçlar Genel Hukuku" },
  { id: "borclar_ozel", name: "Borçlar Özel Hukuku" },
  // Diğer medeni dersler
  { id: "medeni_hukuk", name: "Medeni Hukuk (Giriş ve Kişiler)" },
  { id: "miras_hukuku", name: "Miras Hukuku" },
  { id: "esya_hukuku", name: "Eşya Hukuku" },
  // Ceza
  { id: "ceza_genel", name: "Ceza Hukuku Genel" },
  { id: "ceza_ozel", name: "Ceza Hukuku Özel" },
  { id: "ceza_muhakemesi", name: "Ceza Muhakemesi" },
  // İş + Vergi + Ticaret + Deniz + Kıymetli
  { id: "is_hukuku", name: "İş Hukuku" },
  { id: "vergi_hukuku", name: "Vergi Hukuku" },
  { id: "ticaret_hukuku", name: "Ticaret Hukuku" },
  { id: "kiymetli_evrak", name: "Kıymetli Evrak" },
  { id: "deniz_ticareti", name: "Deniz Ticareti" },
  // Usul + Yargı
  { id: "medeni_usul", name: "Medeni Usul" },
  { id: "icra_iflas", name: "İcra İflas" },
  { id: "idari_yargilama", name: "İdari Yargı" },
  // Milletlerarası
  { id: "milletlerarasi_kamu", name: "Milletlerarası Kamu Hukuku" },
  { id: "milletlerarasi_ozel", name: "MÖHUK (Milletlerarası Özel)" },
  // Genel kamu + felsefe/sosyoloji
  { id: "genel_kamu", name: "Genel Kamu Hukuku" },
  { id: "hukuk_felsefesi", name: "Hukuk Felsefesi" },
  { id: "hukuk_sosyolojisi", name: "Hukuk Sosyolojisi" },
  // Kanunlar/kitaplar
  { id: "kanunlar", name: "Genel Hukuk Kitapları" },
];

export const courseById = (id: string): Course | undefined =>
  COURSES.find((c) => c.id === id);
