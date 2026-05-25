import borclarGenel from "@/data/practice_cases/borclar_genel.json";
import borclarOzel from "@/data/practice_cases/borclar_ozel.json";
import mirasHukuku from "@/data/practice_cases/miras_hukuku.json";
import esyaHukuku from "@/data/practice_cases/esya_hukuku.json";
import isHukuku from "@/data/practice_cases/is_hukuku.json";
import vergiHukuku from "@/data/practice_cases/vergi_hukuku.json";
import ticaretHukuku from "@/data/practice_cases/ticaret_hukuku.json";
import denizTicareti from "@/data/practice_cases/deniz_ticareti.json";
import medeniUsul from "@/data/practice_cases/medeni_usul.json";
import icraIflas from "@/data/practice_cases/icra_iflas.json";
import cezaGenel from "@/data/practice_cases/ceza_genel.json";
import cezaOzel from "@/data/practice_cases/ceza_ozel.json";
import cezaMuhakemesi from "@/data/practice_cases/ceza_muhakemesi.json";
import idariYargilama from "@/data/practice_cases/idari_yargilama.json";
import milletlerarasiOzel from "@/data/practice_cases/milletlerarasi_ozel.json";

export type PracticeCase = {
  id: string;
  course: string;
  title: string;
  difficulty: "kolay" | "orta" | "zor";
  scenario: string;
  ideal_solution: string;
  key_points: string[];
  source?: string;
  topics: string[];
};

const ALL: PracticeCase[] = [
  ...(borclarGenel as PracticeCase[]),
  ...(borclarOzel as PracticeCase[]),
  ...(mirasHukuku as PracticeCase[]),
  ...(esyaHukuku as PracticeCase[]),
  ...(isHukuku as PracticeCase[]),
  ...(vergiHukuku as PracticeCase[]),
  ...(ticaretHukuku as PracticeCase[]),
  ...(denizTicareti as PracticeCase[]),
  ...(medeniUsul as PracticeCase[]),
  ...(icraIflas as PracticeCase[]),
  ...(cezaGenel as PracticeCase[]),
  ...(cezaOzel as PracticeCase[]),
  ...(cezaMuhakemesi as PracticeCase[]),
  ...(idariYargilama as PracticeCase[]),
  ...(milletlerarasiOzel as PracticeCase[]),
];

export const allCases = (): PracticeCase[] => ALL;
export const caseById = (id: string) => ALL.find((c) => c.id === id);
export const casesByCourse = (course: string) =>
  ALL.filter((c) => c.course === course);
