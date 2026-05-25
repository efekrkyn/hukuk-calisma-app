import { notFound } from "next/navigation";
import { caseById, allCases } from "@/lib/practice-cases";
import { PracticeGrader } from "@/components/PracticeGrader";

export function generateStaticParams() {
  return allCases().map((c) => ({ id: c.id }));
}

export default async function PracticeCasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pc = caseById(id);
  if (!pc) notFound();
  return <PracticeGrader case_={pc} />;
}
