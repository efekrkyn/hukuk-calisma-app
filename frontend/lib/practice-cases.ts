import borclarOzel from "@/data/practice_cases/borclar_ozel.json";
import mirasHukuku from "@/data/practice_cases/miras_hukuku.json";
import esyaHukuku from "@/data/practice_cases/esya_hukuku.json";
import isHukuku from "@/data/practice_cases/is_hukuku.json";
import vergiHukuku from "@/data/practice_cases/vergi_hukuku.json";
import ticaretHukuku from "@/data/practice_cases/ticaret_hukuku.json";
import denizTicareti from "@/data/practice_cases/deniz_ticareti.json";

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
  ...(borclarOzel as PracticeCase[]),
  ...(mirasHukuku as PracticeCase[]),
  ...(esyaHukuku as PracticeCase[]),
  ...(isHukuku as PracticeCase[]),
  ...(vergiHukuku as PracticeCase[]),
  ...(ticaretHukuku as PracticeCase[]),
  ...(denizTicareti as PracticeCase[]),
];

export const allCases = (): PracticeCase[] => ALL;
export const caseById = (id: string) => ALL.find((c) => c.id === id);
export const casesByCourse = (course: string) =>
  ALL.filter((c) => c.course === course);
