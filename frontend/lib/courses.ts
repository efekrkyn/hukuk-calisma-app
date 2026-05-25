export type Course = { id: string; name: string };

export const COURSES: Course[] = [
  { id: "borclar_ozel", name: "Borçlar Özel Hukuku" },
  { id: "miras_hukuku", name: "Miras Hukuku" },
  { id: "esya_hukuku", name: "Eşya Hukuku" },
  { id: "is_hukuku", name: "İş Hukuku" },
  { id: "vergi_hukuku", name: "Vergi Hukuku" },
  { id: "ticaret_hukuku", name: "Ticaret Hukuku" },
  { id: "kiymetli_evrak", name: "Kıymetli Evrak" },
  { id: "deniz_ticareti", name: "Deniz Ticareti" },
  { id: "icra_iflas", name: "İcra İflas" },
  { id: "medeni_usul", name: "Medeni Usul" },
  { id: "ceza_muhakemesi", name: "Ceza Muhakemesi" },
  { id: "idari_yargilama", name: "İdari Yargı" },
  { id: "milletlerarasi_ozel", name: "MÖHUK" },
  { id: "genel_kamu", name: "Genel Kamu Hukuku" },
  { id: "hukuk_sosyolojisi", name: "Hukuk Sosyolojisi" },
  { id: "kanunlar", name: "Genel Hukuk Kitapları" },
];

export const courseById = (id: string): Course | undefined =>
  COURSES.find((c) => c.id === id);
