import { getQuizQuestionsByCourse } from "@/lib/quiz";
import QuizClient from "./QuizClient";
import { notFound } from "next/navigation";

export default async function QuizCoursePage({
  params,
}: {
  params: Promise<{ course: string }>;
}) {
  const courseId = (await params).course;
  const questions = await getQuizQuestionsByCourse(courseId);

  if (!questions || questions.length === 0) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-3xl">
        <QuizClient courseId={courseId} questions={questions} />
      </div>
    </div>
  );
}
